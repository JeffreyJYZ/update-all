/** OpenTUI front end. Jobs finish; only q or Ctrl-C tears down the renderer. */
import { type CliRenderer, createCliRenderer, type KeyEvent } from "@opentui/core";
import { JOBS } from "./jobs/index.ts";
import { type Job, type JobResult, defaultLogDir } from "./update-all-jobs.ts";
import type { TuiView } from "./update-all-panes.ts";
import { type KeyState, type TuiSession, mountSession } from "./update-all-session.ts";
import { cycleFocus, resizeHeights } from "./update-all-tui-state.ts";

/** Wire Tab, Shift+Tab, `[`, `]`, q and Ctrl-C. Returns a detach function. */
export function attachKeys(
	renderer: CliRenderer,
	view: TuiView,
	state: KeyState,
	onQuit: () => void,
): () => void {
	const onKey = (key: KeyEvent) => {
		if (key.name === "q" || (key.name === "c" && key.ctrl)) {
			key.stopPropagation();
			onQuit();
			return;
		}
		if (key.name === "tab") {
			key.stopPropagation();
			state.focused = cycleFocus(state.focused, view.panes.length, key.shift);
			view.setFocus(state.focused);
			return;
		}
		if (key.name === "[" || key.name === "]") {
			key.stopPropagation();
			state.heights = resizeHeights(state.heights, state.focused, key.name === "]" ? 1 : -1);
			view.setHeights(state.heights);
		}
	};
	renderer.keyInput.on("keypress", onKey);
	return () => renderer.keyInput.off("keypress", onKey);
}

export interface TuiOptions {
	jobs?: Job[];
	logDir?: string;
	/** Injectable for tests; production creates its own renderer. */
	renderer?: CliRenderer;
}

/** The mounted view. `results` settles only after q or Ctrl-C. */
export interface MountedTui {
	view: TuiView;
	state: KeyState;
	results: Promise<JobResult[]>;
	quit(): void;
	dispose(): void;
}

/** Mount jobs and keys on an existing renderer. Used by runTui and by tests. */
export function mountTui(
	renderer: CliRenderer,
	options: { jobs?: Job[]; logDir?: string } = {},
): MountedTui {
	const session: TuiSession = mountSession(
		renderer,
		options.jobs ?? JOBS,
		options.logDir ?? defaultLogDir(),
	);
	const detachKeys = attachKeys(renderer, session.view, session.state, () => session.quit());
	return {
		view: session.view,
		state: session.state,
		results: session.waitForQuit(),
		quit: () => session.quit(),
		dispose() {
			detachKeys();
			session.dispose();
		},
	};
}

/** Wait for quit, then leave the alternate screen before returning results. */
export async function runTui(options: TuiOptions = {}): Promise<JobResult[]> {
	const renderer =
		options.renderer ??
		(await createCliRenderer({ exitOnCtrlC: false, screenMode: "alternate-screen" }));
	const mounted = mountTui(renderer, { jobs: options.jobs, logDir: options.logDir });
	const onSigint = () => mounted.quit();
	process.on("SIGINT", onSigint);
	try {
		return await mounted.results;
	} finally {
		process.off("SIGINT", onSigint);
		mounted.dispose();
		renderer.destroy();
		await renderer.closed;
	}
}
