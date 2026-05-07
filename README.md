# RepoClaw

**Deterministic Build Recovery Engine & CI Console.**

RepoClaw is a strict, infrastructure-grade CI recovery engine. Given a GitHub repository URL, it clones the code into a resource-limited Docker sandbox, infers the build system, classifies failures using deterministic pattern-matching heuristics, and applies bounded repair policies — ensuring full operational observability with no "AI blackbox" in the repair path.

## 🚀 The Dashboard

The RepoClaw frontend has been surgically designed as a high-density, authoritative CI/CD recovery console. It explicitly tracks:
- **Compiler Logs:** Front-and-center raw terminal output.
- **Execution Policy:** Static visibility into the constrained sandbox environment (`512MB Memory`, `1 Core`, `Readonly Mounts`).
- **Recovery Provenance:** A full forensic trace of the pipeline, displaying the exact `Failure` classification, the `Strategy` applied, the `Mutation Surface` (e.g., `install_command`), and the post-repair `Validation` exit codes.

## ⚙️ Architecture & Pipeline

```
Clone → Detect → Build → Classify → Select Policy → Apply Mutation → Rebuild → Validate → Provenance Record
```

Every repair strategy is a lookup in a deterministic policy table. The retry loop is strictly bounded at 3 cycles with material-mutation detection to prevent synthetic repetition.

## 🛡️ Key Design Decisions

- **Heuristic-First Classification** — Regex pattern matching against 20+ known failure signatures with tiered match strengths.
- **AI as a Constrained Fallback** — LLMs are only invoked when heuristics return `UNKNOWN`, capped at a maximum `0.75` match strength, and are **never** used to generate code patches.
- **Policy-Driven Repair** — Each error category maps to a statically declared repair policy with allowed mutation surfaces, safety classifications (`SAFE`, `CONSTRAINED`), and rollback rules.
- **Sandbox Security Limits** — Every Docker container enforces strict memory (`512MB`), CPU (`1.0`), PID (`256`), and privilege (`no-new-privileges`) constraints.

## 🛠️ Supported Languages & Repair Classes

| Language | Package Managers | Status |
|----------|-----------------|--------|
| Node.js  | npm, yarn, pnpm | Full support |
| Python   | pip, poetry     | Full support |
| Go / Rust / Java | go, cargo, maven | Build-only |

### Auto-Repairable Failures
* `MISSING_DEPENDENCY` → Append to install command (`SAFE`)
* `DEPENDENCY_CONFLICT` → Inject legacy peer deps (`SAFE`)
* `BUILD_SCRIPT_MISSING` → Inject package.json placeholder (`CONSTRAINED`)
* `TYPESCRIPT_CONFIG_FAILURE` → Generate minimal tsconfig (`CONSTRAINED`)
* `TYPESCRIPT_FAILURE` → Relax tsc strictness flags (`SAFE`)
* `RUNTIME_VERSION_MISMATCH` → Strip engine constraint (`CONSTRAINED`)
* `PYTHON_NATIVE_TOOLCHAIN_FAILURE` → Force binary-only wheels (`CONSTRAINED`)

## 🏁 Judge / Local Setup Guide

Follow these exact steps to run RepoClaw locally with zero conflicts.

### Prerequisites
1. **Node.js**: v20 or higher.
2. **Docker**: Docker Desktop must be running.

### 1. Warm Up the Sandbox Environment
To prevent Docker latency during the live demo, pre-pull the sandbox image:
```bash
docker pull node:20-alpine
```

### 2. Start the Backend Engine
```bash
# From the root directory
npm install
npm start
```

### 3. Start the Frontend Console
Open a new terminal window:
```bash
cd frontend
npm install
npm run dev
```

### 4. Run a Demo Scenario
Navigate to `http://localhost:5173/` and input the local test repository:
`file:///c:/Users/barat/samsung hackathon/RepoClaw/test-repos/demo-conflict`
Click **Analyze** to watch the deterministic recovery pipeline in real-time.

---

*Unlike Dependabot (proactive dependency updates), RepoClaw operates reactively on already-broken builds. Unlike AI coding agents, RepoClaw uses deterministic policy-driven repair — no LLM hallucinations in the hot path.*
