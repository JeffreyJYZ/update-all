import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Job, type JobResult, run, summarize } from "../src/update-all.ts";

const dirs: string[] = [];
function logDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "update-all-test-"));
	dirs.push(dir);
	return dir;
}
afterAll(() => {
	for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

describe("summarize", () => {
	test("clean run prints one line per job with its exit code", () => {
		const dir = logDir();
		const results: JobResult[] = ["alpha", "bravo"].map((name) => ({
			name,
			code: 0,
			ms: 400,
			result: `${name} done`,
			log: join(dir, `${name}.log`),
		}));
		const summary = summarize(results);
		expect(summary.ok).toBe(true);
		expect(summary.worst).toBe(0);
		expect(summary.text).toContain("alpha ok 0.4s alpha done");
		expect(summary.text).toContain("bravo ok 0.4s bravo done");
		expect(summary.text).toContain("all jobs ok");
	});

	test("failed jobs get a block with the last 30 lines and the worst code", () => {
		const dir = logDir();
		const log = join(dir, "bad.log");
		const lines = Array.from({ length: 40 }, (_, i) => `line-${i + 1}`);
		writeFileSync(log, `${lines.join("\n")}\n`);
		const summary = summarize([
			{ name: "good", code: 0, ms: 100, result: "good done", log: join(dir, "good.log") },
			{ name: "bad", code: 3, ms: 900, result: "bad failed", log },
			{
				name: "worse",
				code: 7,
				ms: 800,
				result: "worse failed",
				log: join(dir, "worse.log"),
			},
		]);
		expect(summary.ok).toBe(false);
		expect(summary.worst).toBe(7);
		expect(summary.text).toContain("--- bad (exit 3) ---");
		expect(summary.text).toContain(`log: ${log}`);
		expect(summary.text).toContain("line-11");
		expect(summary.text).not.toContain("line-10");
		expect(summary.text).toContain("worst exit code: 7");
	});

	test("failure tail keeps only the last \\r state and strips ANSI", () => {
		const dir = logDir();
		const log = join(dir, "progress.log");
		writeFileSync(log, `stale\r\x1b[31mhalf\x1b[0m\rfinal\x1b[2K state\n`);
		const summary = summarize([
			{ name: "progress", code: 1, ms: 100, result: "final state", log },
		]);
		expect(summary.text).toContain("final state");
		expect(summary.text).not.toContain("stale");
		expect(summary.text).not.toContain("half");
		expect(summary.text).not.toContain("\r");
		expect(summary.text).not.toContain("\x1b[");
	});
});

describe("run", () => {
	test("starts every job before any of them finishes", async () => {
		const dir = logDir();
		const one = join(dir, "one.marker");
		const two = join(dir, "two.marker");
		const waitFor = (other: string, mine: string) =>
			`echo x > ${mine}; i=0; while [ ! -f ${other} ] && [ $i -lt 50 ]; do sleep 0.02; i=$((i+1)); done`;
		const jobs: Job[] = [
			{ id: "one", label: "one", log: "one.log", argv: ["sh", "-c", waitFor(two, one)] },
			{ id: "two", label: "two", log: "two.log", argv: ["sh", "-c", waitFor(one, two)] },
		];
		const began = Date.now();
		const results = await run({ jobs, logDir: dir, color: false, write: () => {} });
		expect(Date.now() - began).toBeLessThan(800);
		expect(results.map((result) => result.code)).toEqual([0, 0]);
	});

	test("logs are per job id, not per pane index", () => {
		const dir = logDir();
		const result = summarize([
			{
				name: "custom",
				code: 1,
				ms: 100,
				result: "custom failed",
				log: join(dir, "custom.log"),
			},
		]);
		expect(result.text).toContain(join(dir, "custom.log"));
	});
});
