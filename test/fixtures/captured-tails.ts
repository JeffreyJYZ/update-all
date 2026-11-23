/** Exact tail snippets captured from the user's on-disk logs before tests overwrote them. */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempDir } from "./helpers.ts";

function write(name: string, text: string): string {
	const path = join(tempDir(), name);
	writeFileSync(path, text);
	return path;
}

export const captured = {
	skills: write(
		"skills-captured.log",
		"\x1b[32m✓\x1b[39m  Downloaded 1 source\r\n" +
			"\x1b[?25h\x1b[38;5;145mUpdating ui-ux-pro-max\x1b[0m\r\n" +
			"  \x1b[38;5;145m✓\x1b[0m Updated ui-ux-pro-max\r\n" +
			"\r\n" +
			"\x1b[38;5;145m✓ Updated 1 skill(s)\x1b[0m\r\n" +
			"\r\n",
	),
	bun: write(
		"bun-captured.log",
		"\x1b[35D\x1b[0K  ◆ next [3507/3506]\r\n" +
			"\x1b[0m\x1b[36m◆\x1b[0m \x1b[1m@rc-component/tour\x1b[0m \x1b[2m2.4.0 → 2.4.1\x1b[0m\r\n" +
			"\r\n" +
			"\x1b[32m2\x1b[0m packages\x1b[0m installed \x1b[0m\x1b[2m[\x1b[1m12.28s\x1b[0m\x1b[2m]\x1b[0m\x1b[0m\r\n",
	),
	brew: write(
		"brew-captured.log",
		"\x1b[34m⠴\x1b[0m JSON API packages.jws.json Downloading  16.3MB/-------\x1b[K\r\n" +
			"\x1b[32m✓\x1b[0m JSON API packages.jws.json Downloaded   16.3MB/ 16.3MB\x1b[K\r\n" +
			"\x1b[K\x1b[?2026l\x1b[?25h\r\n",
	),
};

export const expected = {
	skills: "✓ Updated 1 skill(s)",
	bun: "2 packages installed [12.28s]",
	brew: "Downloaded 16.3MB/ 16.3MB",
};
