# ADR-0001: Architecture and Compatibility Validation

## Status

Accepted for Milestone 0 scaffold and compatibility-validation direction. Milestone 0 itself is not complete until the blocked probes in `STATUS.md` pass.

## Context

Hermes Local AI Studio must be a single Windows desktop app that supervises local services for Hermes Agent, Ollama, model routing, knowledge, memory, browser automation, and Windows automation. Milestone 0 is limited to compatibility validation and repository scaffolding.

Official Hermes documentation checked on 2026-06-26 confirms:

- Native Windows install uses `%LOCALAPPDATA%\hermes`, with code under `%LOCALAPPDATA%\hermes\hermes-agent` and data/config/sessions/logs under `%LOCALAPPDATA%\hermes`.
- Hermes CLI supports non-interactive single query mode with `hermes chat -q "Hello"`.
- Hermes TUI launches with `hermes --tui`.
- Native Windows supports CLI, TUI, messaging gateway, browser tool, MCP servers, local Ollama / LM Studio / llama-server, and web dashboard. The dashboard embedded `/chat` terminal pane is not native-Windows compatible because it depends on POSIX PTY behavior.
- Hermes browser tooling uses the Node `agent-browser` helper and Playwright Chromium.

Official project references used:

- https://hermes-agent.nousresearch.com/docs/getting-started/installation
- https://hermes-agent.nousresearch.com/docs/user-guide/windows-native
- https://hermes-agent.nousresearch.com/docs/user-guide/cli
- https://hermes-agent.nousresearch.com/docs/user-guide/tui
- https://github.com/nousresearch/hermes-agent

## Decisions

1. Use `D:\LocalAI` as the project root and local workspace.
2. Use a monorepo with `apps`, `services`, `packages`, `docs`, `scripts`, and `tests`.
3. Keep Milestone 0 source code validation-only. The Windows broker exposes only `window.list` and `ui.get_tree`.
4. Use strict TypeScript settings in the shared `tsconfig.base.json`.
5. Use typed Python defaults through `pyproject.toml`.
6. Enable nullable C# and warning-as-error defaults through `Directory.Build.props`.
7. Pin JavaScript package management to `pnpm@11.7.0` and initial TypeScript tooling versions in `package.json`.
8. Target `.NET 8` for the Windows broker source, matching the product plan. If the SDK is absent locally, record that as a Milestone 0 blocker rather than changing the architecture target.
9. Resolve Hermes through PATH first, then `%LOCALAPPDATA%\hermes\hermes-agent\venv\Scripts\hermes.exe`.
10. Resolve Ollama through PATH first, then common Windows install paths.
11. Pull baseline Ollama models through a checkpointed script so interrupted downloads can resume safely.
12. Use Playwright against a controlled local `file://` page for Edge and Chrome smoke tests.

## Consequences

- Milestone 1 can build on a stable scaffold without coupling the Electron renderer to Node or OS privileges.
- Milestone 0 tests can fail honestly when local dependencies are missing.
- Active computer control remains impossible in the Milestone 0 broker.
- The Hermes dashboard/plugin route is not assumed until local Hermes source and installed version are verified.

## Known Unknowns

- The installed Hermes version and exact commit are unknown until Hermes is found locally or installed.
- Hermes dashboard plugin extension points still require local source inspection after Hermes is available.
- TUI Gateway / JSON-RPC availability still requires source inspection. The CLI single-query route is documented and can be used as the first programmatic probe.
- The local .NET SDK is required to compile the broker even when .NET runtimes are present.

## 2026-06-26 Validation Notes

- Ollama HTTP API is reachable at `http://localhost:11434` and reports version `0.30.10`.
- Baseline Ollama models were pulled through `/api/pull`: `qwen3.5:4b`, `qwen3.5:9b`, `qwen3-vl:4b`, and `qwen3-embedding:0.6b`.
- `keep_alive: 0` unload behavior was verified by polling `/api/ps` until `qwen3.5:4b` disappeared.
- Hermes native Windows executable exists at `%LOCALAPPDATA%\hermes\hermes-agent\venv\Scripts\hermes.exe`, but this Codex sandbox cannot spawn it (`EPERM` / access denied).
- Edge and Chrome executables exist, but Playwright validation is blocked because the pinned package install cannot reach the npm registry from this sandbox and the bundled runtime is missing `playwright-core`.
- .NET runtimes 8/9/10 exist, but no .NET SDK is installed, so the broker source cannot be built yet.

## 2026-06-26 Follow-up Validation Notes

- Normal PowerShell repair installed pinned Node dependencies and .NET SDK `8.0.422`.
- Browser smoke validation passes for both Edge and Chrome using `@playwright/test`.
- The Windows broker now builds under `net8.0` with direct local UI Automation assembly references and project-local NuGet/cache/temp state.
- The broker remains observe-only and exposes only `window.list` and `ui.get_tree`.
- Managed UI Automation enumeration succeeds in the Codex sandbox for the desktop root node.
- Hermes `v0.17.0` is installed, but the real single-query acceptance check still requires a configured inference provider/model. The probe was tightened so setup-error text cannot pass.
