const log = require("lambda-log");
const athena = require("./lib/athena");
const bigquery = require("./lib/bigquery");
const index = require("./index");

describe("index", () => {
  describe("handler", () => {
    it("validates dates", async () => {
      jest.spyOn(log, "error").mockReturnValue();

      expect(index.handler({ day: "n/a" })).rejects.toThrow(/invalid date/i);

      expect(log.error).toHaveBeenCalledTimes(1);
      expect(log.error.mock.calls[0][0]).toMatch(/error running rollups/);
    });

    it("inserts a day of data", async () => {
      const day = new Date("2024-05-07");
      const rows = [["1234/abcd", 5678]];

      jest.spyOn(log, "info").mockReturnValue();
      jest.spyOn(athena, "queryUsage").mockReturnValue(rows);
      jest.spyOn(bigquery, "totalBytes").mockReturnValue(0);
      jest.spyOn(bigquery, "deleteDay").mockReturnValue();
      jest.spyOn(bigquery, "loadDay").mockReturnValue();

      await index.handler({ day: "2024-05-07" });

      expect(athena.queryUsage).toHaveBeenCalledTimes(1);
      expect(athena.queryUsage.mock.calls[0][0]).toEqual(day);
      expect(bigquery.totalBytes).toHaveBeenCalledTimes(1);
      expect(bigquery.totalBytes.mock.calls[0][0]).toEqual(day);
      expect(bigquery.deleteDay).toHaveBeenCalledTimes(1);
      expect(bigquery.deleteDay.mock.calls[0][0]).toEqual(day);
      expect(bigquery.loadDay).toHaveBeenCalledTimes(1);
      expect(bigquery.loadDay.mock.calls[0][0]).toEqual(day);
      expect(bigquery.loadDay.mock.calls[0][1]).toEqual([
        {
          feeder_podcast: 1234,
          feeder_episode: "abcd",
          bytes: 5678,
          day: "2024-05-07",
        },
      ]);
    });

    it("rolls up the latest day forward", async () => {
      const today = new Date("2024-05-07");
      const latest = new Date("2024-05-05");

      jest.useFakeTimers().setSystemTime(today);
      jest.spyOn(bigquery, "latestRollupDay").mockReturnValue(latest);
      jest.spyOn(index, "rollup").mockReturnValue(true);

      process.env.MAX_DAYS_TO_ROLLUP = 4;
      await index.handler();

      expect(index.rollup).toHaveBeenCalledTimes(3);
      expect(index.rollup.mock.calls[0][0]).toEqual(latest);
      expect(index.rollup.mock.calls[1][0]).toEqual(new Date("2024-05-06"));
      expect(index.rollup.mock.calls[2][0]).toEqual(today);
    });

    it("logs an error if we're falling behind", async () => {
      jest.spyOn(log, "info").mockReturnValue();
      jest.spyOn(log, "error").mockReturnValue();

      const today = new Date("2024-05-07");
      const latest = new Date("2024-04-24");

      jest.useFakeTimers().setSystemTime(today);
      jest.spyOn(bigquery, "latestRollupDay").mockReturnValue(latest);
      jest.spyOn(index, "rollup").mockReturnValue(true);

      process.env.MAX_DAYS_TO_ROLLUP = 4;
      await index.handler();

      expect(index.rollup).toHaveBeenCalledTimes(4);
      expect(log.error).toHaveBeenCalledTimes(1);
      expect(log.error.mock.calls[0][0]).toEqual("rollups behind");
      expect(log.error.mock.calls[0][1]).toEqual({ latest: "2024-04-27" });
    });

    it("logs an error if the day totalBytes is larger than what we queried", async () => {
      const day = new Date("2024-05-07");
      const rows = [["1234/abcd", 5678]];

      jest.spyOn(log, "info").mockReturnValue();
      jest.spyOn(log, "error").mockReturnValue();
      jest.spyOn(athena, "queryUsage").mockReturnValue(rows);
      jest.spyOn(bigquery, "totalBytes").mockReturnValue(9999);

      await index.handler({ day: "2024-05-07" });

      expect(athena.queryUsage).toHaveBeenCalledTimes(1);
      expect(athena.queryUsage.mock.calls[0][0]).toEqual(day);
      expect(bigquery.totalBytes).toHaveBeenCalledTimes(1);
      expect(bigquery.totalBytes.mock.calls[0][0]).toEqual(day);

      expect(log.error).toHaveBeenCalledTimes(1);
      expect(log.error.mock.calls[0][0]).toMatch(/bigquery total mismatch/);
    });
  });
});
