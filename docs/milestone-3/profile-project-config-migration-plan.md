# Milestone 3 Profile, Project, and Config Migration Plan

## Scope

Milestone 3 introduces Studio-managed metadata for projects while preserving existing profile files and Hermes configuration.

## Persistent Formats

- Profiles remain directory-based under `profiles/<profile-id>/`.
- Profile text files remain Markdown:
  - `SOUL.md`
  - `USER.md`
  - `MEMORY.md`
- Profile isolation folders are created under each profile directory:
  - `knowledge/`
  - `sessions/`
  - `tools/`
- Project metadata is stored in `projects/project-registry.json`.
- The project registry uses `schemaVersion: 1`.
- Hermes configuration remains in `%LOCALAPPDATA%\hermes\config.yaml`.

## Migration Policy

- Do not rewrite existing profile Markdown files unless the user saves a profile from Studio.
- If `projects/project-registry.json` is absent, Studio synthesizes a default in-memory project for `D:\LocalAI`.
- The project registry is only written after an explicit project save.
- Future registry schema changes must add a new migration document and preserve a backup of the previous registry.
- Hermes config saves must create a timestamped backup before writing.
- Backup/export must exclude `.env`, `auth.json`, and other secret-bearing files.

## Rollback

- Profile changes can be reverted from a user backup/export folder.
- Project registry changes can be reverted by replacing `projects/project-registry.json` with a previous exported copy.
- Hermes config changes can be reverted from `artifacts/milestone3/config-backups/`.
