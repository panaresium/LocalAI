# Milestone 16 Packaging and Hardening Plan

## Installer Strategy

Milestone 16 supports a local portable installer script at `scripts/install-studio-local.ps1`.
It installs only after explicit `-ConfirmInstall`, writes into a versioned local app data folder, and does not delete previous versions.
Windows, System32, and Program Files targets are blocked by the script.

## Dependency Locking

JavaScript dependencies remain pinned through `packageManager: pnpm@11.7.0`, `pnpm-lock.yaml`, and exact package versions.
Approved dependency build scripts are constrained through `pnpm-workspace.yaml`.
.NET builds use `global.json`, nullable reference types, and warnings-as-errors.

## Update Strategy

Updates are local and manual in Milestone 16.
Automatic update checks and silent update application are disabled.
The update flow is:

1. Run the full milestone acceptance suite.
2. Generate `artifacts/milestone16/installer-manifest.json`.
3. Review SHA-256 checksums in `artifacts/milestone16/SHA256SUMS.milestone16.txt`.
4. Install into a new versioned local app data folder only after explicit user approval.
5. Keep the previous version available for rollback.

## Backup And Restore

Backup export remains available from Milestone 3 and excludes known secret-bearing Hermes files.
Milestone 16 adds restore planning only.
Restore apply is blocked until a future explicit restore executor is designed, reviewed, and covered by migration tests.

## Security And Performance

The Milestone 16 gate checks renderer isolation, preload shell isolation, absence of hidden automation watchers, no silent elevation path, and Electron web preferences.
It also checks desktop build output and renderer/main bundle size budgets before packaging.
