import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { extractPdfPages } from "./pdf-text";

const pdfjs = vi.hoisted(() => ({
  destroy: vi.fn<() => Promise<void>>(),
  getDocument: vi.fn(),
}));

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  Util: { transform: vi.fn() },
  getDocument: pdfjs.getDocument,
}));

class FileBinaryDataFactory {
  private readonly urls: Record<string, string | null | undefined>;

  constructor(urls: Record<string, string | null | undefined>) {
    this.urls = urls;
  }

  async fetch({
    kind,
    filename,
  }: {
    kind: "cMapUrl" | "standardFontDataUrl" | "wasmUrl";
    filename: string;
  }) {
    const baseUrl = this.urls[kind];
    if (!baseUrl) throw new Error(`Missing ${kind}`);
    return new Uint8Array(await readFile(new URL(filename, baseUrl)));
  }
}

function predefinedCMapPdf() {
  const content = "BT /F1 16 Tf 40 100 Td <62DB5546> Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    [
      "<< /Type /Page /Parent 2 0 R",
      "/MediaBox [0 0 300 160]",
      "/Resources << /Font << /F1 4 0 R >> >>",
      "/Contents 6 0 R >>",
    ].join(" "),
    [
      "<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light",
      "/Encoding /UniGB-UCS2-H /DescendantFonts [5 0 R] >>",
    ].join(" "),
    [
      "<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light",
      "/CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 4 >>",
      "/DW 1000 >>",
    ].join(" "),
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let source = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(source.length);
    source += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = source.length;
  source += `xref\n0 ${objects.length + 1}\n`;
  source += "0000000000 65535 f \n";
  source += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  source += [
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF",
  ].join("\n");
  return new TextEncoder().encode(source).buffer;
}

describe("extractPdfPages", () => {
  beforeEach(() => {
    pdfjs.destroy.mockReset();
    pdfjs.destroy.mockResolvedValue(undefined);
    pdfjs.getDocument.mockReset();
  });

  it("destroys the loading task when initial PDF loading rejects", async () => {
    pdfjs.getDocument.mockReturnValue({
      destroy: pdfjs.destroy,
      promise: Promise.reject(new Error("corrupt PDF")),
    });

    await expect(extractPdfPages(new ArrayBuffer(8))).rejects.toThrow(
      "corrupt PDF",
    );
    expect(pdfjs.getDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        cMapUrl: expect.stringMatching(/\/pdfjs\/cmaps\/$/),
        cMapPacked: true,
        standardFontDataUrl: expect.stringMatching(
          /\/pdfjs\/standard_fonts\/$/,
        ),
        useWorkerFetch: false,
      }),
    );
    expect(pdfjs.destroy).toHaveBeenCalledOnce();
  });

  it("extracts positioned text from a PDF that requires a predefined CMap", async () => {
    const staticAssetBaseUrl = pathToFileURL(
      `${path.join(process.cwd(), "public")}/`,
    ).href;

    const pages = await extractPdfPages(predefinedCMapPdf(), {
      staticAssetBaseUrl,
      pdfjsLoader: () => import("pdfjs-dist/legacy/build/pdf.mjs"),
      binaryDataFactory: FileBinaryDataFactory,
    });

    expect(pages).toHaveLength(1);
    expect(pages[0].items.map((item) => item.text).join("")).toContain(
      "招商",
    );
    expect(pages[0].items[0]).toEqual(
      expect.objectContaining({
        x: expect.any(Number),
        y: expect.any(Number),
        width: expect.any(Number),
        height: expect.any(Number),
      }),
    );
  });
});
