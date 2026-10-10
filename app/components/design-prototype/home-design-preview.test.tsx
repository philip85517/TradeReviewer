import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { HomeDesignPreview } from "./home-design-preview";

afterEach(cleanup);

function StatefulChild() {
  const [count, setCount] = useState(0);
  return <button type="button" onClick={() => setCount(value => value + 1)}>子状态 {count}</button>;
}

it("switches the outer variant while preserving the mounted child state", () => {
  render(
    <HomeDesignPreview>
      <StatefulChild />
    </HomeDesignPreview>,
  );

  fireEvent.click(screen.getByRole("button", { name: "子状态 0" }));
  expect(screen.getByRole("button", { name: "子状态 1" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "现有首页" }));
  expect(screen.getByRole("button", { name: "子状态 1" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "现有首页" })).toHaveAttribute("aria-pressed", "true");

  fireEvent.click(screen.getByRole("button", { name: "视觉调整" }));
  expect(screen.getByRole("button", { name: "子状态 1" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "视觉调整" })).toHaveAttribute("aria-pressed", "true");
});
