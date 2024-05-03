const log = require("lambda-log");
const athena = require("./lib/athena");
const bigquery = require("./lib/bigquery");
const util = require("./lib/util");

/**
 * Entrypoint
 */
exports.handler = async (event = {}) => {
  try {
    if (event.day) {
      await rollup(util.parseDate(event.day));
    } else {
      const start = await bigquery.latestRollupDay();
      const days = util.daysToProcess(start);
      for (const day of days) {
        await rollup(day);
      }
    }
  } catch (err) {
    log.error("error running rollups", { err });
    throw err;
  }
};

/**
 * Rollup a single day
 */
async function rollup(day) {
  const dayStr = day.toISOString().split("T").shift();
  log.info(`rolling up ${dayStr}`);

  // query and parse cloudfront logs via athena
  const [elapsed, rows] = await util.elapsed(() => athena.queryUsage(day));
  const parsed = util.parseUsage(day, rows);
  const total = parsed.reduce((sum, row) => sum + row.bytes, 0);
  const info = { rows: rows.length, parsed: parsed.length, total: total };
  log.info(`athena ${dayStr}`, { elapsed, ...info });

  // abort if bigquery already has more bytes for the day
  // (maybe part of this day logs already expired from s3)
  const currentTotal = await bigquery.totalBytes(day);
  if (currentTotal > total) {
    log.error(`bigquery total mismatch ${dayStr}`, { currentTotal, total });
    return false;
  }

  // delete day from bigquery and insert fresh data
  await bigquery.deleteDay(day);
  const [bqElapsed, bqRows] = await util.elapsed(() =>
    bigquery.loadDay(day, parsed),
  );
  log.info(`bigquery ${dayStr}`, { elapsed: bqElapsed, rows: bqRows });

  return true;
}
