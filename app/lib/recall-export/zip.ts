import type { RecallExportManifest } from "./types";

const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  let result = value;
  for (let bit = 0; bit < 8; bit += 1) {
    result = (result & 1) === 1 ? 0xedb88320 ^ (result >>> 1) : result >>> 1;
  }
  return result >>> 0;
});

function crc32(bytes: readonly number[]) {
  let result = 0xffffffff;
  for (const byte of bytes) {
    result = CRC_TABLE[(result ^ byte) & 0xff] ^ (result >>> 8);
  }
  return (result ^ 0xffffffff) >>> 0;
}

function write16(target: number[], value: number) {
  target.push(value & 0xff, (value >>> 8) & 0xff);
}

function write32(target: number[], value: number) {
  target.push(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  );
}

function append(target: number[], values: readonly number[]) {
  for (const value of values) target.push(value);
}

function utf8(value: string) {
  return Array.from(new TextEncoder().encode(value));
}

function assertZipLength(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error(`ZIP ${label} 超出格式支持的大小`);
  }
}

/**
 * Build a dependency-free stored ZIP. Entries are UTF-8 and carry the UTF-8
 * flag so Chinese folder and document names survive extraction.
 */
export function buildRecallZip(manifest: RecallExportManifest) {
  if (manifest.files.length > 0xffff) {
    throw new Error("ZIP 文件数量超出格式支持的数量");
  }
  const output: number[] = [];
  const central: number[] = [];
  const root = `${manifest.folderName}/`;

  for (const file of manifest.files) {
    const name = utf8(`${root}${file.path}`);
    const bytes = file.bytes;
    const crc = crc32(bytes);
    const offset = output.length;
    assertZipLength(name.length, "文件名");
    assertZipLength(bytes.length, "文件");
    assertZipLength(offset, "偏移");

    write32(output, 0x04034b50);
    write16(output, 20);
    write16(output, 0x0800);
    write16(output, 0);
    write16(output, 0);
    write16(output, 0);
    write32(output, crc);
    write32(output, bytes.length);
    write32(output, bytes.length);
    write16(output, name.length);
    write16(output, 0);
    append(output, name);
    append(output, bytes);

    write32(central, 0x02014b50);
    write16(central, 20);
    write16(central, 20);
    write16(central, 0x0800);
    write16(central, 0);
    write16(central, 0);
    write16(central, 0);
    write32(central, crc);
    write32(central, bytes.length);
    write32(central, bytes.length);
    write16(central, name.length);
    write16(central, 0);
    write16(central, 0);
    write16(central, 0);
    write16(central, 0);
    write32(central, 0);
    write32(central, offset);
    append(central, name);
  }

  const centralOffset = output.length;
  const centralLength = central.length;
  assertZipLength(centralOffset, "中央目录偏移");
  assertZipLength(centralLength, "中央目录");
  append(output, central);
  write32(output, 0x06054b50);
  write16(output, 0);
  write16(output, 0);
  write16(output, manifest.files.length);
  write16(output, manifest.files.length);
  write32(output, centralLength);
  write32(output, centralOffset);
  write16(output, 0);

  return Uint8Array.from(output);
}

export function createRecallZipBlob(manifest: RecallExportManifest) {
  const bytes = buildRecallZip(manifest);
  return new Blob([bytes.buffer as ArrayBuffer], { type: "application/zip" });
}
