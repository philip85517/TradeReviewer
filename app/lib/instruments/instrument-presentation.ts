import {
  validateLocalizedInstrumentName,
} from "./metadata-contracts";
import type { Instrument } from "../trades/types";

const HAN_CHARACTER = /\p{Script=Han}/u;

export type InstrumentPresentation = {
  primaryName: string;
  originalName: string;
  secondaryName: string;
  searchText: string;
  hasChineseName: boolean;
};

export function instrumentPresentation(
  instrument: Instrument,
): InstrumentPresentation {
  const originalName = instrument.name;
  let localizedName: string | undefined;
  try {
    localizedName = instrument.localizedName
      ? validateLocalizedInstrumentName(instrument.localizedName).name
      : undefined;
  } catch {
    localizedName = undefined;
  }
  const primaryName = localizedName ?? originalName;
  const secondaryName = `${instrument.symbol} · ${instrument.market}`;
  const searchText = [
    primaryName,
    originalName,
    instrument.symbol,
    instrument.market,
  ]
    .filter(Boolean)
    .join(" ");
  return {
    primaryName,
    originalName,
    secondaryName,
    searchText,
    hasChineseName: localizedName !== undefined || HAN_CHARACTER.test(originalName),
  };
}
