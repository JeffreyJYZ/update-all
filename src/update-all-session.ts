/** Job lifecycle for the TUI. Children finish; the renderer stays until q. */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { CliRenderer } from "@opentui/core";
import { type PtyChild, startPtyChild } from "./update-all-child.ts";
import type { Job, JobResult } from "./update-all-jobs.ts";
import { resultFromLog } from "./update-all-log.ts";
import { createView, type TuiView } from "./update-all-panes.ts";
import { doneStatus, formatStatus, splitHeights } from "./update-all-tui-state.ts";

/** Mutable keyboard state, shared with attachKeys. */
export interface KeyState {
	heights: number[];
	focused: number;
}

export interface TuiSession {
	view: TuiView;
	state: KeyState;
	results: Promise<JobResult[]>;
	waitForQuit(): Promise<JobResult[]>;
	quit(): void;
	dispose(): void;
}

/** Mount N panes, spawn every child, and hold the renderer after they exit. */
export function mountSession(renderer: CliRenderer, jobs: Job[], logDir: string): TuiSession {
	mkdirSync(logDir, { recursive: true });
	const startedAt = Date.now();
	const state: KeyState = { heights: splitHeights(renderer.height - 1, jobs.length), focused: 0 };
	const view = createView(renderer, jobs, state.heights, renderer.width);
	const codes = new Map<string, number | null>();
	const starts = new Map<string, number>();
	const ends = new Map<string, number>();
	const children: PtyChild[] = [];
	let finished = false;
	let quitting = false;
	let resolveQuit: () => void = () => {};
	const quitPromise = new Promise<void>((resolve) => {
		resolveQuit = resolve;
	});

	const items = () =>
		jobs.map((job) => ({
			name: job.label,
			code: codes.get(job.id) ?? null,
			elapsedMs: (ends.get(job.id) ?? Date.now()) - (starts.get(job.id) ?? startedAt),
		}));
	const refresh = () => {
		if (!finished) view.setStatus(formatStatus(items()));
	};
	const timer = setInterval(refresh, 250);
	refresh();

	const results = Promise.all(
		jobs.map(async (job, index) => {
			const pane = view.panes[index];
			const log = join(logDir, job.log);
			const start = Date.now();
			starts.set(job.id, start);
			const child = startPtyChild(
				job.argv,
				pane.term,
				log,
				Math.max(1, renderer.width - 2),
				Math.max(1, state.heights[index] - 2),
				job.env,
			);
			children.push(child);
			codes.set(job.id, null);
			await child.child.exited;
			const code = child.child.exitCode ?? 1;
			codes.set(job.id, code);
			ends.set(job.id, Date.now());
			child.close();
			refresh();
			return { name: job.id, code, log, ms: Date.now() - start, result: resultFromLog(log) };
		}),
	);

	void results.then((all) => {
		finished = true;
		clearInterval(timer);
		const byId = new Map(all.map((result) => [result.name, result]));
		const finalItems = jobs.map((job) => {
			const result = byId.get(job.id);
			return {
				name: job.label,
				code: result?.code ?? null,
				elapsedMs: result?.ms ?? 0,
			};
		});
		view.setStatus(doneStatus(finalItems, Date.now() - startedAt));
	});

	return {
		view,
		state,
		results,
		quit() {
			if (quitting) return;
			quitting = true;
			clearInterval(timer);
			for (const child of children) child.kill();
			resolveQuit();
		},
		async waitForQuit() {
			await quitPromise;
			return await results;
		},
		dispose() {
			clearInterval(timer);
			for (const child of children) child.close();
		},
	};
}
