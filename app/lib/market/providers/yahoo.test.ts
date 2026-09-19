import { describe, expect, it } from "vitest";

import { YahooProvider } from "./yahoo";

function unixSeconds(value: string) {
  return Date.parse(value) / 1000;
}

describe("Yahoo provider", () => {
  it("keeps in-range 518880.SS hourly bars from a response with an extra quote", async () => {
    let requestedUrl: URL | undefined;
    const response = {
      chart: {
        result: [
          {
            meta: { symbol: "518880.SS" },
            timestamp: [
              unixSeconds("2024-11-19T01:30:00.000Z"),
              unixSeconds("2024-11-19T02:30:00.000Z"),
              unixSeconds("2024-11-19T03:30:00.000Z"),
              unixSeconds("2024-11-19T04:30:00.000Z"),
              unixSeconds("2024-11-19T05:30:00.000Z"),
              unixSeconds("2024-11-19T06:30:00.000Z"),
              unixSeconds("2026-09-15T07:00:00.000Z"),
            ],
            indicators: {
              quote: [
                {
                  open: [
                    5.8119997978,
                    5.8350000381,
                    5.8480000496,
                    5.8460001945,
                    5.8470001221,
                    5.8429999351,
                    9.1,
                  ],
                  high: [
                    5.8390002251,
                    5.8499999046,
                    5.8480000496,
                    5.8480000496,
                    5.8480000496,
                    5.8600001335,
                    9.2,
                  ],
                  low: [
                    5.8090000153,
                    5.8319997787,
                    5.8480000496,
                    5.8400001526,
                    5.8410000801,
                    5.8410000801,
                    9,
                  ],
                  close: [
                    5.8359999657,
                    5.8480000496,
                    5.8480000496,
                    5.8480000496,
                    5.8420000076,
                    5.8590002060,
                    9.15,
                  ],
                  volume: [0, 108111100, 2200, 29149100, 67821600, 55938300, 1],
                },
              ],
            },
          },
        ],
        error: null,
      },
    };

    const result = await new YahooProvider().fetchIntraday(
      {
        instrumentId: "CN-SH:518880",
        symbol: "518880",
        market: "CN-SH",
        interval: "1h",
        startTime: "2024-11-18T16:00:00.000Z",
        endTime: "2024-11-19T16:00:00.000Z",
      },
      async (input) => {
        requestedUrl = new URL(String(input));
        return Response.json(response);
      },
    );

    expect(requestedUrl?.host).toBe("query1.finance.yahoo.com");
    expect(requestedUrl?.pathname).toContain("518880.SS");
    expect(requestedUrl?.searchParams.get("interval")).toBe("1h");
    expect(result.candles).toHaveLength(6);
    expect(result.candles[0]).toMatchObject({
      timestamp: "2024-11-19T01:30:00.000Z",
      open: "5.8119997978",
      high: "5.8390002251",
      low: "5.8090000153",
      close: "5.8359999657",
      volume: "0",
    });
    expect(result.candles.at(-1)).toMatchObject({
      timestamp: "2024-11-19T06:30:00.000Z",
      close: "5.859000206",
    });
  });

  it("classifies Yahoo's explicit 730-day hourly limit as provider-history-limit", async () => {
    const hosts: string[] = [];
    const description =
      "1h data not available for startTime=1687219200 and endTime=1687305600. The requested range must be within the last 730 days.";

    await expect(
      new YahooProvider().fetchIntraday(
        {
          instrumentId: "CN-SZ:000519",
          symbol: "000519",
          market: "CN-SZ",
          interval: "1h",
          startTime: "2023-06-19T16:00:00.000Z",
          endTime: "2023-06-20T16:00:00.000Z",
        },
        async (input) => {
          hosts.push(new URL(String(input)).host);
          return Response.json(
            {
              chart: {
                result: null,
                error: { code: "Unprocessable Entity", description },
              },
            },
            { status: 422 },
          );
        },
      ),
    ).rejects.toMatchObject({
      code: "provider-history-limit",
      status: 422,
      message: expect.stringContaining("730 days"),
    });

    expect(hosts).toEqual(["query1.finance.yahoo.com"]);
  });
});
