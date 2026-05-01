# RepoClaw Master Engineering Constitution

This constitution governs **every** generation step, architectural decision, and code edit made for the RepoClaw project. All future build prompts and autonomous agent actions MUST strictly adhere to these rules. Deviations are considered catastrophic failures.

## 1. Non-Negotiable Engineering Rules
- **No Speculative Code:** Code must only be written to satisfy the exact requirements of `REPOCLAW_PRODUCT_SPEC.md`. Do not implement future-proofing abstractions for languages outside of Node.js and Python.
- **Strict Typing:** All TypeScript code must use strict type definitions. `any` is forbidden unless wrapping a genuinely opaque third-party library.
- **Docker-First Isolation:** All untrusted repository code execution (npm install, pip install, build commands) MUST happen inside an ephemeral Docker container. Never execute external code on the host machine.
- **Single Source of Truth:** `REPOCLAW_PRODUCT_SPEC.md` is the absolute authority on product requirements. If a feature is not in the spec, do not build it.

## 2. Modular Coding Discipline & Anti-Spaghetti Safeguards
- **Stateless Skills Only:** The 6 core skills (`repo_fetch`, `structure_analyze`, `build_runner`, `error_classifier`, `auto_fix`, `report_gen`) MUST be 100% stateless. They accept inputs, perform discrete work, and return typed outputs. State is exclusively managed by the Pi Engine orchestrator and YAML memory.
- **Zero Cross-Skill Coupling:** A skill must never directly invoke another skill. The orchestrator handles all data passing.
- **No Monolithic Files:** Functions must not exceed 100 lines of code. If a skill grows beyond 200 lines, extract its logic into purely functional helper modules.
- **Deterministic Fixes:** `auto_fix` logic MUST NOT use LLM "code-guessing." It must map the structured JSON category from `error_classifier` to a hardcoded, deterministic fix strategy.

## 3. Autonomous Shell Usage Expectations
- **Scripted Reliability:** All shell interactions must be wrapped in `try/catch` blocks or check exit codes.
- **Output Capture:** `build_runner` must meticulously capture both `stdout` and `stderr`. If a command hangs, it must have a strict timeout (e.g., 60-120 seconds) enforced by the shell wrapper.
- **Sandboxing Boundaries:** Shell commands related to repository builds must only be executed via `docker exec` or within a containerized context. Host shell access is strictly limited to infrastructure orchestration (e.g., `docker-compose up`).

## 4. File Creation Behavior
- **Explicit Ownership:** Every generated source file must begin with a clear, single-line JSDoc comment describing its exact role in the RepoClaw pipeline.
- **Clean Root Directory:** Do not dump utility scripts, logs, or temporary files in the project root. Use the designated operational directories: `artifacts/`, `logs/`, `memory/`, `reports/`, `sandboxes/`.
- **Ephemeral Sandbox Cleanup:** Sandbox directories and Docker containers must be aggressively deleted or spun down immediately after a run, regardless of success or failure.

## 5. Error Handling Standards
- **Silent Failures are Fatal:** Never swallow an error. All caught exceptions must be logged and either thrown up to the orchestrator or converted into a structured failure object.
- **The Retry Loop Guarantee:** A failure in `build_runner` is an expected event, NOT an application crash. It triggers the Pi Engine's `try -> classify -> fix -> retry` loop. 
- **Graceful Exhaustion:** If 3 retry cycles are exhausted, the agent must fail gracefully, emitting a comprehensive `Non-Buildable` report. It must not crash the Gateway or WebSocket connection.

## 6. Logging Standards
- **Structured JSON Logging:** All application-level logs must be structured (e.g., Pino/Winston) to include timestamp, skill_name, trace_id, and message.
- **Audit Trails:** Every interaction with the Claude API (prompts sent, JSON received) must be logged for debugging the classification layer.
- **Real-Time Granularity:** Emit discrete events to the Chat Interface (Telegram/Discord) for each major step: *Cloning -> Building -> Failed -> Classifying -> Fixing -> Retrying*.

## 7. Build Priorities
1. **The Pi Engine Loop:** The absolute highest priority is establishing the `try -> classify -> fix -> retry` autonomous cycle.
2. **Docker Orchestration:** Safe, ephemeral execution environments.
3. **Claude API Integration:** Generating perfectly typed JSON error categories from messy `stderr` output.
4. **Chat Interface:** Delivering the real-time results to the user.

## 8. Demo Impressiveness Requirements
- **The 3-Minute Rule:** All demo scenarios, including a 3-cycle auto-fix, MUST complete in under 3 minutes. Performance optimizations (e.g., aggressive Docker caching for base images) are required to meet this.
- **Radical Transparency:** The live chat feed must show the AI's internal reasoning. Do not just output "Failed, retrying." Output: *"Failed: ModuleNotFoundError. Claude classified as Missing Dependency. Auto-fix applying pip install. Retrying..."* The judge must see the machine thinking and executing deterministically.
- **Zero Human Intervention:** Once `analyze <url>` is sent, the system must not require a single click, prompt approval, or terminal keystroke from the host.
