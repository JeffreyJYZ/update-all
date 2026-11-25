import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createTestRenderer } from "@opentui/core/testing";
import { resultFromLog } from "../src/update-all-log.ts";
import { mountSession } from "../src/update-all-session.ts";
import { captured } from "./fixtures/captured-tails.ts";
import { fakeJob, tempDir } from "./fixtures/helpers.ts";

/** The three logs from the user's real run, read only. */
const REAL = [
	{ name: "skills", want: /Updated \d+ skill/ },
	{ name: "bun", want: /packages installed|Checked \d+ installs/ },
	{ name: "brew", want: /Downloaded|Upgraded|up to date|Already up-to-date/ },
];

describe("real on-disk logs", () => {
	test("captured tails yield their completion lines", () => {
		for (const job of REAL) {
			const name = job.name as keyof typeof captured;
			const result = resultFromLog(captured[name]);
			console.log(`CAPTURED ${job.name}: ${result}`);
			expect(result).toMatch(job.want);
		}
	});

	test("live logs never surface an env hint or section marker", () => {
		for (const job of REAL) {
			const path = join(homedir(), ".cache", "update-all", `${job.name}.log`);
			if (!existsSync(path) || statSync(path).size === 0) continue;
			const result = resultFromLog(path);
			console.log(`LIVE ${job.name}: ${result}`);
			expect(result).not.toContain("HOMEBREW_NO_ENV_HINTS");
			expect(result).not.toContain("HOMEBREW_NO_INSTALL_CLEANUP");
			expect(result).not.toContain("Hide these hints");
			expect(result).not.toContain("==>");
		}
	});
});

describe("PTY tail capture", () => {
	test("a summary printed last survives child exit in the log", async () => {
		const setup = await createTestRenderer({ width: 80, height: 24 });
		try {
			const logDir = tempDir();
			const job = fakeJob("fake", {
				argv: [
					"sh",
					"-c",
					"printf 'noise\\r'; printf 'Updating thing\\r'; printf '✓ Updated 1 skill(s)\\n'",
				],
			});
			const session = mountSession(setup.renderer, [job], logDir);
			const results = await session.results;
			const log = join(logDir, "fake.log");
			const text = readFileSync(log, "utf8");
			console.log(`CAPTURE tail: ${JSON.stringify(text.slice(-80))}`);
			expect(text).toContain("Updated 1 skill(s)");
			expect(results[0]?.result).toBe("✓ Updated 1 skill(s)");
			session.dispose();
		} finally {
			setup.renderer.destroy();
		}
	});
});
