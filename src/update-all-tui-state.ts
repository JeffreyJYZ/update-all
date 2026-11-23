/** Pure TUI state helpers. No renderer, no processes, no terminal I/O. */
import { formatDuration } from "./update-all-log.ts";

/** Smallest pane height the `[` key allows. */
export const MIN_PANE_HEIGHT = 4;

/** Rows reserved for the bottom status line. */
export const STATUS_ROWS = 1;

/** One item of the bottom status line. */
export interface StatusItem {
	name: string;
	/** null while the job is still running. */
	code: number | null;
	elapsedMs: number;
}

/** Seconds as m:ss, for example 0:03 or 1:05. */
export function formatElapsed(ms: number): string {
	const seconds = Math.floor(Math.max(0, ms) / 1000);
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Next focused pane, wrapping both directions. */
export function cycleFocus(current: number, count: number, backwards = false): number {
	if (count <= 0) return 0;
	return (current + (backwards ? -1 : 1) + count) % count;
}

/** Even initial heights that sum to `total` while total is at least count*min. */
export function splitHeights(total: number, count: number, min = MIN_PANE_HEIGHT): number[] {
	if (count <= 0) return [];
	const heights = Array.from({ length: count }, () => Math.max(min, Math.floor(total / count)));
	let spare = total - heights.reduce((sum, height) => sum + height, 0);
	for (let i = 0; i < count * 2; i++) {
		if (spare === 0) break;
		const index = i % count;
		if (spare > 0) {
			heights[index]++;
			spare--;
		} else if ((heights[index] ?? 0) > min) {
			heights[index]--;
			spare++;
		}
	}
	return heights;
}

/** Boundary index below pane `index`, or the one above it for the last pane. */
export function boundaryFor(index: number, count: number): number {
	if (count < 2 || index < 0 || index >= count) return -1;
	return index < count - 1 ? index : count - 2;
}

/**
 * Move one boundary. Positive delta grows the pane above and shrinks the one
 * below. A move that breaks either pane's minimum is rejected whole.
 */
export function moveBoundary(
	heights: number[],
	boundary: number,
	delta: number,
	min = MIN_PANE_HEIGHT,
): number[] {
	const next = [...heights];
	const above = next[boundary];
	const below = next[boundary + 1];
	if (above === undefined || below === undefined || delta === 0) return next;
	if (delta > 0) {
		if (below - delta < min) return next;
		next[boundary] = above + delta;
		next[boundary + 1] = below - delta;
	} else {
		const amount = -delta;
		if (above - amount < min) return next;
		next[boundary] = above - amount;
		next[boundary + 1] = below + amount;
	}
	return next;
}

/** `[`/`]` on a focused pane move its adjacent boundary like a split. */
export function resizeHeights(
	heights: number[],
	index: number,
	delta: number,
	min = MIN_PANE_HEIGHT,
): number[] {
	const boundary = boundaryFor(index, heights.length);
	if (boundary < 0) return [...heights];
	return moveBoundary(heights, boundary, index < heights.length - 1 ? delta : -delta, min);
}

/** Rescale heights to a new row budget, preserving proportions and the total. */
export function rebalanceHeights(
	heights: number[],
	available: number,
	min = MIN_PANE_HEIGHT,
): number[] {
	const count = heights.length;
	if (count === 0) return [];
	const sum = heights.reduce((total, height) => total + height, 0) || available;
	const next = heights.map((height) => Math.max(min, Math.floor((height / sum) * available)));
	let spare = available - next.reduce((total, height) => total + height, 0);
	for (let i = 0; i < count * 2; i++) {
		const index = i % count;
		if (spare > 0) {
			next[index]++;
			spare--;
		} else if (spare < 0 && (next[index] ?? 0) > min) {
			next[index]--;
			spare++;
		}
		if (spare === 0) break;
	}
	return next;
}

/** Bottom line: one job status per pane, plus the final verdict when supplied. */
export function formatStatus(items: StatusItem[], verdict?: string): string {
	const parts = items.map((item) => {
		const state = item.code === null ? "running" : `exit ${item.code}`;
		return `${item.name} · ${state} · ${formatElapsed(item.elapsedMs)}`;
	});
	return verdict ? `${parts.join("   ")}   ${verdict}` : parts.join("   ");
}

/** Status line after every child exits. The renderer stays mounted until q. */
export function doneStatus(items: StatusItem[], totalMs: number): string {
	const failed = items.filter((item) => item.code !== null && item.code !== 0);
	if (failed.length > 0) {
		const names = failed.map((item) => `${item.name} exit ${item.code}`).join(", ");
		return `failed · ${names} · q to exit`;
	}
	return `all jobs ok · all done · ${items.length} ok · ${formatDuration(totalMs)} · q to exit`;
}

/** Exit with the worst job code, or 1 when a job warned without failing. */
export function worstExitCode(codes: number[]): number {
	return codes.reduce((worst, code) => Math.max(worst, code), 0);
}

/** Keyboard scroll actions. Shift is handled by the key listener, not here. */
export type ScrollKind = "up-one" | "down-one" | "up-page" | "down-page" | "top" | "bottom";

/** Offset in log lines, total lines, and visible rows. */
export interface ScrollState {
	offset: number;
	total: number;
	visible: number;
}

/** Clamp an offset to 0 … total - visible. */
export function clampScroll(requested: number, state: ScrollState): number {
	const max = Math.max(0, state.total - state.visible);
	return Math.max(0, Math.min(requested, max));
}

/** New offset for one keyboard scroll action. */
export function scrollTarget(kind: ScrollKind, state: ScrollState): number {
	switch (kind) {
		case "up-one":
			return clampScroll(state.offset + 1, state);
		case "down-one":
			return clampScroll(state.offset - 1, state);
		case "up-page":
			return clampScroll(state.offset + state.visible, state);
		case "down-page":
			return clampScroll(state.offset - state.visible, state);
		case "top":
			return 0;
		case "bottom":
			return clampScroll(state.total, state);
	}
}

/** Status suffix while a pane is scrolled away from the live screen. */
export function scrollStatus(label: string, state: ScrollState): string {
	return `${label} · scroll ${state.offset}/${state.total}`;
}

/** Headline banner text and its colour class. */
export function bannerFor(items: StatusItem[], totalMs: number): { text: string; ok: boolean } {
	const failed = items.filter((item) => item.code !== null && item.code !== 0);
	if (failed.length > 0) {
		const names = failed.map((item) => `${item.name} exit ${item.code}`).join(", ");
		return {
			text: `✖ FAILED · ${names} · ${items.length - failed.length} ok · press q to exit`,
			ok: false,
		};
	}
	return {
		text: `✔ ALL DONE · ${items.length} jobs ok · ${formatDuration(totalMs)} · press q to exit`,
		ok: true,
	};
}
