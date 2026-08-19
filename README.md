# Prime Agent (Windows Port)

> **Note:** This repository is a **Windows-focused fork and port** of [Prime Agent](https://github.com/PrimeIntellect-ai/prime-agent) by [Prime Intellect](https://primeintellect.ai). It includes native Windows launchers (`.ps1` and `.cmd`), path normalization, and setup instructions tailored for Windows environments while maintaining full parity with upstream Prime Agent capabilities.

[![Upstream Repo](https://img.shields.io/badge/Upstream-PrimeIntellect--ai%2Fprime--agent-blue)](https://github.com/PrimeIntellect-ai/prime-agent)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[Documentation](packages/coding-agent/docs/index.md) &bull; [Upstream Repository](https://github.com/PrimeIntellect-ai/prime-agent) &bull; [Windows Notes](packages/coding-agent/docs/windows.md)

---

Prime Agent is an open-source coding and research agent designed for general and long-running workflows. It is built around two core abstractions:

- **[Recursive Language Model (RLM)](https://www.primeintellect.ai/blog/rlm):** Treats context as variables (*prompt-as-a-variable*) and tools/subagents as function calls (*programmatic tool calling*) inside a persistent Python REPL.
- **[Continual Harness](https://arxiv.org/abs/2605.09998):** Stores supplemental prompts, memories, skill descriptions, and reusable subagent specifications as durable state that Prime Agent can refine through small, evidence-backed updates.

### Key Capabilities

- **Programmatic Control:** A persistent IPython environment serves as the built-in execution tool. File operations, shell commands, tool invocations, subagents, and context management happen directly through code.
- **Built-in Subagents:** `rlm(...)` spawns real child agents for parallel or background tasks and returns their outputs programmatically.
- **Continual Refinement:** `/refine` inspects conversation trajectories and persists focused lessons (prompts, memories, skills, subagent specs) without rewriting the immutable base prompt.
- **Executable Skills:** Skills are importable Python packages. The built-in skill creator enables turning recurring workflows into project or personal skills.
- **Background Continuity:** Daemon-backed agents continue running even if the terminal disconnects and can be reattached at any time.
- **Direct Agent Messaging:** Running agents communicate and orchestrate with one another directly without requiring user relay.
- **Long-Running Orchestration:** Automatic compaction, persistent goals (`/goal`), heartbeats (`/heartbeat`), cron schedules, and bounded autonomous execution (`/autonomous`) keep long tasks moving.

---

## Getting Started (Windows)

### Prerequisites

- **[Node.js](https://nodejs.org/)** (v22.8.0 or newer)
- **[Python](https://www.python.org/)** (v3.10 or newer)
- **[Git for Windows](https://git-scm.com/download/win)** (recommended for Git Bash support)

### Installation & Setup

1. **Clone the repository:**
   ```powershell
   git clone https://github.com/Thanki-Daksh/prime-agent-windows.git
   cd prime-agent-windows
   ```

2. **Install dependencies:**
   ```powershell
   npm install
   ```

3. **Configure API Keys:**
   Copy the example environment file and add your provider keys, or skip this step to configure models interactively on first launch:
   ```powershell
   copy .env.example .env
   ```

4. **Launch Prime Agent:**
   - Using **PowerShell**:
     ```powershell
     .\scripts\windows\prime-agent.ps1
     ```
   - Using **Command Prompt**:
     ```cmd
     scripts\windows\prime-agent.cmd
     ```

---

## First Launch & Authentication

On first launch, Prime Agent opens an interactive welcome and onboarding screen. Run `/login` to authenticate with Prime Intellect or configure individual API keys (Anthropic, OpenAI, Gemini, Groq, DeepSeek, xAI, OpenRouter, Bedrock, Mistral, Cerebras).

> [!WARNING]
> Prime Agent executes model-generated Python code and shell commands with your user permissions. The worker and kernel isolation layers manage runtime lifecycle and stability; they do **not** form a security sandbox. Only run Prime Agent in trusted directories and inspect model actions before execution.

---

## Useful Commands

```bash
prime-agent agents                   # Browse active, idle, and saved sessions
prime-agent attach <agent>           # Reattach to a running background session
prime-agent --resume <path|id>       # Resume a saved session
prime-agent status                   # Inspect daemon and background service state
prime-agent doctor [--fix]           # Diagnose and repair background services
prime-agent update [--force]         # Check for and apply updates
prime-agent shutdown [--force]       # Stop every active agent, worker, and daemon
```

---

## Built for Long-Running Work

- **Continual Harness:** `/refine` persists targeted, reviewable updates as supplemental prompts, memories, skills, or subagent specifications with snapshot history.
- **Agent-to-Agent Communication:** Running agents and retained subagents discover one another and coordinate work.
- **Daemon-Backed Continuity:** Active sessions, IPython state, and schedules persist across terminal disconnections.
- **Heartbeats & Schedules:** `/heartbeat` and `prime-agent schedule` allow agents to wake up periodically or trigger at specified times.
- **Persistent Goals:** `/goal` maintains an objective with token budgeting across multiple interaction turns.
- **Autonomous Mode:** `/autonomous` continues execution within explicit turn, token, and time budgets with optional verification gates.

---

## Documentation

- [Quickstart Guide](packages/coding-agent/docs/quickstart.md) — Setup, authentication, and first session
- [Usage & CLI Reference](packages/coding-agent/docs/usage.md) — CLI flags, sessions, autonomous mode, and output formats
- [Windows Notes](packages/coding-agent/docs/windows.md) — Windows environment notes and shell configurations
- [Long-Running & Background Agents](packages/coding-agent/docs/long-running-agents.md) — Detaching, reattaching, goals, and schedules
- [RLM Programming Model](packages/coding-agent/docs/rlm.md) — Persistent IPython, subagent calls, and skills
- [JSON Mode](packages/coding-agent/docs/json.md) & [RPC Mode](packages/coding-agent/docs/rpc.md) — Headless automation and programmatic control
- [Skills System](packages/coding-agent/docs/skills.md) — Creating and installing Python skills
- [Provider Setup](packages/coding-agent/docs/providers.md) — Supported subscription and API key providers
- [Architecture Overview](packages/coding-agent/docs/architecture.md) — Daemon, worker, kernel, and process model
- [Development Guide](packages/coding-agent/docs/development.md) — Building and testing from source

---

## macOS / Linux Usage

For macOS and Linux systems, upstream Prime Agent can be run directly from source or via the official upstream installer:

```bash
# Upstream installer (macOS / Linux)
curl -fsSL https://app.primeintellect.ai/prime-agent/install.sh | sh

# Or run from source in this repo
./prime-agent.sh
```

---

## Acknowledgements

- **[Prime Intellect](https://primeintellect.ai)** for creating and maintaining the original [Prime Agent](https://github.com/PrimeIntellect-ai/prime-agent).
- **[Mario Zechner](https://github.com/badlogic)** and contributors for the underlying [`pi`](https://github.com/earendil-works/pi) agent and TUI architecture.

---

## License

Prime Agent is open-source software licensed under the [MIT License](LICENSE).
