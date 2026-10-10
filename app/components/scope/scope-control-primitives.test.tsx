import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ScopeChoiceGroup } from "./scope-control-primitives";

it("moves and selects horizontal tabs with arrows, Home, and End", () => {
  const onChange = vi.fn();
  render(<ScopeChoiceGroup mode="tabs" ariaLabel="市场" value="all" onChange={onChange} options={[{ value: "all", label: "总体" }, { value: "hk", label: "港股" }, { value: "us", label: "美股" }]} />);
  const tabs = screen.getAllByRole("tab");
  tabs[0].focus();
  fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
  expect(onChange).toHaveBeenCalledWith("hk");
  expect(document.activeElement).toBe(tabs[1]);
  fireEvent.keyDown(tabs[1], { key: "End" });
  expect(onChange).toHaveBeenLastCalledWith("us");
  expect(document.activeElement).toBe(tabs[2]);
  fireEvent.keyDown(tabs[2], { key: "Home" });
  expect(onChange).toHaveBeenLastCalledWith("all");
  expect(document.activeElement).toBe(tabs[0]);
});

it("keeps segmented controls out of tab keyboard behavior", () => {
  const onChange = vi.fn();
  render(<ScopeChoiceGroup mode="segmented" ariaLabel="市场" value="all" onChange={onChange} options={[{ value: "all", label: "总体" }, { value: "us", label: "美股" }]} />);
  fireEvent.keyDown(screen.getByRole("button", { name: "总体" }), { key: "ArrowRight" });
  expect(onChange).not.toHaveBeenCalled();
});
