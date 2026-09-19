import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { FxRatesClient, FxSnapshot } from "../../lib/fx/client";
import { FxRatesControl } from "./fx-rates-control";

function snapshot(overrides: Partial<FxSnapshot> = {}): FxSnapshot {
  return {
    version: 1,
    baseCurrency: "CNY",
    rates: { CNY: 1, HKD: 1.17, USD: 7.1 },
    source: {
      id: "frankfurter-ecb",
      label: "Frankfurter（ECB 参考汇率）",
      url: "https://api.frankfurter.dev",
      attributionUrl: "https://www.ecb.europa.eu",
    },
    rateDate: "2026-09-18",
    fetchedAt: "2026-09-19T10:00:00.000Z",
    lastAttemptedAt: "2026-09-19T10:00:00.000Z",
    cacheStatus: "fresh",
    ...overrides,
  };
}

afterEach(() => cleanup());

describe("FxRatesControl", () => {
  it("reads a persisted snapshot on mount without refreshing the provider", async () => {
    const client: FxRatesClient = {
      getSnapshot: vi.fn().mockResolvedValue({ snapshot: snapshot() }),
      refresh: vi.fn(),
    };

    render(<FxRatesControl client={client} />);

    expect(await screen.findByText("1 USD = 7.1000 CNY")).toBeInTheDocument();
    expect(client.getSnapshot).toHaveBeenCalledTimes(1);
    expect(client.refresh).not.toHaveBeenCalled();
  });

  it("refreshes only after the button is clicked and renders the new snapshot", async () => {
    const user = userEvent.setup();
    const onSnapshotChange = vi.fn();
    const client: FxRatesClient = {
      getSnapshot: vi.fn().mockResolvedValue({ snapshot: snapshot({ rates: { CNY: 1, HKD: 1.17, USD: 7.1 } }) }),
      refresh: vi.fn().mockResolvedValue({
        status: "fresh",
        snapshot: snapshot({ rates: { CNY: 1, HKD: 1.18, USD: 7.2 }, rateDate: "2026-09-19" }),
      }),
    };

    render(<FxRatesControl client={client} onSnapshotChange={onSnapshotChange} />);
    expect(await screen.findByText("1 USD = 7.1000 CNY")).toBeInTheDocument();
    expect(onSnapshotChange).toHaveBeenLastCalledWith(expect.objectContaining({ rateDate: "2026-09-18" }));
    await user.click(screen.getByRole("button", { name: "刷新人民币汇率" }));

    expect(client.refresh).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("1 USD = 7.2000 CNY")).toBeInTheDocument();
    expect(screen.getByText(/数据日期 2026-09-19/)).toBeInTheDocument();
    expect(onSnapshotChange).toHaveBeenLastCalledWith(expect.objectContaining({ rateDate: "2026-09-19" }));
  });

  it("keeps the old rates and marks cache status when refresh fails", async () => {
    const user = userEvent.setup();
    const client: FxRatesClient = {
      getSnapshot: vi.fn().mockResolvedValue({ snapshot: snapshot() }),
      refresh: vi.fn().mockResolvedValue({
        status: "cached",
        snapshot: snapshot({ cacheStatus: "cached", lastError: "provider unavailable" }),
        error: { code: "source-unavailable", message: "provider unavailable" },
      }),
    };

    render(<FxRatesControl client={client} />);
    await screen.findByText("1 USD = 7.1000 CNY");
    await user.click(screen.getByRole("button", { name: "刷新人民币汇率" }));

    expect(screen.getByRole("status")).toHaveTextContent("使用缓存汇率");
    expect(screen.getByText("刷新失败，仍使用已保存汇率：provider unavailable")).toBeInTheDocument();
    expect(screen.getByText("1 USD = 7.1000 CNY")).toBeInTheDocument();
  });

  it("shows an unavailable state when no snapshot exists", async () => {
    const client: FxRatesClient = {
      getSnapshot: vi.fn().mockResolvedValue({ snapshot: null }),
      refresh: vi.fn(),
    };

    render(<FxRatesControl client={client} />);

    expect(await screen.findByText("尚无汇率快照，请手动刷新")).toBeInTheDocument();
    expect(screen.getByText("暂无法折算")).toBeInTheDocument();
  });

  it("keeps a cached snapshot visible when the manual request cannot reach the API", async () => {
    const user = userEvent.setup();
    const client: FxRatesClient = {
      getSnapshot: vi.fn().mockResolvedValue({ snapshot: snapshot() }),
      refresh: vi.fn().mockRejectedValue(new Error("网络暂时不可用")),
    };

    render(<FxRatesControl client={client} />);
    await screen.findByText("1 USD = 7.1000 CNY");
    await user.click(screen.getByRole("button", { name: "刷新人民币汇率" }));

    expect(screen.getByRole("status")).toHaveTextContent("使用缓存汇率");
    expect(screen.getByRole("alert")).toHaveTextContent("网络暂时不可用");
    expect(screen.getByText("1 USD = 7.1000 CNY")).toBeInTheDocument();
  });
});
