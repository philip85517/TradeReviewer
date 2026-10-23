# Bounded request body diagnostic — hypothesis before implementation

2026-10-23; `gpt-6.1-sol / ultra`; dispatched under `CONTINUE-2026-10-23.md`.

The single hypothesis is that a natural caller consumes the original IncomingMessage before srvx's bridge, or locks/disturbs the same naturally returned Web stream before `NodeRequest._request` constructs NativeRequest. A normal `Readable.toWeb` bridge or response `_dump` is not an illegal consumer by itself. The current failure request and consumer remain unknown.

The candidate will correlate request ID, safe method/fixed route, stream identity, first Node and Web consumption boundaries, natural materializer result/throw, and response finish/close/status. Only snapshots of an already naturally returned stream are permitted. It must never read body/bodyUsed/redirect/clone to obtain state. A same-object clean-entry → actual earlier consumption → unusable stream → target synchronous throw chain can support a consumer candidate; absence, entry already bad, native-internal gaps, or the swallowed first constructor error remain OPEN.

No framework/product/dependency/configuration fix is authorized here. The only writes are new files in this directory. No service, browser, network, database, subagents, commits, or shared tracker writes. Existing no-repro and invalid evidence remain untouched; P1 formal 2/3 FAIL remains unchanged. Root reviews and alone chooses activation/reproduction.

Design choice: avoid early srvx import and global Request replacement. A temporary transparent `Object.setPrototypeOf` discovery hook recognizes the naturally evaluated srvx Request prototype using four exact function-source SHA256 fingerprints from installed srvx 0.11.15, then wraps its natural operations. This is still runtime instrumentation with identity/timing cost. It cannot see a srvx prototype loaded before installation; source drift fails closed and remains unverified. Limits: ≤60 seconds, ≤100 tracked requests, ≤1024 regular events plus one stop marker, ≤256 KiB total serialized buffer including reserved stop marker, ≤512 recoverable descriptors. Any reached limit/target throw stops new observation and restores owned descriptors before one flush.

UI/design and database acceptance are not applicable to this diagnostic artifact. Real service compatibility, original failure reproduction, actual consumer attribution, and feature acceptance remain NOT VERIFIED until root's independent evidence.
