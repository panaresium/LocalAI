# Milestone 0 Scaffold Map

This scaffold is intentionally minimal. It validates architecture and compatibility before implementing product features.

## Apps

- `apps/studio-desktop`: placeholder for the Electron desktop shell that begins in Milestone 1.
- `apps/studio-dashboard-plugin`: placeholder for Hermes dashboard/plugin integration after extension points are verified.

## Services

- `services/browser-control`: Playwright smoke test against a controlled local page.
- `services/windows-control-broker`: .NET observe-only broker prototype.

Other services from the full plan are added as directories in later milestones when their acceptance tests are in scope.

## Packages

- `packages/contracts`: shared strict TypeScript contracts, including observe-only computer action policy.
- `packages/hermes-client`: Hermes detection and single-query probe harness.
- `packages/ollama-client`: Ollama API and model lifecycle probe harness.

## Scripts

- `scripts/detect-environment.ps1`: local dependency and hardware detection.
- `scripts/pull-ollama-baseline.ps1`: checkpointed baseline model pull.
- `scripts/run-milestone0.ps1`: Milestone 0 validation runner.
- `scripts/test-windows-broker.ps1`: broker build and observe-only command validation.
