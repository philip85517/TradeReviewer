import type {
  OcrImageResult,
  OcrTextLine,
} from "../contracts";

export function ocrLine(
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  score = 0.96,
): OcrTextLine {
  return Object.freeze({
    text,
    score,
    polygon: Object.freeze([
      Object.freeze({ x, y }),
      Object.freeze({ x: x + width, y }),
      Object.freeze({ x: x + width, y: y + height }),
      Object.freeze({ x, y: y + height }),
    ]) as unknown as OcrTextLine["polygon"],
    sourceBounds: Object.freeze({ x, y, width, height }),
  });
}

export function image(
  imageId: string,
  width: number,
  height: number,
  lines: OcrTextLine[],
): OcrImageResult {
  return Object.freeze({
    imageId,
    width,
    height,
    lines: Object.freeze([...lines]) as unknown as OcrTextLine[],
  });
}

export const FUTU_SCREENSHOT_OCR: OcrImageResult = image(
  "futu-1",
  1_220,
  2_000,
  [
    ocrLine("订单记录", 42, 110, 180, 30),
    ocrLine("FUTU HK · 4321", 470, 190, 210, 24),
    ocrLine("订单状态", 20, 310, 150, 22),
    ocrLine("名称/代码", 245, 310, 180, 22),
    ocrLine("数量/价格", 760, 310, 180, 22),
    ocrLine("成交时间", 1_020, 310, 170, 22),
    ocrLine("卖出", 20, 390, 80, 24),
    ocrLine("全部成交", 20, 425, 120, 20),
    ocrLine("思摩尔国际", 245, 390, 180, 24),
    ocrLine("06969", 245, 425, 100, 20),
    ocrLine("4,000", 800, 390, 100, 24),
    ocrLine("市价", 800, 425, 80, 20),
    ocrLine("24/06/05", 1_025, 390, 130, 22),
    ocrLine("14:39:25", 1_025, 425, 130, 22),
    ocrLine("买入", 20, 530, 80, 24),
    ocrLine("全部成交", 20, 565, 120, 20),
    ocrLine("腾讯控股", 245, 530, 180, 24),
    ocrLine("00700", 245, 565, 100, 20),
    ocrLine("200", 800, 530, 100, 24),
    ocrLine("381.40", 800, 565, 100, 20),
    ocrLine("24/06/05", 1_025, 530, 130, 22),
    ocrLine("14:41:08", 1_025, 565, 130, 22),
    ocrLine("免责声明", 42, 1_920, 140, 22),
  ],
);

export const TIGER_SCREENSHOT_OCR: OcrImageResult = image(
  "tiger-1",
  1_220,
  2_000,
  [
    ocrLine("订单历史", 42, 110, 180, 30),
    ocrLine("Tiger Brokers · U6789", 430, 190, 300, 24),
    ocrLine("方向", 20, 310, 100, 22),
    ocrLine("名称/代码", 180, 310, 180, 22),
    ocrLine("成交数量", 600, 310, 150, 22),
    ocrLine("成交价格", 780, 310, 150, 22),
    ocrLine("成交时间", 1_000, 310, 170, 22),
    ocrLine("买入", 20, 390, 80, 24),
    ocrLine("NVIDIA", 180, 390, 180, 24),
    ocrLine("NVDA", 180, 425, 100, 20),
    ocrLine("10", 620, 390, 80, 24),
    ocrLine("120.50", 800, 390, 100, 24),
    ocrLine("2024/06/05", 1_010, 390, 150, 22),
    ocrLine("14:39:25", 1_010, 425, 130, 22),
    ocrLine("卖出", 20, 530, 80, 24),
    ocrLine("APPLE", 180, 530, 180, 24),
    ocrLine("AAPL", 180, 565, 100, 20),
    ocrLine("5", 620, 530, 80, 24),
    ocrLine("I2.O5", 800, 530, 100, 24, 0.72),
    ocrLine("2024/06/05", 1_010, 530, 150, 22),
    ocrLine("14:39:25", 1_010, 565, 130, 22),
    ocrLine("首页 订单 行情", 42, 1_900, 300, 22),
  ],
);
