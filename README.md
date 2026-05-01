# RepoClaw

*Autonomous Repository Analysis & Auto-Fix Agent*

## Product Overview
RepoClaw is an OpenClaw-native autonomous AI agent designed to treat GitHub repository evaluation as a closed-loop debugging problem. When provided a GitHub URL via Telegram or Discord, RepoClaw clones the repository into an ephemeral Docker sandbox and attempts to build it. On failure, it parses the build errors via the Anthropic Claude API, selects and applies a deterministic fix strategy, and retries the build. This autonomous `try -> classify -> fix -> retry` loop runs up to 3 times before issuing a final, structured verdict (`Buildable`, `Fixable`, or `Non-Buildable`) back to the original chat.

## Architecture Overview
RepoClaw maps directly onto the 5-layer OpenClaw stack. The architecture strictly enforces statelessness at the execution layer, concentrating state management inside the Pi Engine orchestrator and YAML memory system.

1. **Communication Layer:** Telegram / Discord interfaces.
2. **Channel Adapter:** Normalizes inputs via OpenClaw ProtocolAdapter.
3. **Gateway:** Node.js / TypeScript WebSocket router.
4. **Pi Engine (Orchestrator):** The brain managing the retry loop and memory state.
5. **Skills Layer:** 6 completely decoupled, stateless execution modules.

## Module Responsibilities
The codebase is divided into clear functional zones without cross-coupling:

- **`src/engine/pi_engine.ts`**: The core orchestrator. Manages state transitions and strictly enforces the 3-cycle retry limit.
- **`src/engine/memory.ts`**: Handles YAML persistence for per-repo history.
- **`src/docker/container_mgr.ts`**: Spins up and aggressively tears down ephemeral Docker Compose sandboxes.

### Stateless Skills (`src/skills/`)
Each skill is 100% independent. A skill accepts a typed input, performs work, and returns a typed output.
- **`repo_fetch`**: Handles git cloning, directory parsing, and GitHub metadata.
- **`structure_analyze`**: Detects language, framework, and config requirements.
- **`build_runner`**: Executes install/build inside Docker; captures `stdout`/`stderr`.
- **`error_classifier`**: Interfaces with Claude API to convert raw logs into typed JSON error categories.
- **`auto_fix`**: Applies deterministic fixes (e.g., generating a `.env` file or patching a dependency version) mapped from the AI classification.
- **`report_gen`**: Generates the final structured Markdown summary.

## Intended Runtime Behavior
1. **Trigger:** User sends `analyze <url>` via chat.
2. **Isolate:** Repository is cloned to `sandboxes/<job_id>`.
3. **Try:** Agent attempts to build the project inside an isolated container.
4. **Classify & Fix:** If failed, `stderr` is classified by Claude into a discrete error category, and a deterministic patch is applied to the codebase.
5. **Retry:** The build is attempted again (up to 3 limits).
6. **Report:** The final markdown report is delivered to the originating chat.
7. **Cleanup:** The sandbox directory and container are forcefully destroyed.

## Local Setup Expectations
### Prerequisites
- **Node.js**: v22 or higher
- **Docker**: Docker and Docker Compose must be installed and running on the host.
- **API Keys**: Anthropic Claude API key, and Bot tokens (Telegram/Discord).

### Initialization
1. Clone the repository.
2. Run `npm install` to load core dependencies.
3. Configure the `.env` file with required API keys.
4. Run the bootloader to start the Gateway and Pi Engine listeners.

## Development Notes
- **Product Requirements:** Refer to `REPOCLAW_PRODUCT_SPEC.md` as the absolute source of truth.
- **Execution Roadmap:** Track live implementation progress in `repoclaw-plan.md`.
- **Engineering Constitution:** You **must** read and adhere to `MASTER_AGENT_RULES.md` before making any codebase modifications. Deviations from the stateless architecture or Docker isolation are considered catastrophic failures.
