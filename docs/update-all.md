# update-all

Runs three global upgrade jobs concurrently: `skills update -g`, `brew upgrade -y`, and `bun update -g`.

## Why a TUI

`brew` draws its download percentage only on a TTY. `skills` draws its spinner only on a TTY. The old front end piped all three jobs into one stream, so brew's bar vanished, skills had no spinner, and a pty bar that redraws with `\r` left the cursor without a newline, so the next tagged line landed mid-bar. Three live terminal UIs cannot share one terminal by printing. The rebuild gives each job its own pane with a real pty, so each child sees a terminal and its redraws animate inside that pane.

## Layout

Three panes stacked vertically, full width. Top region is the panes; bottom is one status line. The status line shows `job name · exit code or running · elapsed` for each job, then the summary verdict once all three finish.

The TUI does not close when the last job finishes. The panes stay mounted and readable, and `Tab`, the resize keys and the scroll keys keep working, so you can read any job's output at leisure before leaving.

When the last job exits, a full-width banner appears above the panes: `✔ ALL DONE · 3 jobs ok · 84.6s · press q to exit`, or `✖ FAILED · brew exit 1 · 2 ok · press q to exit` when something failed. It stays until you press `q`.

## Keys

- `Tab` — cycle focus to the next pane.
- `]` — move the boundary below the focused pane down, growing it. On the last pane it moves the boundary above it.
- `[` — move that boundary the other way, shrinking it. Neither side may go below 4 rows, and an illegal move is ignored rather than clamped.
- `Shift+Up` / `Shift+Down` — scroll the focused pane by one row.
- `Shift+PgUp` / `Shift+PgDn` — scroll by one page.
- `Shift+Home` / `Shift+End` — jump to the oldest output, or back to the live screen.
- `q` — quit and kill every child.

Every boundary in the stack moves this way, so all panes are resizable, not just the focused one. Plain keys, arrows included, still go to the child; only the Shift combinations scroll.

Focus means keystrokes go to that pane's child process, not to the terminal at large. That is how `sudo` works: focus the pane that is prompting, then type the password there. A pane you are not focused on will not receive what you type.

While a pane is scrolled, the status line shows `name · scroll N/total`; it clears when you are back at the live screen.

## Flags

- `--only <job>` — run one job; repeatable. Jobs: `skills`, `brew`, `bun`.
- `--no-tui` — skip the TUI and use the piped mode.
- `--json` — print a machine-readable summary.
- `-h`, `--help` — show help.
- `-v`, `--version` — show version.

## Non-TTY fallback

When stdout is not a TTY, the TUI is skipped and the old piped mode runs, so `update-all | tee` still works: output is streamed as tagged lines, logs are still written, and the summary prints at the end. `--no-tui` forces this mode on a TTY.

## Logs and exit code

Each job's full output goes to `~/.cache/update-all/<job>.log`, truncated at the start of a run. The summary prints the path. The process exits with the worst exit code across the jobs.

## When it looks wrong

- **No bar in a pane** — that child is not seeing a terminal. Check that you are not in `--no-tui` or piped mode and that stdout is a TTY.
- **Empty transcript flagged as a no-op** — a pty job that exits 0 with no printable output is reported as "exited 0 without doing anything"; it counts as a failure rather than a clean run.
- **Job hangs on sudo** — press `Tab` until focus is on the pane prompting for the password, then type there. Press `q` to kill every child if you need to abort.

## Adding a job

Jobs are a registry: one file per job under `src/jobs/`, each exporting `{ id, label, argv, pty?, env?, log }`, collected in `src/jobs/index.ts`.

Pane layout, focus order, `--only` and the summary all derive from that array. A fourth job needs one new file and one import in `src/jobs/index.ts`. No layout edits.

`pty` marks a job that needs a terminal. Progress bars, such as brew's download percentage, are drawn only when the child has a TTY. Without `pty`, the job runs piped and shows no progress bar.

## Assumptions

The rebuild brief does not restate the log directory, the empty-transcript no-op warning, or the piped-mode tag format; those are carried over from the current `src/update-all.ts` and its original build brief, and are expected to survive the TUI rewrite. The brief also does not give an amount per `[` / `]` press, so only the direction and the 4-row floor are documented here.

## After you exit

`q` tears the TUI down, restores the screen, and then prints a result table with one row per job, in registry order:

```text
=== update-all results ===
-------------------------------------------
skills ok 0.1s Updated 2 skill(s)
brew   ok 58.4s Upgraded 4 outdated packages
bun    ok 23.1s 22 packages installed

all jobs ok
```

The result text is the last meaningful line of that job's log, with ANSI escapes and `\r` progress redraws stripped. A job that failed keeps a block instead of a row: its header with the exit code and duration, the last 30 lines of its log, and the log path. `--json` carries the same fields as `ms` and `result` per job.
