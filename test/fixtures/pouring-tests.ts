import { describe, expect, test } from "bun:test";
import { resultLines } from "../../src/update-all-summary.ts";
import { BREW_UPGRADED, HINTS_LINE, POURING_MANY, POURING_ONE, results } from "./real-logs.ts";

const lineFor = (result: string) =>
	resultLines([{ name: "brew", code: 0, ms: 5700, result, log: "/logs/brew.log" }])[0];

describe("brew pouring results", () => {
	test("one Pouring line yields upgraded zstd 1.6.0", () => {
		expect(results.pouringOne).toBe(POURING_ONE);
		expect(lineFor(results.pouringOne)).toContain(POURING_ONE);
	});

	test("two Pouring lines yield the count form", () => {
		expect(results.pouringMany).toBe(POURING_MANY);
		expect(lineFor(results.pouringMany)).toContain(POURING_MANY);
	});

	test("Cellar and Removing lines never become the result", () => {
		expect(results.cellarNoise).toBe("up to date");
		const line = lineFor(results.cellarNoise);
		expect(line).toContain("up to date");
		expect(line).not.toContain("Cellar");
		expect(line).not.toContain("Removing:");
	});

	test("env-hints line still never wins next to a Pouring line", () => {
		expect(results.hintsLast).not.toContain(HINTS_LINE);
		expect(results.hintsLast).not.toContain("HOMEBREW_NO_ENV_HINTS");
		expect(lineFor(results.hintsLast)).not.toContain(HINTS_LINE);
	});

	test("a real Upgraded summary outranks a Pouring line", () => {
		expect(results.upgraded).toBe(BREW_UPGRADED);
		expect(lineFor(results.upgraded)).toContain(BREW_UPGRADED);
		expect(lineFor(results.upgraded)).not.toContain(POURING_ONE);
	});
});
