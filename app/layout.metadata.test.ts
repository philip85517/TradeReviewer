import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist-sans" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono" }),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

import { headers } from "next/headers";
import { generateMetadata } from "./layout";

const headersMock = vi.mocked(headers);
type RequestHeaders = Awaited<ReturnType<typeof headers>>;

function mockRequestHeaders(values: Record<string, string>): void {
  const normalized = new Map(
    Object.entries(values).map(([key, value]) => [key.toLowerCase(), value]),
  );
  headersMock.mockResolvedValue({
    get(name: string) {
      return normalized.get(name.toLowerCase()) ?? null;
    },
  } as RequestHeaders);
}

function metadataBaseHref(metadata: Awaited<ReturnType<typeof generateMetadata>>): string {
  expect(metadata.metadataBase).toBeInstanceOf(URL);
  return metadata.metadataBase?.toString() ?? "";
}

afterEach(() => {
  headersMock.mockReset();
});

describe("generateMetadata metadata base", () => {
  it.each([
    ["localhost:3038", "http://localhost:3038/"],
    ["127.0.0.1:3038", "http://127.0.0.1:3038/"],
    ["[::1]:3038", "http://[::1]:3038/"],
  ])("uses HTTP for a direct loopback host %s", async (host, expectedBase) => {
    mockRequestHeaders({ host });

    const metadata = await generateMetadata();

    expect(metadataBaseHref(metadata)).toBe(expectedBase);
    expect(metadata.openGraph?.images).toEqual([
      { url: `${expectedBase}og.png`, width: 1731, height: 909 },
    ]);
    expect(metadata.twitter?.images).toEqual([`${expectedBase}og.png`]);
  });

  it("uses the safe HTTPS fallback for an external host", async () => {
    mockRequestHeaders({ host: "preview.example.test:8443" });

    const metadata = await generateMetadata();

    expect(metadataBaseHref(metadata)).toBe("https://preview.example.test:8443/");
  });

  it.each([
    ["127.0.0.1:3038", "http", "http://127.0.0.1:3038/"],
    ["preview.example.test:8443", "https", "https://preview.example.test:8443/"],
  ])("honors an explicit forwarded protocol for %s", async (host, protocol, expectedBase) => {
    mockRequestHeaders({ host, "x-forwarded-proto": protocol });

    const metadata = await generateMetadata();

    expect(metadataBaseHref(metadata)).toBe(expectedBase);
  });

  it("uses the forwarded host while preserving its port", async () => {
    mockRequestHeaders({
      host: "127.0.0.1:3038",
      "x-forwarded-host": "preview.example.test:9443",
    });

    const metadata = await generateMetadata();

    expect(metadataBaseHref(metadata)).toBe("https://preview.example.test:9443/");
  });

  it("keeps the existing HTTP default when no host headers are present", async () => {
    mockRequestHeaders({});

    const metadata = await generateMetadata();

    expect(metadataBaseHref(metadata)).toBe("http://localhost:3000/");
  });
});
