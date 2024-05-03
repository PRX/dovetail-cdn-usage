const bigquery = require("./bigquery");

describe("bigquery", () => {
  describe("latestRollupDay", () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date("2024-04-04"));
    });

    it("returns the earliest log we haven't expired", async () => {
      process.env.DT_LOG_EXPIRATION_DAYS = 2;
      jest.spyOn(bigquery, "query").mockReturnValue([]);
      expect(await bigquery.latestRollupDay()).toEqual(new Date("2024-04-02"));
    });

    it("returns the latest rollup day in bigquery", async () => {
      const row = { day: { value: "2024-03-06" } };
      jest.spyOn(bigquery, "query").mockReturnValue([row]);
      expect(await bigquery.latestRollupDay()).toEqual(new Date("2024-03-06"));
    });
  });

  describe("totalBytes", () => {
    it("returns the total bytes for a day in bigquery", async () => {
      const row = { total_bytes: 12345 };
      jest.spyOn(bigquery, "query").mockReturnValue([row]);

      const total = await bigquery.totalBytes(new Date("2024-05-03"));
      expect(total).toEqual(12345);

      expect(bigquery.query).toHaveBeenCalledTimes(1);
      expect(bigquery.query.mock.calls[0][0]).toMatch(/select sum\(bytes\)/i);
      expect(bigquery.query.mock.calls[0][1]).toEqual({
        day: new Date("2024-05-03"),
      });
    });
  });

  describe("deleteDay", () => {
    it("deletes a day of data", async () => {
      jest.spyOn(bigquery, "query").mockReturnValue([]);

      await bigquery.deleteDay(new Date("2024-05-03"));

      expect(bigquery.query).toHaveBeenCalledTimes(1);
      expect(bigquery.query.mock.calls[0][0]).toMatch(/delete from dt_bytes/i);
      expect(bigquery.query.mock.calls[0][1]).toEqual({
        day: new Date("2024-05-03"),
      });
    });
  });

  describe("loadDay", () => {
    it("gzips and loads a day of data", async () => {
      const table = { load: () => true };
      const dataset = { table: () => table };
      jest.spyOn(table, "load").mockImplementation(async () => true);
      jest.spyOn(bigquery, "dataset").mockReturnValue(dataset);

      const r1 = { feeder_episode: "foo", bytes: 1234 };
      const r2 = { feeder_episode: "bar", bytes: 5678 };
      const count = await bigquery.loadDay(new Date("2024-05-03"), [r1, r2]);

      expect(count).toEqual(2);
      expect(table.load).toHaveBeenCalledTimes(1);
      expect(table.load.mock.calls[0][0]).toMatch("2024-05-03.mjson.gz");
      expect(table.load.mock.calls[0][1]).toEqual({
        sourceFormat: "NEWLINE_DELIMITED_JSON",
      });
    });
  });
});
