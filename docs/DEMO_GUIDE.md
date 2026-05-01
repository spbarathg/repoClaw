# 🚀 RepoClaw Hackathon Demo Guide

This guide outlines exactly how to deliver a flawless, high-impact demonstration of RepoClaw to the judges in under 2 minutes.

## 1. Environment Setup (30 seconds)
Before the judges arrive:
1. Ensure you have Node.js 22+ and Docker running.
2. Ensure you have run `npm install`.
3. Add a valid `GEMINI_API_KEY` to your `.env` file for live AI error classification.

## 2. The Command (10 seconds)
When the timer starts, type the following command loudly:
```bash
npm run demo https://github.com/some/broken-react-repo
```
*Tip: Fork a simple React or Python repository and intentionally delete a dependency or mess up an import to show off the FIXABLE workflow.*

## 3. The Cinematic Output (1 minute)
As the command runs, narrate the terminal output:
- **Phase 1:** "RepoClaw fetches the repository natively via git."
- **Phase 2:** "It recursively scans the architecture and automatically infers the precise package manager and build commands."
- **Phase 3:** "It boots an ephemeral Docker sandbox. Look at the terminal—it failed to build! Now watch the AI step in. The Intelligence layer catches the `stderr`, correctly classifies it as a missing dependency, and forcefully applies a deterministic patch."
- **Phase 4:** "The final verdict is presented."

## 4. The Final Report (20 seconds)
Open the generated Markdown payload to show the judges the highly polished **Verdict Report**, complete with badges, autonomous cycle tables, and explicitly stated AI reasoning.

That's it. A mic-drop demonstration.
