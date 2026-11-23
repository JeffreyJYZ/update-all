/** Log reading shared by the piped runner and the summary report. */
import { readFileSync } from "node:fs";

/** CSI escape sequences left behind by pty transcripts. */
// biome-ignore lint/complexity/useRegexLiterals: string form keeps the ESC out of a regex literal.
export const ANSI = new RegExp("\\u001b\\[[0-?]*[ -/]*[@-~]", "g");

/** A real job completion line, preferred over transient output. */
const COMPLETION =
	/\b(Upgraded\b|packages installed\b|Updated\s+\d+\s+skill|Installed\b|Already up-to-date\b)/i;
const PROGRESS = /\[[=>#*\s.-]+\]\s*\d+%|\b\d+%$|\bDownloading\b|\/[-]+\b/i;
const SPINNER = /^[|/\\\-\u2800-\u28ff]\s/u;
const BARE_PATH = /^(~|\.{1,2}|\/)[^\s]*\/[^\s]*$/;

function parts(text: string): string[] {
	return text
		.replace(ANSI, "")
		.split(/[\r\n]/)
		.map((line) => line.trim().replace(/\s+/g, " "))
		.filter((line) => line.length > 0);
}

/** Last non-empty \r or \n segment of one raw log line. */
export function cleanLine(line: string): string {
	return parts(line).at(-1) ?? "";
}

/** Every non-empty line from the transcript, split on both \r and \n. */
export function logLines(path: string): string[] {
	try {
		return parts(readFileSync(path, "utf8"));
	} catch {
		return [];
	}
}

/** Last `count` lines of a log, or empty when it cannot be read. */
export function tail(path: string, count: number): string {
	return logLines(path).slice(-count).join("\n");
}

function meaningful(line: string): boolean {
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

/**
 * Prefer the last real completion line, then the last line that is not a
 * spinner, progress redraw or bare path.
 */
export function resultFromLog(path: string): string {
	const lines = logLines(path);
	for (let i = lines.length - 1; i >= 0; i--) {
		const line = lines[i];
		if (line && meaningful(line) && COMPLETION.test(line)) return truncateOneLine(line);
	}
	for (let i = lines.length - 1; i >= 0; i--) {
		const line = lines[i];
		if (line && meaningful(line)) return truncateOneLine(line);
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
