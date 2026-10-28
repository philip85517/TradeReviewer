export function fingerprintBytes(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;

  for (const byte of bytes) {
    first = Math.imul(first ^ byte, 0x01000193);
    second = Math.imul(second ^ (byte + first), 0x85ebca6b);
  }

  return [first, second]
    .map((value) => (value >>> 0).toString(16).padStart(8, "0"))
    .join("");
}

/** Original bytes only; filenames and the legacy reconciliation fingerprint are independent. */
export type FileContentIdentity = { sha256: string; byteLength: number };
export async function identifyFileContent(bytes: Uint8Array): Promise<FileContentIdentity> {
  const digest = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes).buffer);
  return { sha256: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join(""), byteLength: bytes.byteLength };
}
export function validFileContentIdentity(value: unknown): value is FileContentIdentity {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const identity = value as Record<string, unknown>;
  return typeof identity.sha256 === "string" && /^[a-f0-9]{64}$/.test(identity.sha256)
    && Number.isSafeInteger(identity.byteLength) && Number(identity.byteLength) > 0;
}
