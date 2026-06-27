# Milestone 6 Memory, Skills, and Learning Queue Migration Plan

## Scope

Milestone 6 introduces the first persistent extended learning registry for Hermes Local AI Studio.

## New persistent format

Learning data is stored under:

```text
learning/
  learning-registry.json
```

`learning-registry.json` uses `schemaVersion: 1` and contains:

- proposed memory candidates
- approved extended memory items
- proposed skill candidates
- approved skill records
- skill versions and active version pointers
- review and rollback events

## Approval behavior

- Proposed memory and skill candidates are stored as pending queue items.
- Approved memory candidates create extended memory records.
- Rejected memory candidates do not create memory records.
- Approved skill candidates create a new skill or append a new skill version.
- Rejected skill candidates do not create skill records.
- No candidate is promoted automatically.

## Provenance

Every candidate, approved memory item, skill item, and skill version stores provenance:

- source kind
- source id
- profile id
- project id
- note
- created timestamp

## Migration behavior

- If `learning/learning-registry.json` does not exist, Studio synthesizes an empty in-memory state.
- Registry writes are atomic through a temporary file and rename.
- Future schema upgrades must add a migrator that reads prior schema versions and writes a new registry atomically.

## Safety

- Credentials and MFA details must not be stored in memory or skills.
- Candidate content is treated as untrusted until reviewed.
- Memory and skill write approval remains enabled.
- Rollback changes only the active skill version pointer; it does not delete old versions.
