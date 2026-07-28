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
