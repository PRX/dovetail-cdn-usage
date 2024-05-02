const log = require("lambda-log");

const athena = require("./lib/athena");
const bigquery = require("./lib/bigquery");
const util = require("./lib/util");

/**
 * Entrypoint
 */
exports.handler = async (event = {}) => {
  if (event.day) {
    await rollup(util.parseDate(event.day));
  } else {
    const start = await bigquery.latestRollupDay();
    const days = util.daysToProcess(start);
    for (const day of days) {
      await rollup(day);
    }
  }
};

/**
 * Rollup a single day
 */
async function rollup(day) {
  const dayStr = day.toISOString().split("T").shift();
  log.info(`rolling up ${dayStr}`);

  const [elapsed, rows] = await util.elapsed(() => athena.queryUsage(day));
  const parsed = util.parseUsage(day, rows);
  const total = parsed.reduce((sum, row) => sum + row.bytes, 0);
  const info = { rows: rows.length, parsed: parsed.length, total: total };
  log.info(`athena ${dayStr}`, { elapsed, ...info });
}
