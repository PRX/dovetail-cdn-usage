const log = require("lambda-log");
const util = require("./util");

describe("util", () => {
  describe("parseDate", () => {
    test("parses strings", () => {
      expect(util.parseDate("2022-04-05")).toEqual(new Date("2022-04-05"));
    });

    test("returns null for blank values", () => {
      expect(util.parseDate(null)).toBeNull();
      expect(util.parseDate("")).toBeNull();
    });

    test("throws errors for bad dates", () => {
      expect(() => util.parseDate("whatev")).toThrow(/invalid date input/i);
      expect(() => util.parseDate("2024-99-99")).toThrow(/invalid date input/i);
    });
  });

  describe("daysToProcess", () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date("2024-04-04"));
    });

    test("returns an array of dates", () => {
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

    test("stops after the current day", () => {
      process.env.MAX_DAYS_TO_ROLLUP = 4;
      expect(util.daysToProcess(new Date("2024-04-03"))).toEqual([
        new Date("2024-04-03"),
        new Date("2024-04-04"),
      ]);
    });
  });

  describe("elapsed", () => {
    test("times functions", async () => {
      const [elapsed, result] = await util.elapsed(() => "foo");
      expect(elapsed).toBeGreaterThanOrEqual(0);
      expect(result).toEqual("foo");
    });
  });

  describe("parseUsage", () => {
    test("parses dovetail cdn paths", () => {
      const day = new Date("2024-03-04");
      const rows = util.parseUsage(day, [
        ["1234/some-guid", "99"],
        ["1234/another-guid", "88"],
        ["5678/my-feed/the-guid", "77"],
      ]);

      expect(rows.length).toEqual(3);
      expect(rows[0]).toEqual({
        podcast_id: 1234,
        episode_id: "some-guid",
        bytes: 99,
        day,
      });
      expect(rows[1]).toEqual({
        podcast_id: 1234,
        episode_id: "another-guid",
        bytes: 88,
        day,
      });
      expect(rows[2]).toEqual({
        podcast_id: 5678,
        feed_slug: "my-feed",
        episode_id: "the-guid",
        bytes: 77,
        day,
      });
    });

    test("warns for unrecognized paths", () => {
      jest.spyOn(log, "warn").mockImplementation(() => null);

      const day = new Date("2024-03-04");
      const rows = util.parseUsage(day, [
        ["whatev", "99"],
        ["robots.txt", "88"],
        ["string/string", "77"],
      ]);

      expect(rows.length).toEqual(0);
      expect(log.warn).toHaveBeenCalledTimes(2);
      expect(log.warn.mock.calls[0][0]).toMatch(/unrecognized uri/);
      expect(log.warn.mock.calls[1][0]).toMatch(/unrecognized uri/);
    });
  });
});
