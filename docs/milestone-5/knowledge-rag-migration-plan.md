# Milestone 5 Knowledge/RAG Migration Plan

## Scope

Milestone 5 introduces the first persistent local knowledge index for Hermes Local AI Studio.

## New persistent format

Knowledge data is stored under:

```text
knowledge/
  knowledge-registry.json
```

`knowledge-registry.json` uses `schemaVersion: 1` and contains:

- knowledge base summaries
- document metadata
- extracted text chunk metadata
- recent retrieval results
- retrieval evaluation summaries

No source document bytes are copied into the registry. Chunks contain extracted text snippets only and preserve the original source path, content hash, line range, and document name for citations.

## Migration behavior

- If `knowledge/knowledge-registry.json` does not exist, Studio synthesizes an empty in-memory state.
- The registry is written only after a base is saved, files are explicitly ingested, retrieval is run, or evaluation is run.
- Future schema upgrades must add a migrator that reads prior schema versions and writes a new registry atomically through a temporary file.

## Extraction boundaries

Milestone 5 indexes text-like files only:

- Markdown
- TXT
- CSV
- JSON
- YAML
- HTML
- source code and scripts

Binary PDF, Office, OCR, audio, and video extraction remain behind the same contracts for future extractor services. Unsupported files are reported as rejected rather than silently indexed.

## Safety

- Retrieved document content is untrusted data.
- Retrieval never executes instructions found inside documents.
- The first index format stores no secrets intentionally and does not scan broad folders by default.
- Files are ingested only when explicitly selected or passed to the ingestion API.
- Per-file extraction is capped to prevent accidental large-file indexing in this milestone.
