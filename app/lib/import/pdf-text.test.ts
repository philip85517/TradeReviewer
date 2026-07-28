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
    expect(pdfjs.destroy).toHaveBeenCalledOnce();
  });
});
