import { describe, expect, test } from "bun:test";
import { logLines } from "../../src/update-all-log.ts";
import { resultLines } from "../../src/update-all-summary.ts";
import { BREW_RESULT, BUN_RESULT, SKILLS_RESULT, paths, results } from "./real-logs.ts";

describe("real pty log results", () => {
	test("skills log yields the final summary, not no output", () => {
		expect(results.skills).toBe(SKILLS_RESULT);
		const line = resultLines([
			{ name: "skills", code: 0, ms: 4300, result: results.skills, log: paths.skillsLog },
		])[0];
		expect(line).toContain(SKILLS_RESULT);
		expect(line).not.toContain("no output");
	});

	test("bun log yields the install summary after hundreds of redraws", () => {
		expect(results.bun).toBe(BUN_RESULT);
		expect(
			resultLines([
				{ name: "bun", code: 0, ms: 12280, result: results.bun, log: paths.bunLog },
			])[0],
		).not.toContain("no output");
	});

	test("brew log falls back to the final download line", () => {
		expect(results.brew).toBe(BREW_RESULT);
		expect(
			resultLines([
				{ name: "brew", code: 0, ms: 5000, result: results.brew, log: paths.brewLog },
			])[0],
		).toContain(BREW_RESULT);
	});

	test("ANSI and every carriage-return redraw are stripped from log lines", () => {
		for (const path of [paths.skillsLog, paths.bunLog, paths.brewLog]) {
			const lines = logLines(path);
			expect(lines.length).toBeGreaterThan(0);
			for (const line of lines) {
				expect(line).not.toContain("\r");
				expect(line).not.toContain("\x1b[");
			}
		}
		expect(logLines(paths.bunLog).some((line) => line.startsWith("Resolving 300/300"))).toBe(
			true,
		);
	});

	test("a log of pure escape sequences yields an empty result", () => {
		expect(results.escape).toBe("");
	});

	test("result text never exceeds the width cap", () => {
		const cap = Math.max(40, process.stdout.columns ?? 80);
		expect(results.long.length).toBeLessThanOrEqual(cap);
		expect(results.long.endsWith("…")).toBe(true);
	});

	test("a summary line arriving last wins over earlier noise", () => {
		expect(results.skills).toBe(SKILLS_RESULT);
		expect(results.skills).not.toContain("Updated ui-ux-pro-max");
		expect(results.bun).not.toContain("Resolving");
	});
});
