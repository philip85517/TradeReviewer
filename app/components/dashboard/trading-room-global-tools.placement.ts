export type NotificationPanelPlacementInput = {
  visibleTop: number;
  visibleBottom: number;
  triggerTop: number;
  triggerBottom: number;
  containingBlockTop: number;
  preferredHeight: number;
};

export type NotificationPanelPlacement = {
  side: "below" | "above";
  top: number;
  maxHeight: number;
};

export function resolveNotificationPanelPlacement({
  visibleTop,
  visibleBottom,
  triggerTop,
  triggerBottom,
  containingBlockTop,
  preferredHeight,
}: NotificationPanelPlacementInput): NotificationPanelPlacement {
  const gap = 9;
  const bottomInset = 8;
  const contentHeight = Math.max(0, preferredHeight);
  const belowTop = triggerBottom + gap;
  const availableBelow = Math.max(0, visibleBottom - belowTop - bottomInset);
  const aboveBottom = triggerTop - gap;
  const availableAbove = Math.max(0, aboveBottom - visibleTop);
  const belowFits = contentHeight === 0 || contentHeight <= availableBelow;
  const aboveFits = contentHeight === 0 || contentHeight <= availableAbove;
  const useAbove = !belowFits && (aboveFits || availableAbove > availableBelow);

  if (useAbove) {
    const maxHeight = contentHeight > 0
      ? Math.min(contentHeight, availableAbove)
      : availableAbove;
    return {
      side: "above",
      top: aboveBottom - maxHeight - containingBlockTop,
      maxHeight,
    };
  }

  return {
    side: "below",
    top: belowTop - containingBlockTop,
    maxHeight: contentHeight > 0 ? Math.min(contentHeight, availableBelow) : availableBelow,
  };
}
