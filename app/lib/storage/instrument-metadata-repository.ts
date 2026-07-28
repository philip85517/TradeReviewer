import type { ResolvedInstrument } from "../instruments/metadata-contracts";

export type StoredInstrumentMetadata = ResolvedInstrument & {
  instrumentId: string;
};

export interface InstrumentMetadataRepository {
  get(instrumentId: string): Promise<ResolvedInstrument | undefined>;
  getMany(
    instrumentIds: string[],
  ): Promise<Map<string, ResolvedInstrument>>;
  put(record: ResolvedInstrument): Promise<void>;
}
