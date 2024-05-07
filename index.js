const log = require("lambda-log");
const athena = require("./lib/athena");
const bigquery = require("./lib/bigquery");
const util = require("./lib/util");

/**
 * Entrypoint
 */
exports.handler = async (event = {}) => {
  let latestDay;

  try {
    if (event.day) {
      await exports.rollup(util.parseDate(event.day));
    } else {
      latestDay = await bigquery.latestRollupDay();
      const days = util.daysToProcess(latestDay);
      for (const day of days) {
        await exports.rollup(day);
        latestDay = day;
      }
    }
  } catch (err) {
    log.error("error running rollups", { err });
    throw err;
  } finally {
    if (!event.day) {
      exports.logFallingBehind(latestDay);
    }
  }
};

// log errors if we're far behind (or can't connect to BQ to check)
exports.logFallingBehind = (latestDay) => {
  if (latestDay) {
    const daysBehind = Math.floor(bigquery.logExpirationDays() / 2);
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - daysBehind);
    if (latestDay < threshold) {
      const latest = latestDay.toISOString().split("T").shift();
      log.error("rollups behind", { latest });
    }
  } else {
    log.error("rollups behind");
  }
};

/**
 * Rollup a single day
 */
exports.rollup = async (day) => {
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
};
