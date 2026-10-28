import { describe, expect, it } from "vitest";

import {
  fingerprintBytes,
  identifyFileContent,
  validFileContentIdentity,
} from "./file-fingerprint";

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

  it("uses the same bytes from an ArrayBuffer and a Uint8Array view", () => {
    const buffer = new Uint8Array([1, 2, 3, 4]).buffer;
    const view = new Uint8Array([99, 1, 2, 3, 4, 99]).subarray(1, 5);

    expect(fingerprintBytes(buffer)).toBe(fingerprintBytes(view));
  });
});

describe("original file content identity", () => {
  it("hashes only the selected byte view using SHA-256", async () => {
    const selectedBytes = new Uint8Array([0, 97, 98, 99, 255]).subarray(1, 4);

    const identity = await identifyFileContent(selectedBytes);

    expect(identity).toEqual({
      sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      byteLength: 3,
    });
    expect(validFileContentIdentity(identity)).toBe(true);
  });

  it("does not accept an empty file digest as a successful original file identity", async () => {
    const identity = await identifyFileContent(new Uint8Array());

    expect(identity).toEqual({
      sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      byteLength: 0,
    });
    expect(validFileContentIdentity(identity)).toBe(false);
  });

  it.each([
    null,
    "not-an-identity",
    [],
    { sha256: "a".repeat(63), byteLength: 3 },
    { sha256: "A".repeat(64), byteLength: 3 },
    { sha256: "g".repeat(64), byteLength: 3 },
    { sha256: 123, byteLength: 3 },
    { sha256: "a".repeat(64), byteLength: "3" },
    { sha256: "a".repeat(64), byteLength: -1 },
    { sha256: "a".repeat(64), byteLength: 1.5 },
    { sha256: "a".repeat(64), byteLength: Number.MAX_SAFE_INTEGER + 1 },
  ])("rejects malformed or unsafe persisted identity %#", (value) => {
    expect(validFileContentIdentity(value)).toBe(false);
  });
});
