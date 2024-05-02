const { BigQuery } = require("@google-cloud/bigquery");

/**
 * Run a query and wait for the result
 */
exports.query = async (query, params = null) => {
  const bq = new BigQuery();
  const ds = bq.dataset(process.env.BQ_DATASET);
  const [job] = await ds.createQueryJob({ query, params });
  const [rows] = await job.getQueryResults();
  return rows;
};

/**
 * Get the latest rolled-up-day in the dt_bytes table
 */
exports.latestRollupDay = async () => {
  const logExp = parseInt(process.env.DT_LOG_EXPIRATION_DAYS, 10) || 14;

  // find the earliest day eligibile to rollup
  const lower = new Date();
  lower.setUTCHours(0, 0, 0, 0);
  lower.setDate(lower.getDate() - logExp);

  // see if BQ has a day later than that
  const sql = `SELECT MAX(day) AS day FROM dt_bytes WHERE day >= @lower`;
  const rows = await exports.query(sql, { lower });
  if (rows[0]?.day) {
    return new Date(rows[0].day.value);
  }

  return lower;
};
