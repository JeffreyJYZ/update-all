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

/** Even initial heights that sum to `total`, each at least `min`. */
export function splitHeights(total: number, count: number, min = MIN_PANE_HEIGHT): number[] {
	if (count <= 0) return [];
	const each = Math.max(min, Math.floor(total / count));
	const heights = Array.from({ length: count }, () => each);
	let spare = total - each * count;
	for (let i = 0; spare !== 0 && i < count * 2; i++, spare > 0 ? spare-- : spare++) {
		const index = i % count;
		if (spare > 0) heights[index]++;
		else if (heights[index] > min) heights[index]--;
		else spare++;
	}
	return heights;
}

/**
 * Grow or shrink one pane by at most `delta`, borrowing from the following
 * panes. Total height and every pane's minimum are preserved.
 */
export function resizeHeights(
	heights: number[],
	index: number,
	delta: number,
	min = MIN_PANE_HEIGHT,
): number[] {
	const next = [...heights];
	const count = next.length;
	if (count < 2 || index < 0 || index >= count || delta === 0) return next;
	const others = Array.from({ length: count - 1 }, (_, k) => (index + 1 + k) % count);
	let remaining = delta;
	if (remaining > 0) {
		for (const other of others) {
			const room = Math.max(0, next[other] - min);
			const taken = Math.min(room, remaining);
			next[other] -= taken;
			next[index] += taken;
			remaining -= taken;
			if (remaining === 0) break;
		}
	} else {
		const room = Math.max(0, next[index] - min);
		const given = Math.min(room, -remaining);
		next[index] -= given;
		next[others[0]] += given;
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
