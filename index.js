const log = require("lambda-log");
const bigquery = require("./lib/bigquery");
const util = require("./lib/util");

/**
 * Rollup a single day
 */
async function rollup(day) {
  const dayStr = day.toISOString().split("T").shift();
  log.info(`rolling up ${dayStr}`);
}

/**
 * Entrypoint
 */
exports.handler = async (event = {}) => {
  if (event.day) {
    await rollup(event.day);
  } else {
    const start = await bigquery.latestRollupDay();
    const days = util.daysToProcess(start);
    for (const day of days) {
      await rollup(day);
    }
  }
};
