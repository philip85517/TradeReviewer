import { describe, expect, it } from "vitest";

import { fingerprintBytes } from "./file-fingerprint";

describe("fingerprintBytes", () => {
  it("returns the same ID for identical bytes", () => {
    expect(fingerprintBytes(new Uint8Array([1, 2, 3, 4]))).toBe(
      fingerprintBytes(new Uint8Array([1, 2, 3, 4])),
    );
  });

  it("returns a different ID when one byte changes", () => {
    expect(fingerprintBytes(new Uint8Array([1, 2, 3, 4]))).not.toBe(
      fingerprintBytes(new Uint8Array([1, 2, 3, 5])),
    );
  });
});
