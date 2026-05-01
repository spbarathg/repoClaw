# RepoClaw Live Architecture Map & Execution Plan

*This document serves as the live engineering execution map. It tracks the exact structural requirements, runtime flow, and implementation progress. It must be updated as milestones are completed.*

---

## 1. Exact Source Folder Tree
The repository must conform strictly to this directory structure to maintain the separation of concerns mandated by `MASTER_AGENT_RULES.md`.

```text
src/
├── index.ts                // Entry point, initializes Gateway & Pi Engine
├── gateway/
│   ├── websocket.ts        // Handles Telegram/Discord connections via ProtocolAdapter
│   └── routing.ts          // Routes incoming 'analyze <url>' requests to the Pi Engine
├── engine/
│   ├── pi_engine.ts        // Orchestrator: manages the try -> classify -> fix -> retry loop
│   └── memory.ts           // YAML memory persistence wrapper
├── skills/                 // 100% Stateless modules
│   ├── repo_fetch.ts       // git clone, directory parsing, GitHub metadata
│   ├── structure_analyze.ts// tech stack and config detection
│   ├── build_runner.ts     // Docker exec, stdout/stderr capture
│   ├── error_classifier.ts // Claude API interaction, returns structured JSON
│   ├── auto_fix.ts         // Deterministic patch applicator
│   └── report_gen.ts       // Structured Markdown report generation
├── docker/
│   ├── container_mgr.ts    // Manages ephemeral Docker Compose sandboxes
│   └── templates/          // Base Dockerfiles for Node.js and Python
└── utils/
    ├── logger.ts           // Structured Pino/Winston logger
    ├── shell.ts            // Safe shell execution wrapper (try/catch, timeouts)
    └── types.ts            // Strict TypeScript interfaces (e.g., ErrorCategory, FixStrategy)
```

## 2. Mandatory TypeScript Modules & Roles

- **`src/index.ts`**: Bootstraps the application, loads `.env`, and starts the Gateway listeners.
- **`src/gateway/websocket.ts`**: The Channel Adapter normalizing Telegram and Discord incoming messages.
- **`src/engine/pi_engine.ts`**: The core loop. Handles state transitions between skills. Never executes shell commands directly. Orchestrates the 3-cycle limit.
- **`src/engine/memory.ts`**: Reads/writes per-repo analysis state to the root `memory/` directory using OpenClaw YAML format.
- **`src/skills/*.ts`**: 6 distinct files. Must not import each other (Zero Cross-Skill Coupling). Each must export a single primary function taking typed inputs and returning typed outputs.
- **`src/docker/container_mgr.ts`**: Responsible for spinning up `sandboxes/` environments and ensuring strict teardown post-analysis to prevent host contamination.
- **`src/utils/types.ts`**: Single source of truth for the JSON schema returned by Claude, the fix strategies, and the internal state object passed between skills.

## 3. Dependency Roadmap

### Core Dependencies
- **Runtime:** `typescript`, `ts-node`
- **Network & Gateway:** `ws` or `socket.io` (for WebSocket connections)
- **State & Persistence:** `yaml` (for native memory storage)
- **AI Integration:** `@anthropic-ai/sdk` (Official Claude API client for `error_classifier`)
- **Observability:** `pino` or `winston` (for structured JSON logging)
- **Version Control:** `simple-git` (for safe, wrapper-based `repo_fetch` clone operations)
- **Execution Environment:** `dockerode` or built-in `child_process` (for Docker container management and shell execution)

## 4. Runtime Orchestration Flow (The Pi Engine Loop)

1. **[Gateway]** Receives `analyze <URL>` -> Creates a tracking Job ID.
2. **[Pi Engine]** Initializes YAML memory for `<URL>`.
3. **[Skill: repo_fetch]** Clones the URL into the ephemeral `sandboxes/<job_id>` directory.
4. **[Skill: structure_analyze]** Scans `sandboxes/<job_id>` -> Returns `{ stack: "python", packageManager: "pip" }`.
5. **[Skill: build_runner]** Spins up Docker, runs install/build commands -> Returns `{ success: false, stderr: "ModuleNotFoundError..." }`.
6. **[Skill: error_classifier]** Sends `stderr` to Claude API -> Returns typed JSON: `{ category: "missing_package", suggested_fix: "pip install X" }`.
7. **[Skill: auto_fix]** Applies deterministic fix (e.g., appends to `requirements.txt`) based on the category -> Returns `{ patched: true }`.
8. **[Pi Engine]** Increments retry counter, loops back to Step 5. Limit: 3 retries max.
9. **[Skill: report_gen]** Formats final state into Markdown.
10. **[Gateway]** Emits the Markdown report back to the Telegram/Discord thread.
11. **[Docker Mgr]** Aggressively tears down and deletes `sandboxes/<job_id>`.

## 5. Implementation Milestones

- [ ] **Milestone 1:** Project scaffolding, strict TS configuration, types, and structured logger.
- [ ] **Milestone 2:** `repo_fetch` and `structure_analyze` skills (Clone & Detect layer).
- [ ] **Milestone 3:** Docker `container_mgr` and `build_runner` (Isolated Execution layer).
- [ ] **Milestone 4:** Claude API integration in `error_classifier` (Structured AI JSON layer).
- [ ] **Milestone 5:** The Pi Engine Retry Loop & `auto_fix` deterministic patching layer.
- [ ] **Milestone 6:** YAML Memory persistence, Gateway chat delivery, and final `report_gen`.

## 6. Progress Checklist (Live Status)

- [ ] Initialize `package.json` and install core dependencies
- [ ] Configure `tsconfig.json` for absolute strict mode
- [x] Create exact `src/` directory tree
- [x] Impl: `src/utils/types.ts`
- [x] Impl: `src/utils/logger.ts`
- [x] Impl: `src/utils/shell.ts`
- [x] Impl: `src/docker/container_mgr.ts`
- [x] Impl: `src/skills/repo_fetch.ts`
- [x] Impl: `src/skills/structure_analyze.ts`
- [x] Impl: `src/skills/build_runner.ts`
- [x] Impl: `src/skills/error_classifier.ts`
- [x] Impl: `src/skills/auto_fix.ts`
- [x] Impl: `src/skills/report_gen.ts`
- [x] Impl: `src/engine/memory.ts`
- [x] Impl: `src/engine/pi_engine.ts`
- [x] Impl: `src/gateway/websocket.ts` & `src/gateway/routing.ts`
- [x] Wire up `src/index.ts`
- [ ] End-to-end test: Clean Build Scenario (Node.js)
- [ ] End-to-end test: Auto-Fix Scenario (Python missing `.env` / version patch)
- [ ] End-to-end test: Non-Buildable Scenario (Graceful exhaustion)
