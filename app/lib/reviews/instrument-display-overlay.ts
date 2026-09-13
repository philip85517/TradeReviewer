import type { ResolvedInstrument } from "../instruments/metadata-contracts";
import type { InstrumentTradeSummary } from "../trades/instruments";
import type { StoredInstrument } from "../storage/sqlite-contracts";

function localizedNameOf(instrument: StoredInstrument) {
  return instrument.localizedName ?? instrument.metadata?.localizedName;
}

/**
 * Adds cached localized display metadata to library summaries without changing
 * the execution objects or their canonical/original names.
 */
export function overlayStoredInstrumentMetadata(
  summaries: InstrumentTradeSummary[],
  storedInstruments: StoredInstrument[],
) {
  const storedById = new Map(storedInstruments.map((instrument) => [instrument.id, instrument]));
  return summaries.map((summary) => {
    const stored = storedById.get(summary.instrument.id);
    const localizedName = stored && localizedNameOf(stored);
    return localizedName
      ? {
          ...summary,
          instrument: {
            ...summary.instrument,
            localizedName,
          },
        }
      : summary;
  });
}

export function localizedInstrumentOverlay(
  instrument: StoredInstrument,
  metadata: Pick<ResolvedInstrument, "localizedName">,
): StoredInstrument {
  return metadata.localizedName
    ? { ...instrument, localizedName: metadata.localizedName }
    : instrument;
}
