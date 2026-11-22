/** Result table and failure details, shared by both front ends. */
import type { JobResult } from "./update-all-jobs.ts";
import { formatDuration, tail } from "./update-all-log.ts";

export interface Summary {
	text: string;
	ok: boolean;
	worst: number;
	warnings: string[];
}

function statusOf(result: JobResult): string {
	return result.noOp ? "warn" : result.code === 0 ? "ok" : `exit ${result.code}`;
}

/** One aligned line per job, in registry order. */
export function resultLines(results: JobResult[]): string[] {
	const nameW = results.reduce((max, result) => Math.max(max, result.name.length), 5);
	const statusW = results.reduce((max, result) => Math.max(max, statusOf(result).length), 2);
	const durW = results.reduce(
		(max, result) => Math.max(max, formatDuration(result.ms).length),
		2,
	);
	return results.map((result) => {
		const status = statusOf(result).padEnd(statusW);
		const duration = formatDuration(result.ms).padStart(durW);
		const text = result.result || "no output";
		return `${result.name.padEnd(nameW)} ${status} ${duration} ${text}`;
	});
}

/** Human report: table first, then any failure blocks and the verdict. */
export function summarize(results: JobResult[]): Summary {
	const warnings = results
		.filter((result) => result.noOp)
		.map((result) => `${result.name} exited 0 without doing anything`);
	const ok = results.every((result) => result.code === 0) && warnings.length === 0;
	const worst = results.reduce(
		(max, result) => Math.max(max, result.code),
		warnings.length > 0 ? 1 : 0,
	);
	const heading = "=== update-all results ===";
	const table = resultLines(results);
	const underline = "-".repeat(
		table.reduce((max, line) => Math.max(max, line.length), heading.length),
	);
	const lines = ["", heading, underline, ...table];

	for (const result of results) {
		if (result.code === 0) continue;
		lines.push("", `--- ${result.name} (exit ${result.code}) --- ${formatDuration(result.ms)}`);
		lines.push(tail(result.log, 30));
		lines.push(`log: ${result.log}`);
	}
	if (warnings.length > 0) lines.push("", "warnings:", ...warnings.map((line) => `  ${line}`));
	lines.push("", ok ? "all jobs ok" : `worst exit code: ${worst}`, "");
	return { text: lines.join("\n"), ok, worst, warnings };
}
