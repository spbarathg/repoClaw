# RepoClaw Engineering Specification (Source of Truth)

## 1. Product Objective
RepoClaw is an OpenClaw-native autonomous AI agent designed to evaluate GitHub repositories as a closed-loop debugging problem. It automatically clones, builds, classifies errors, applies fixes, and retries builds (up to 3 cycles) to determine if a repository is buildable, ultimately delivering a structured evaluation report via chat interfaces.

## 2. Mandatory Features
- **Chat-Native Interface:** Accept GitHub URLs and deliver reports via Telegram and Discord.
- **Automated Stack Detection:** Identify language, framework, package manager, and parse configuration files (`README`, `package.json`, `requirements.txt`, etc.).
- **Isolated Execution:** Run all installation and build commands within ephemeral, isolated Docker containers.
- **LLM Error Classification:** Use Claude API to parse `stderr`/`stdout` into structured JSON error objects (category, severity, suggested_fix).
- **Deterministic Auto-Fix:** Automatically patch the 3 most common build failures:
  1. `.env` file generation
  2. Runtime version mismatches
  3. Missing package dependencies
- **State Persistence:** Store per-repo analysis history and fix outcomes using OpenClaw's native YAML memory.
- **Structured Reporting:** Deliver formatted Markdown summaries of the build pipeline, including errors, fixes applied, and final verdict.

## 3. Intended Autonomous Workflow
The Pi Engine orchestrates the following self-correcting retry loop:
1. **Trigger:** Receive `analyze <url>` command via Telegram/Discord.
2. **Fetch:** Acknowledge request, queue, and clone the repository into a fresh Docker sandbox.
3. **Analyze:** Detect the project stack, framework, and config requirements.
4. **Execute (Try):** Run install and build commands; capture `stdout` and `stderr`.
5. **Evaluate:**
   - *If Success:* Mark as `Buildable`, compile, and send the report.
   - *If Failure:* Proceed to step 6.
6. **Classify:** Send `stderr` to Claude API to receive a categorized JSON error object.
7. **Fix:** Map the error category to a deterministic fix strategy (e.g., generate `.env`, patch version, install package) and apply the patch.
8. **Retry:** Loop back to Step 4. Limit to a maximum of **3 retry cycles**.
9. **Final Verdict:** After success or 3 failed retries, issue a final status (`Buildable`, `Fixable`, or `Non-Buildable`) with full reasoning.
10. **Report & Persist:** Deliver the report to the chat and persist the run state to YAML memory.

## 4. Architectural Modules
RepoClaw maps to the 5-layer OpenClaw stack with 6 dedicated skills.

### Core Architecture
- **Communication Layer:** Telegram / Discord bots.
- **Channel Adapter:** OpenClaw ProtocolAdapter (normalizes messages).
- **Gateway:** Node.js / TypeScript WebSocket routing.
- **Orchestrator (Pi Engine):** OpenClaw Agent Loop managing the retry cycle.
- **Memory:** OpenClaw-native YAML persistence.
- **Sandbox:** Docker Compose for isolated build execution.

### Skills Layer (Stateless Modules)
- `repo_fetch`: Handles `git clone`, directory parsing, and GitHub REST API metadata fetching.
- `structure_analyze`: Detects tech stack based on file extensions and config files.
- `build_runner`: Executes commands in Docker; captures `stdout`/`stderr`.
- `error_classifier`: Interfaces with Claude API; converts raw logs into structured, typed JSON error objects.
- `auto_fix`: Deterministic patch generator mapped directly to error categories.
- `report_gen`: Assembles the final Markdown report for delivery.

## 5. Technology Stack & Constraints
- **Agent Framework:** OpenClaw (Core), Node.js >= 22, TypeScript CLI.
- **AI / LLM:** Anthropic Claude API (`claude-sonnet-4-20250514`).
- **Sandboxing:** Docker & Docker Compose (Host isolation is strict; containers tear down post-run).
- **Persistence:** Local YAML files (no external DB required for MVP).
- **Compute Constraints:** Minimum 2-core CPU, 4 GB RAM. One Docker container per active repo analysis.

## 6. Deliberate MVP Scope Boundaries
- **Supported Stacks:** ONLY **Node.js/npm** and **Python/pip** are supported for the MVP.
- **Fix Capabilities:** Auto-fixes are strictly limited to `.env` generation, runtime version patching, and missing packages.
- **Environment:** Complex multi-container repositories are excluded from MVP auto-fix scope.

## 7. Demo Priorities & Judge-Facing Wow Factors
### Wow Factors
- **Genuine Closed-Loop Autonomy:** Not just a build checker; a continuous *try → classify → fix → retry* pipeline without human intervention.
- **Deterministic Fixes via Structured AI:** Relying on strict JSON schema from Claude to map errors to code-level patches, avoiding freeform LLM code-guessing.
- **Real-Time Visibility:** Chat-native execution shows errors, classifications, and patches live as they happen.

### Demo Scenarios (Strict < 3 Min Execution)
1. **Clean Build:** Well-maintained Node.js repo passes perfectly on cycle 1. (`Buildable`)
2. **Auto-Fix in Action:** Python repo fails on missing `.env` and incorrect runtime. Agent classifies both, extracts `.env` context from README, patches version, and succeeds on retry 2. (`Fixable`)
3. **Non-Buildable:** Archived/broken repo loops 3 times, thoroughly documenting deep config failures before providing a remediation path. (`Non-Buildable`)