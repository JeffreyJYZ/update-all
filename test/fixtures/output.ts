/** Fake child output. Each `\r` redraws the same screen row, like a real pty job. */

/** Brew download bar: three redraws, then install completes. */
export const BREW_PROGRESS =
	"==> Downloading foo\r[######          ] 30%\r[############    ] 60%\r[################] 100%\r\n==> Installed foo\r\n";

/** What a VT screen must show after the last redraw. */
export const BREW_FINAL = "[################] 100%";

/** Stale redraw states that must not survive on the painted screen. */
export const BREW_STALE = ["30%", "60%"];

/** Skills spinner. Every frame is padded to one width so redraws fully cover it. */
export const SKILLS_SPINNER =
	"Updating skills \r| fetching      \r/ fetching      \r- fetching      \r\\ fetching      \rdone: 12 updated\r\n";

/** Final spinner state. */
export const SKILLS_FINAL = "done: 12 updated";

/** Spinner frames that must not survive. */
export const SKILLS_STALE = ["| fetching", "/ fetching", "- fetching", "\\ fetching"];

/** A failing job's log tail. */
export const FAILING_JOB =
	"==> brew upgrade\r\nError: cannot upgrade foo: conflict\r\n==> exit 1\r\n";

/** The decisive line in the failing log. */
export const FAILING_LINE = "Error: cannot upgrade foo: conflict";

/** Fake registry job ids, in declared order. */
export const FAKE_IDS = ["alpha", "brew", "gamma", "delta"] as const;

/** Clean jobs as they appear in registry order, with durations and result text. */
export const CLEAN = [
	{ name: "alpha", ms: 400, result: "alpha done" },
	{ name: "beta", ms: 1200, result: "beta done" },
	{ name: "gamma", ms: 2100, result: "gamma done" },
] as const;

/** Duration text format used by the summary: one decimal place. */
export function secs(ms: number): string {
	return `${(ms / 1000).toFixed(1)}s`;
}

/** Last meaningful line after redraws, ANSI and a trailing path are discarded. */
export const MEANINGFUL_RESULT = "Installed foo";
