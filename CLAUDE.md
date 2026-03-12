# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
make run ARGS="<command>"          # Run CLI locally (e.g. ARGS="whoami")
make staging-run ARGS="<command>"  # Run against staging environment
make build                         # Build single-platform binary
make build-all                     # Build all platform binaries
make codeclean                     # Format with prettier
```

The runtime is **Bun** (>=1.3). No test framework is configured.

## Architecture

This is the **Crystallize CLI** (`@crystallize/cli`), a Bun-compiled TypeScript CLI using React (Ink) for terminal UI.

### Key Patterns

- **CQRS**: CommandBus (mutations) and QueryBus (reads) via `missive.js`. Handlers are registered in `src/core/di.ts`.
- **Dependency Injection**: Awilix container configured in `src/core/di.ts` — all services are singletons. Command factories receive their dependencies from the container.
- **Commander.js**: CLI commands are created as factory functions returning `Command` instances, organized by namespace (root, boilerplate, mass-operation, tenant, token, image, file).
- **Interactive UI**: React components via Ink with Jotai atoms for state. Most commands support `--no-interactive` for CI/CD.

### Source Layout

- `src/index.ts` — Entry point
- `src/command/` — CLI command definitions (each exports a factory function)
- `src/domain/use-cases/` — Business logic handlers (CQRS)
- `src/domain/contracts/` — Interfaces (logger, fly-system, bus, models)
- `src/core/di.ts` — DI container wiring (command registration, handler setup)
- `src/core/` — Infrastructure (logger, file system abstraction, credentials, runner)
- `src/ui/components/` — Reusable Ink/React terminal components
- `src/ui/journeys/` — Multi-step interactive flows

### Adding a New Command

1. Create a factory in `src/command/<group>/` returning a `Command`
2. Define any use-case handlers in `src/domain/use-cases/`
3. Register in `src/core/di.ts` under the appropriate command group

### File System & Process Execution

File I/O uses a `FlySystem` abstraction (`src/domain/contracts/fly-system.ts`, implemented via Bun APIs). Subprocesses use `Bun.spawn` wrapped in `src/core/create-runner.ts`.

### Credentials

Resolved in priority order: env vars (`CRYSTALLIZE_ACCESS_TOKEN_ID`/`SECRET`) → CLI flags (`--token_id`/`--token_secret`) → stored file (`~/.crystallize/credentials.json`).

## Code Style

- Prettier: 4-space indent, single quotes, trailing commas, semicolons, 120 char width
- Commit messages: conventional commits (feat, fix, chore, refactor, etc.)
- TypeScript strict mode with `verbatimModuleSyntax`
