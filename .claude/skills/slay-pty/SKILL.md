---
name: slay-pty
description: "Interact with PTY terminal sessions via the slay CLI"
trigger: auto
---

PTY commands interact with terminal sessions managed by the SlayZone app — the actual terminal tabs you see in each task. Use these to read output, send input, and orchestrate AI coding agents programmatically.

All commands support ID prefix matching.

## Commands

- `slay pty list [--json]`
  List active PTY sessions. Shows session ID, task ID, terminal mode, current state, and age.

- `slay pty buffer <id>`
  Dump the full terminal buffer content to stdout. Useful for reading what an AI agent has output without streaming.

- `slay pty follow <id> [--full]`
  Stream PTY output in real time. `--full` replays the existing buffer first before streaming new output. Streams until the session exits.

- `slay pty write <id> <data>`
  Send raw data directly to PTY stdin. No newline handling or encoding — sends exactly what you provide. Use for low-level control.

- `slay pty submit <id> [text] [--wait] [--no-wait] [--timeout <ms>]`
  High-level text submission with AI-mode awareness. If no text argument is given, reads from stdin (pipe-friendly). For AI modes like `claude-code`, internal newlines are encoded as Kitty shift-enter sequences (`\x1b[13;2u`) so multi-line text is submitted as a single input rather than being split into separate commands.

  **Wait behavior:** By default, `submit` waits for the session to reach the `attention` state (= the AI CLI is ready for input) before sending. This is automatic for AI modes. Use `--no-wait` to send immediately (default for plain terminal modes). Timeout defaults to 60 seconds.

- `slay pty wait <id> [--state <state>] [--timeout <ms>] [--json]`
  Block until a session reaches a specific state. Default state is `attention` (AI ready for input), timeout is 60 seconds. Exit codes: 0 = reached state, 2 = timeout, 1 = session died.

- `slay pty kill <id>` — terminate a PTY session.

## Orchestration patterns

Submit a prompt to a Claude Code session and wait for completion:
```bash
slay pty submit <id> "Fix the failing tests in src/auth.ts"
slay pty wait <id> --state attention --timeout 300000
slay pty buffer <id>  # read the result
```

Pipe multi-line input:
```bash
cat prompt.md | slay pty submit <id>
```
