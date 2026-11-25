import { describe, expect, test } from "bun:test";
import brew from "../../src/jobs/brew.ts";
import { resultLines } from "../../src/update-all-summary.ts";
import { BREW_UPGRADED, HINTS_LINE, paths, results, SKILLS_RESULT } from "./real-logs.ts";

describe("homebrew env hints", () => {
	test("env-hints line never becomes a result when it is last", () => {
		expect(results.hintsLast).not.toContain("HOMEBREW_NO_ENV_HINTS");
		expect(results.hintsLast).not.toContain("Hide these hints");
		const line = resultLines([
			{ name: "brew", code: 0, ms: 5700, result: results.hintsLast, log: paths.hintsLastLog },
		])[0];
		expect(line).not.toContain(HINTS_LINE);
	});

	test("env-hints line mid-log does not shadow the final summary", () => {
		expect(results.hintsMid).toBe(BREW_UPGRADED);
		expect(results.hintsMid).not.toContain("HOMEBREW_NO_ENV_HINTS");
	});

	test("brew log ending with an upgrade line yields exactly that line", () => {
		expect(results.upgraded).toBe(BREW_UPGRADED);
		expect(
			resultLines([
				{
					name: "brew",
					code: 0,
					ms: 8000,
					result: results.upgraded,
					log: paths.upgradedLog,
				},
			])[0],
		).toContain(BREW_UPGRADED);
	});

	test("no-op brew log yields up to date", () => {
		expect(results.noOpBrew).toBe("up to date");
		const line = resultLines([
			{ name: "brew", code: 0, ms: 5700, result: results.noOpBrew, log: paths.noOpBrewLog },
		])[0];
		expect(line).toContain("up to date");
		expect(line).not.toContain("no output");
	});

	test("brew job sets HOMEBREW_NO_ENV_HINTS=1", () => {
		expect(brew.env?.HOMEBREW_NO_ENV_HINTS).toBe("1");
	});

	test("skills log ending with the update summary is unchanged", () => {
		expect(results.skills).toBe(SKILLS_RESULT);
	});
});
