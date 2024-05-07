# Dovetail CDN Usage

AWS Lambda to query Dovetail CloudFront usage and insert into BigQuery

## Overview

1. Requests to the [Dovetail CDN](https://github.com/PRX/Infrastructure/tree/main/cdn/dovetail-cdn) are logged to an S3 bucket.
2. This lambda BigQuery-queries for the `MAX(day) FROM dt_bytes`, and processes days >= the result (or all the way back to the S3 expiration date).
3. Then we Athena-query for a day of logs, grouping by path and summing bytes sent.
4. Paths are parsed and grouped as `/<podcast>/<episode>/...` or `/<podcast>/<feed>/episode/...`. Unrecognized paths that use a bunch of bandwidth are warning-logged.
5. Resulting bytes usage is inserted back into BigQuery:

   ```
   {day: "2024-04-23", feeder_podcast: 123, feeder_episode: "abcd-efgh", feeder_feed: null, bytes: 123456789}
   ```

## Development

Local development is dependency free! Just:

```sh
yarn install
yarn test
yarn lint
```

However, if you actually want to hit Athena/BigQuery, you'll need to `cp env-example .env` and fill in several dependencies:

- `ATHENA_DB` the athena database you're using
- `ATHENA_TABLE` the athena table that has been configured to [query to the Dovetail CDN S3 logs](https://docs.aws.amazon.com/athena/latest/ug/cloudfront-logs.html#create-cloudfront-table-standard-logs)
  - **NOTE:** you must have your AWS credentials setup and configured locally to reach/query Athena
- `BQ_DATASET` the BigQuery dataset to load the `dt_bytes` table in. You should use `development` or something locally (not `staging` or `production`)

Then run `yarn start` and you're off!

## Deployment

This function's code is deployed as part of the usual
[PRX CI/CD](https://github.com/PRX/Infrastructure/tree/main?tab=readme-ov-file#cicd) process.
The lambda zip is built via `yarn build`, uploaded to S3, and deployed into the wild.

While that's all straightforward, there are some gotchas setting up access:

1. AWS permissions are (Athena, S3, Glue, etc) are documented in the [Cloudformation Stack](https://github.com/PRX/Infrastructure/blob/main/spire/templates/apps/dovetail-cdn-usage.yml) for this app.
2. Google is configured via the `BQ_CLIENT_CONFIG` ENV and [Federated Access](https://github.com/PRX/internal/wiki/Guide:-Google-Cloud-Workload-Identity-Federation)
3. _In addition to the steps documented in (2)_, the Service Account you create must have the following permissions:
   - `BigQuery Job User` in your BigQuery project
   - _Any_ role on the BigQuery dataset that provides `bigquery.tables.create`, so the table load jobs can execute. We have a custom role to provide this minimal access, but any role with that create permission will work.
   - `BigQuery Data Editor` _only_ on the `dt_bytes` table in the dataset for this environment (click the table name in BigQuery UI -> Share -> Manage Permissions)

## License

[AGPL-3.0 License](https://www.gnu.org/licenses/agpl-3.0.html)
