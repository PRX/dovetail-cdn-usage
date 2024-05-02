import { parseDate } from "./util";

describe("util", () => {
  describe("parseDate", () => {
    test("parses strings", () => {
      expect(parseDate("2022-04-05")).toEqual(new Date("2022-04-05"));
      expect(parseDate(["2022-04-05"])).toEqual([new Date("2022-04-05")]);
    });

    test("returns null for blank values", () => {
      expect(parseDate(null)).toBeNull();
      expect(parseDate("")).toBeNull();
      expect(parseDate([""])).toEqual([null]);
    });

    test("throws errors for bad dates", () => {
      expect(() => parseDate("whatev")).toThrow(/invalid date input/i);
      expect(() => parseDate(["whatev"])).toThrow(/invalid date input/i);
      expect(() => parseDate("2024-99-99")).toThrow(/invalid date input/i);
    });
  });
});
