# update-all

![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-blue?style=flat)
![Runtime](https://img.shields.io/badge/runtime-Bun-fbf0df?style=flat&logo=bun)

Run your global upgrade tools in parallel, each in its own live terminal pane.

## What it does

`update-all` runs three global upgrade jobs at the same time:

- `skills update -g` — update globally installed skills
- `brew upgrade -y` — upgrade Homebrew packages without prompting
- `bun update -g` — update globally installed Bun packages

Each job gets its own pane. Watch all three at once, focus the one that needs input, and read any job's output after they finish.

## Why a TUI

`brew` draws its download percentage only on a TTY. `skills` draws its spinner only on a TTY. Three live terminal UIs cannot share one stream: piping all three into one terminal loses brew's bar and skills' spinner, and a `\r` progress redraw leaves the cursor without a newline, so the next tagged line lands mid-bar. Giving each job a pane backed by a real pty lets each child see a terminal and animate inside that pane.

## Install

The package is not published on npm. Clone the repo, then install and link the CLI:

```sh
bun install
bun link
```

Or run it directly without linking:

```sh
bun src/update-all.ts
```

## Keys

| Key   | Action                                           |
| ----- | ------------------------------------------------ |
| `Tab` | Cycle focus to the next pane                     |
| `]`   | Grow the focused pane                            |
| `[`   | Shrink the focused pane, down to a 4-row minimum |
| `q`   | Quit and kill every child                        |

Focus sends keystrokes to that pane's child process. That is how `sudo` gets its password: press `Tab` until the pane prompting for the password is focused, then type there. A pane you are not focused on will not receive what you type. The TUI stays open after the last job finishes, so panes remain readable until you press `q`.

## Flags

| Flag              | Effect                                                            |
| ----------------- | ----------------------------------------------------------------- |
| `--only <job>`    | Run only the named job; repeatable. Jobs: `skills`, `brew`, `bun` |
| `--no-tui`        | Skip the TUI and use piped mode                                   |
| `--json`          | Print a machine-readable summary                                  |
| `-h`, `--help`    | Show help                                                         |
| `-v`, `--version` | Show version                                                      |

When stdout is not a TTY, the TUI is skipped and piped mode runs automatically, so `update-all | tee` still works. Each job's full output is written to `~/.cache/update-all/<job>.log`, truncated at the start of a run. The process exits with the worst exit code across the jobs.

## After you exit

`q` tears down the TUI, restores the screen, and prints a result table with one row per job in registry order:

```text
=== update-all results ===
-------------------------------------------
skills ok 0.1s Updated 2 skill(s)
brew   ok 58.4s Upgraded 4 outdated packages
bun    ok 23.1s 22 packages installed

all jobs ok
```

The result text is the last meaningful line of that job's log, with ANSI escapes and `\r` progress redraws stripped. A failed job gets a block instead of a row: its header with exit code and duration, the last 30 lines of its log, and the log path. `--json` carries the same fields as `ms` and `result` per job.

## Adding a job

Jobs are a registry: one file per job under `src/jobs/`, each exporting `{ id, label, argv, pty?, env?, log }`, collected in `src/jobs/index.ts`. A fourth job needs one new file and one import in `src/jobs/index.ts` — no layout edits. Pane layout, focus order, `--only`, and the summary all derive from that array. Set `pty` for a job that needs a terminal to draw its progress bar; without it, the job runs piped and shows no bar.

## Requirements

- macOS or Linux
- Bun
- Homebrew
- The `skills` CLI
