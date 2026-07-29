export type PdfTextItem = {
  text: string;
  /** Canvas-space horizontal position measured from the visual left. */
  x: number;
  /** Canvas-space baseline measured from the visual top. */
  y: number;
  width: number;
  height: number;
};

export type PdfTextPage = {
  pageNumber: number;
  width: number;
  height: number;
  items: PdfTextItem[];
};

type PdfJsRuntime = typeof import("pdfjs-dist");
type PdfDocumentOptions = NonNullable<
  Parameters<PdfJsRuntime["getDocument"]>[0]
>;

export type ExtractPdfPagesOptions = {
  /**
   * Root URL whose `pdfjs/` directory mirrors the pinned pdfjs-dist assets.
   * Production defaults to the current site's origin; tests can use a file URL.
   */
  staticAssetBaseUrl?: string;
  pdfjsLoader?: () => Promise<PdfJsRuntime>;
  /** Node-only test seam; browsers use PDF.js' DOM binary-data factory. */
  binaryDataFactory?: PdfDocumentOptions["BinaryDataFactory"];
};

function staticAssetUrls(staticAssetBaseUrl: string) {
  return {
    cMapUrl: new URL("pdfjs/cmaps/", staticAssetBaseUrl).href,
    standardFontDataUrl: new URL(
      "pdfjs/standard_fonts/",
      staticAssetBaseUrl,
    ).href,
  };
}

function browserStaticAssetBaseUrl() {
  if (typeof document === "undefined") {
    throw new Error("PDF 文本提取只能在浏览器中运行");
  }
  return new URL("/", document.baseURI).href;
}

export async function extractPdfPages(
  input: ArrayBuffer,
  options: ExtractPdfPagesOptions = {},
): Promise<PdfTextPage[]> {
  const loadPdfJs = options.pdfjsLoader ?? (() => import("pdfjs-dist"));
  const pdfjs = await loadPdfJs();

  if (!options.pdfjsLoader) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
  }

  const assets = staticAssetUrls(
    options.staticAssetBaseUrl ?? browserStaticAssetBaseUrl(),
  );

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(input),
    cMapUrl: assets.cMapUrl,
    cMapPacked: true,
    standardFontDataUrl: assets.standardFontDataUrl,
    useWorkerFetch: false,
    BinaryDataFactory: options.binaryDataFactory,
  });

  try {
    const document = await loadingTask.promise;
    const pages: PdfTextPage[] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items: PdfTextItem[] = [];

      for (const contentItem of content.items) {
        if (!("str" in contentItem)) {
          continue;
        }

        const transform = pdfjs.Util.transform(
          viewport.transform,
          contentItem.transform,
        );

        items.push({
          text: contentItem.str,
          x: transform[4],
          y: transform[5],
          width: contentItem.width * viewport.scale,
          height:
            contentItem.height * viewport.scale ||
            Math.hypot(transform[2], transform[3]),
        });
      }

      pages.push({
        pageNumber,
        width: viewport.width,
        height: viewport.height,
        items,
      });

      page.cleanup();
    }

    return pages;
  } finally {
    await loadingTask.destroy();
  }
}
