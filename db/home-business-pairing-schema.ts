/** Quantity confirmation history; never a financial or Recall projection. */
export const HOME_BUSINESS_PAIRING_SCHEMA = `
CREATE TABLE home_business_pairing_revision (
 scope_key TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision>0),
 account_id TEXT NOT NULL,
 instrument_id TEXT NOT NULL,
 fingerprint TEXT NOT NULL,
 consumed_source_sequence INTEGER NOT NULL,
 commit_sequence INTEGER NOT NULL UNIQUE,
 fact_json TEXT NOT NULL CHECK(json_valid(fact_json)),
 PRIMARY KEY(scope_key,revision)
) STRICT;
CREATE TABLE home_business_pairing_head (
 scope_key TEXT PRIMARY KEY,
 revision INTEGER NOT NULL,
 FOREIGN KEY(scope_key,revision) REFERENCES home_business_pairing_revision(scope_key,revision)
) STRICT;
CREATE TRIGGER home_business_pairing_revision_immutable_update BEFORE UPDATE ON home_business_pairing_revision
BEGIN SELECT RAISE(ABORT,'pairing revision is immutable'); END;
CREATE TRIGGER home_business_pairing_revision_immutable_delete BEFORE DELETE ON home_business_pairing_revision
BEGIN SELECT RAISE(ABORT,'pairing revision is immutable'); END;
`;
