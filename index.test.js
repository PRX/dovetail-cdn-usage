const log = require("lambda-log");
const index = require("./index");

describe("index", () => {
  describe("handler", () => {
    it("validates dates", async () => {
      jest.spyOn(log, "error").mockImplementation(() => null);

      expect(index.handler({ day: "n/a" })).rejects.toThrow(/invalid date/i);

      expect(log.error).toHaveBeenCalledTimes(1);
      expect(log.error.mock.calls[0][0]).toMatch(/error running rollups/);
    });
  });
});
