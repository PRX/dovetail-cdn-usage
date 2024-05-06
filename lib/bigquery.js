const { promisify } = require("node:util");
const fs = require("fs").promises;
const zlib = require("zlib");
const log = require("lambda-log");
const { BigQuery } = require("@google-cloud/bigquery");

const gzip = promisify(zlib.gzip);

// optional: google workload identity federation
exports.opts = () => {
  if (process.env.BQ_CLIENT_CONFIG) {
    const config = JSON.parse(process.env.BQ_CLIENT_CONFIG);
    return {
      projectId: config.audience.match(/projects\/([0-9]+)\/locations/)[1],
      credentials: config,
    };
  }
  return {};
};

// mockable dataset
exports.dataset = () => {
  const bq = new BigQuery(exports.opts());
  return bq.dataset(process.env.BQ_DATASET);
};

/**
 * Run a query and wait for the result
 */
exports.query = async (query, params = null) => {
  const [job] = await exports.dataset().createQueryJob({ query, params });
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
  const sql = `SELECT MAX(day) AS day FROM dt_bytes WHERE day >= DATE(@lower)`;
  const rows = await exports.query(sql, { lower });
  if (rows[0]?.day) {
    return new Date(rows[0].day.value);
  }

  return lower;
};

/**
 * Get the current total bytes for a day
 */
exports.totalBytes = async (day) => {
  const sql = `SELECT SUM(bytes) AS total_bytes FROM dt_bytes WHERE day = DATE(@day)`;
  const rows = await exports.query(sql, { day });
  return rows[0]?.total_bytes || 0;
};

/**
 * Delete a day of bytes data
 */
exports.deleteDay = async (day) => {
  const sql = `DELETE FROM dt_bytes WHERE day = DATE(@day)`;
  await exports.query(sql, { day });
  return true;
};

/**
 * Save a day of bytes to a temp file, then load to bigquery
 */
exports.loadDay = async (day, rows) => {
  if (rows.length === 0) {
    return 0;
  }

  const file = `/tmp/dt_bytes_${day.toISOString().split("T").shift()}.mjson.gz`;
  try {
    const mjson = rows.map((r) => JSON.stringify(r)).join("\n");
    const gzipped = await gzip(Buffer.from(mjson, "utf8"));
    await fs.writeFile(file, gzipped);

    const opts = { sourceFormat: "NEWLINE_DELIMITED_JSON" };
    await exports.dataset().table("dt_bytes").load(file, opts);

    return rows.length;
  } finally {
    try {
      await fs.unlink(file);
    } catch {
      log.debug("unable to unlink", { file });
    }
  }
};
