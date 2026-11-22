/** Log reading shared by the piped runner and the summary report. */
import { readFileSync } from "node:fs";

/** CSI escape sequences left behind by pty transcripts. */
// biome-ignore lint/complexity/useRegexLiterals: string form keeps the ESC out of a regex literal.
export const ANSI = new RegExp("\\u001b\\[[0-?]*[ -/]*[@-~]", "g");

const PROGRESS = /\[[=>#*\s.-]+\]\s*\d+%|^\d+%$|\b\d+%\s*(complete|downloaded|installed)\b/i;
const SPINNER = /^[|/-]\s/;
const BARE_PATH = /^(~|\.{1,2}|\/)[^\s]*\/[^\s]*$/;

/** Strip ANSI, then keep only the last \r redraw of one log line. */
export function cleanLine(line: string): string {
	const plain = line.replace(ANSI, "");
	const states = plain.split("\r");
	return (states[states.length - 1] ?? "").trim();
}

/** Last `count` lines of a log, or empty when it cannot be read. */
export function tail(path: string, count: number): string {
	try {
		return readFileSync(path, "utf8")
			.trimEnd()
			.split("\n")
			.map(cleanLine)
			.slice(-count)
			.join("\n");
	} catch {
		return "";
	}
}

function meaningful(line: string): boolean {
	if (line.length === 0) return false;
	if (PROGRESS.test(line) || SPINNER.test(line)) return false;
	if (BARE_PATH.test(line) && !line.includes(" ")) return false;
	return true;
}

/** One line, truncated to the terminal width (at least 40 columns). */
export function truncateOneLine(text: string, width?: number): string {
	const limit = Math.max(40, width ?? process.stdout.columns ?? 80);
	if (text.length <= limit) return text;
	const cut = limit - 1;
	const space = text.lastIndexOf(" ", cut);
	const end = space > cut / 2 ? space : cut;
	return `${text.slice(0, end)}…`;
}

/** Last meaningful log line: no ANSI, no progress redraw, no bare path. */
export function resultFromLog(path: string): string {
	let text: string;
	try {
		text = readFileSync(path, "utf8");
	} catch {
		return "";
	}
	for (const raw of text.split("\n").reverse()) {
		const line = cleanLine(raw);
		if (meaningful(line)) return truncateOneLine(line);
	}
	return "";
}

/** A pty transcript with only `script` noise means the command never ran. */
export function transcriptIsBlank(path: string): boolean {
	let text: string;
	try {
		text = readFileSync(path).toString("latin1");
	} catch {
		return true;
	}
	const plain = text.replace(ANSI, "").replace(/\^[?@A-Z]/g, "");
	for (const ch of plain) {
		const code = ch.charCodeAt(0);
		if (code >= 0x20 && code !== 0x7f) return false;
	}
	return true;
}

/** 0.4s, 58.4s, or 1m05s. */
export function formatDuration(ms: number): string {
	const safe = Math.max(0, ms);
	if (safe < 60000) return `${(safe / 1000).toFixed(1)}s`;
	const minutes = Math.floor(safe / 60000);
	const seconds = Math.floor((safe % 60000) / 1000);
	return `${minutes}m${String(seconds).padStart(2, "0")}s`;
}
