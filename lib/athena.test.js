const athena = require("./athena");

describe("athena", () => {
  describe("query", () => {
    it("jumps through a bunch of hoops to run a query and load results", async () => {
      const commands = [];

      const client = {
        send: (cmd) => {
          commands.push(cmd);
          if (cmd.constructor.name === "StartQueryExecutionCommand") {
            return { QueryExecutionId: 1234 };
          }
          if (cmd.constructor.name === "GetQueryExecutionCommand") {
            return { QueryExecution: { Status: { State: "SUCCEEDED" } } };
          }
          if (cmd.constructor.name === "GetQueryResultsCommand") {
            const header = ["col1", "col2"];
            const row1 = ["foo", "bar"];
            return {
              ResultSet: { ResultRows: [{ Data: header }, { Data: row1 }] },
            };
          }
          throw new Error(`Unexpected command: ${cmd.constructor.name}`);
        },
      };

      jest.spyOn(athena, "client").mockReturnValue(client);

      const rows = await athena.query("SELECT foo FROM ?", ["'bar'"]);
      expect(rows).toEqual([["foo", "bar"]]);
    });
  });

  describe("queryUsage", () => {
    it("queries for cdn usage", async () => {
      const rows = [["foo", "bar"]];
      jest.spyOn(athena, "query").mockImplementation(async () => rows);

      const result = await athena.queryUsage(new Date("2024-05-03"));
      expect(result).toEqual(rows);

      expect(athena.query).toHaveBeenCalledTimes(1);
      expect(athena.query.mock.calls[0][0]).toMatch(/select regexp_replace/i);
      expect(athena.query.mock.calls[0][1]).toEqual(["'2024-05-03'"]);
    });
  });
});
