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
});
