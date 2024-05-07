const log = require("lambda-log");
const {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
} = require("@aws-sdk/client-athena");

// helper to start a query
async function startQuery(client, QueryString, ExecutionParameters = null) {
  const params = {
    QueryString,
    ExecutionParameters,
    QueryExecutionContext: {
      Catalog: "AwsDataCatalog",
      Database: process.env.ATHENA_DB,
    },
  };
  const command = await new StartQueryExecutionCommand(params);
  const response = await client.send(command);
  return response.QueryExecutionId;
}

// helper to wait for query
async function waitQuery(client, QueryExecutionId) {
  const command = await new GetQueryExecutionCommand({ QueryExecutionId });
  const response = await client.send(command);
  const state = response.QueryExecution.Status.State;
  if (state === "SUCCEEDED") {
    return true;
  }
  if (state === "QUEUED" || state === "RUNNING") {
    await new Promise((r) => {
      setTimeout(r, 1000);
    });
    return waitQuery(client, QueryExecutionId);
  }
  log.error("athena query failed", { err: response });
  throw new Error("query failed");
}

// helper to load all pages of results
async function loadResults(client, QueryExecutionId, NextToken = null) {
  const params = { QueryExecutionId, NextToken, MaxResults: 1000 };
  const command = new GetQueryResultsCommand(params);
  const response = await client.send(command);
  const rows = response.ResultSet.ResultRows.map((r) => r.Data);
  if (!NextToken) {
    rows.shift(); // first row contains headers
  }
  if (response.NextToken) {
    return rows.concat(
      await loadResults(client, QueryExecutionId, response.NextToken),
    );
  }
  return rows;
}

// mockable client
exports.client = () => new AthenaClient();

/**
 * Run a query and wait for the result
 */
exports.query = async (sql, params = null) => {
  const athena = exports.client();
  const id = await startQuery(athena, sql, params);
  await waitQuery(athena, id);
  return loadResults(athena, id);
};

/**
 * Query path/bytes usage information from Athena
 */
exports.queryUsage = async (day) => {
  const dayStr = day.toISOString().split("T").shift();
  const removeRegion = "REGEXP_REPLACE(uri, '\\A/(use1/|usw2/)?')";
  const uri = `REGEXP_REPLACE(${removeRegion}, '/[^/]+/[^/]+\\z')`;
  const tbl = process.env.ATHENA_TABLE;
  const sql = `SELECT ${uri}, SUM(bytes) FROM ${tbl} WHERE date = DATE(?) GROUP BY ${uri}`;

  // NOTE: for some reason, date params must be quoted
  return exports.query(sql, [`'${dayStr}'`]);
};
