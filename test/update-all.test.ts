import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_JOBS, canUsePty, jobArgv, pumpRaw } from "../src/update-all.ts";

const dirs: string[] = [];
function logDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "update-all-test-"));
	dirs.push(dir);
	return dir;
}
afterAll(() => {
	for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

describe("jobs are data", () => {
	test("defaults come from the job registry, in order", () => {
		expect(DEFAULT_JOBS.map((job) => job.id)).toEqual(["skills", "brew", "bun"]);
		expect(DEFAULT_JOBS.map((job) => job.log)).toEqual(["skills.log", "brew.log", "bun.log"]);
		expect(DEFAULT_JOBS[1]?.pty).toBe(true);
	});

	test("pty is a job property, never a name branch", () => {
		const brew = DEFAULT_JOBS[1];
		const skills = DEFAULT_JOBS[0];
		const bun = DEFAULT_JOBS[2];
		expect(jobArgv(brew, "/logs/brew.log")).toEqual([
			"script",
			"-q",
			"/logs/brew.log",
			"brew",
			"upgrade",
			"-y",
		]);
		expect(jobArgv(skills, "/logs/skills.log")).toEqual(skills.argv);
		expect(jobArgv(bun, "/logs/bun.log")).toEqual(bun.argv);
		expect(jobArgv({ ...skills, pty: true }, "x.log")[0]).toBe("script");
	});
});

describe("canUsePty", () => {
	test("only true when stdin and stdout are both TTYs", () => {
		const savedIn = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
		const savedOut = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
		const set = (stream: object, value: boolean) =>
			Object.defineProperty(stream, "isTTY", { value, configurable: true, writable: true });
		try {
			set(process.stdin, false);
			set(process.stdout, false);
			expect(canUsePty()).toBe(false);
			set(process.stdin, true);
			expect(canUsePty()).toBe(false);
			set(process.stdin, false);
			set(process.stdout, true);
			expect(canUsePty()).toBe(false);
			set(process.stdin, true);
			expect(canUsePty()).toBe(true);
		} finally {
			for (const [stream, saved] of [
				[process.stdin, savedIn],
				[process.stdout, savedOut],
			] as const) {
				if (saved) Object.defineProperty(stream, "isTTY", saved);
				else Reflect.deleteProperty(stream, "isTTY");
			}
		}
	});
});

describe("pumpRaw", () => {
	test("passes carriage returns through untouched, with no tag or line buffering", async () => {
		let out = "";
		const bytes = new TextEncoder().encode("step 1\rstep 2\rstep 3\n");
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(bytes);
				controller.close();
			},
		});
		await pumpRaw(stream, (chunk) => {
			out += chunk;
		});
		expect(out).toBe("step 1\rstep 2\rstep 3\n");
	});
});

describe("log dir", () => {
	test("is a temp directory that cleans itself up", () => {
		expect(logDir()).toContain("update-all-test-");
	});
});
