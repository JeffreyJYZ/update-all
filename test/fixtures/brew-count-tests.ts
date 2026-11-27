import { describe, expect, test } from "bun:test";
import { resultLines } from "../../src/update-all-summary.ts";
import { MIXED, ONE_CASK, SEVEN, results } from "./real-logs.ts";

const lineFor = (result: string) =>
	resultLines([{ name: "brew", code: 0, ms: 5700, result, log: "/logs/brew.log" }])[0];

describe("brew run-wide counts", () => {
	test("seven cask lines yield upgraded 7 packages", () => {
		expect(results.sevenCasks).toBe(SEVEN);
		expect(lineFor(results.sevenCasks)).toContain(SEVEN);
	});

	test("one cask yields upgraded wechat", () => {
		expect(results.oneCask).toBe(ONE_CASK);
		expect(lineFor(results.oneCask)).toContain(ONE_CASK);
	});

	test("three Pouring lines plus two casks yield upgraded 5 packages", () => {
		expect(results.mixed).toBe(MIXED);
		expect(lineFor(results.mixed)).toContain(MIXED);
	});

	test("a package in both a Pouring line and a cask counts once", () => {
		expect(results.duplicate).toBe(ONE_CASK);
		expect(results.duplicate).not.toContain("2 packages");
	});

	test("Upgrading 7 outdated packages is authoritative with fewer markers", () => {
		expect(results.authoritative).toBe(SEVEN);
		expect(lineFor(results.authoritative)).toContain(SEVEN);
	});

	test("hints, Cellar, Removing and ==> only yield up to date", () => {
		expect(results.cellarNoise).toBe("up to date");
	});

	test("an existing Upgraded 4 summary still wins", () => {
		expect(results.upgraded).toBe("Upgraded 4 outdated packages.");
	});
});
