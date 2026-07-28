export type PdfTextItem = {
  text: string;
  x: number;
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

export async function extractPdfPages(input: ArrayBuffer): Promise<PdfTextPage[]> {
  const pdfjs = await import("pdfjs-dist");

  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(input) });
  const document = await loadingTask.promise;

  try {
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
