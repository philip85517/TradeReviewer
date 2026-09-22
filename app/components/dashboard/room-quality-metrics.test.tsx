import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RoomQualityMetrics } from "./room-quality-metrics";

describe("RoomQualityMetrics", () => {
  it("is collapsed and explains an empty trusted sample", () => {
    render(<RoomQualityMetrics rows={[]} />);
    const details = screen.getByTestId("room-quality-metrics");
    expect(details).not.toHaveAttribute("open");
    details.querySelector("summary")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(screen.getByText("当前没有可用的可信回合样本。")).toBeInTheDocument();
  });
});
