import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { JOBS } from "../../src/jobs/index.ts";
import { resultFromLog, formatDuration } from "../../src/update-all-log.ts";
import { resultLines, summarize } from "../../src/update-all-summary.ts";
import { runCli } from "./helpers.ts";
import { CLEAN, MEANINGFUL_RESULT } from "./output.ts";
import {
	cleanResults,
	mixedResults,
	runPipedFake,
	runTuiFake,
	streamMeaningful,
	type TimedResult,
} from "./results.ts";

describe("result lines", () => {
	test("clean run prints three result lines in registry order", () => {
		const results = cleanResults();
		const lines = resultLines(results);
		expect(lines).toHaveLength(3);
		const text = summarize(results).text;
		const positions = lines.map((line, index) => {
			for (const part of [
				CLEAN[index].name,
				"ok",
				formatDuration(CLEAN[index].ms),
				CLEAN[index].result,
			]) {
				expect(line).toContain(part);
			}
			expect(text).toContain(line);
			return text.indexOf(line);
		});
		expect(positions).toEqual([...positions].sort((first, second) => first - second));
	});

	test("result is the last meaningful line after redraws, ANSI and a path tail", async () => {
		const path = join(import.meta.dir, "meaningful.log");
		expect(resultFromLog(path)).toBe(MEANINGFUL_RESULT);
		const result = (await streamMeaningful()) as TimedResult;
		expect(result.result).toBe(MEANINGFUL_RESULT);
	});

	test("failure keeps the 30-line tail and log path; clean results survive", () => {
		const results = mixedResults();
		const text = summarize(results).text;
		expect(text).toContain("--- beta (exit 2)");
		expect(text).toContain(formatDuration(900));
		expect(text).toContain("line-11");
		expect(text).toContain("log: ");
		for (const line of [resultLines(results)[0], resultLines(results)[2]]) {
			expect(text).toContain(line);
		}
	});

	test("--json carries ms and result per job", () => {
		for (const job of JOBS) {
			const { code, out } = runCli(["--only", job.id, "--json"]);
			expect(code).toBe(0);
			const payload = JSON.parse(out);
			expect(payload.jobs.length).toBeGreaterThan(0);
			for (const item of payload.jobs) {
				expect(typeof item.ms).toBe("number");
				expect(typeof item.result).toBe("string");
			}
		}
	});

	test("durations are present on both the piped and TUI paths", async () => {
		const piped = (await runPipedFake()) as TimedResult;
		expect(typeof piped.ms).toBe("number");
		const tui = await runTuiFake();
		expect(tui.length).toBeGreaterThan(0);
		for (const item of tui) expect(typeof (item as TimedResult).ms).toBe("number");
	});
});
