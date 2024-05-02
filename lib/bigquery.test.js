const bigquery = require("./bigquery");

describe("bigquery", () => {
  describe("latestRollupDay", () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date("2024-04-04"));
    });

    test("returns the earliest log we haven't expired", async () => {
      process.env.DT_LOG_EXPIRATION_DAYS = 2;
      jest.spyOn(bigquery, "query").mockImplementation(() => []);
      expect(await bigquery.latestRollupDay()).toEqual(new Date("2024-04-02"));
    });

    test("returns the latest rollup day in bigquery", async () => {
      const row = { day: { value: "2024-03-06" } };
      jest.spyOn(bigquery, "query").mockImplementation(() => [row]);
      expect(await bigquery.latestRollupDay()).toEqual(new Date("2024-03-06"));
    });
  });
});
