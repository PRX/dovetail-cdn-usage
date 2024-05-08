const log = require("lambda-log");
const util = require("./util");

describe("util", () => {
  describe("parseDate", () => {
    it("parses strings", () => {
      expect(util.parseDate("2022-04-05")).toEqual(new Date("2022-04-05"));
    });

    it("returns null for blank values", () => {
      expect(util.parseDate(null)).toBeNull();
      expect(util.parseDate("")).toBeNull();
    });

    it("throws errors for bad dates", () => {
      expect(() => util.parseDate("whatev")).toThrow(/invalid date input/i);
      expect(() => util.parseDate("2024-99-99")).toThrow(/invalid date input/i);
    });
  });

  describe("daysToProcess", () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date("2024-04-04"));
    });

    it("returns an array of dates", () => {
      process.env.MAX_DAYS_TO_ROLLUP = 1;
      expect(util.daysToProcess(new Date("2024-03-04T12:34:56Z"))).toEqual([
        new Date("2024-03-04"),
      ]);

      process.env.MAX_DAYS_TO_ROLLUP = 4;
      expect(util.daysToProcess(new Date("2024-03-04"))).toEqual([
        new Date("2024-03-04"),
        new Date("2024-03-05"),
        new Date("2024-03-06"),
        new Date("2024-03-07"),
      ]);
    });

    it("stops after the current day", () => {
      process.env.MAX_DAYS_TO_ROLLUP = 4;
      expect(util.daysToProcess(new Date("2024-04-03"))).toEqual([
        new Date("2024-04-03"),
        new Date("2024-04-04"),
      ]);
    });
  });

  describe("elapsed", () => {
    it("times functions", async () => {
      const [elapsed, result] = await util.elapsed(() => "foo");
      expect(elapsed).toBeGreaterThanOrEqual(0);
      expect(result).toEqual("foo");
    });
  });

  describe("parseUsage", () => {
    it("parses dovetail cdn paths", () => {
      const day = new Date("2024-03-04");
      const rows = util.parseUsage(day, [
        ["1234/some-guid", "99"],
        ["1234/another-guid", "88"],
        ["5678/my-feed/the-guid", "77"],
      ]);

      expect(rows.length).toEqual(3);
      expect(rows[0]).toEqual({
        feeder_podcast: 1234,
        feeder_episode: "some-guid",
        bytes: 99,
        day: "2024-03-04",
      });
      expect(rows[1]).toEqual({
        feeder_podcast: 1234,
        feeder_episode: "another-guid",
        bytes: 88,
        day: "2024-03-04",
      });
      expect(rows[2]).toEqual({
        feeder_podcast: 5678,
        feeder_feed: "my-feed",
        feeder_episode: "the-guid",
        bytes: 77,
        day: "2024-03-04",
      });
    });

    it("warns for unrecognized paths over 10K bytes", () => {
      jest.spyOn(log, "warn").mockImplementation(() => null);

      const day = new Date("2024-03-04");
      const rows = util.parseUsage(day, [
        ["whatev", "10001"],
        ["robots.txt", "10001"],
        ["string/string", "10001"],
        ["too/few/bytes", "9999"],
        ["not-much", "4"],
      ]);

      expect(rows.length).toEqual(0);
      expect(log.warn).toHaveBeenCalledTimes(2);
      expect(log.warn.mock.calls[0][0]).toMatch(/unrecognized uri/);
      expect(log.warn.mock.calls[1][0]).toMatch(/unrecognized uri/);
    });

    it("combines unrecognized bytes with a null episode_id", () => {
      const day = new Date("2024-03-04");
      const rows = util.parseUsage(day, [
        ["1234", "11"],
        ["1234/path/is/too/long", "22"],
        ["1234/path/is/much/too/long", "33"],
      ]);

      expect(rows.length).toEqual(1);
      expect(rows[0]).toEqual({
        feeder_podcast: 1234,
        bytes: 66,
        day: "2024-03-04",
      });
    });
  });
});
