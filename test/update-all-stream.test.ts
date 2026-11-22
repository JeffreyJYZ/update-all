import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { streamJob, summarize } from "../src/update-all.ts";

const dirs: string[] = [];
function logDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "update-all-test-"));
	dirs.push(dir);
	return dir;
}
afterAll(() => {
	for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

function sink(): { write: (chunk: string) => void; text: () => string } {
	let out = "";
	return {
		write: (chunk) => {
			out += chunk;
		},
		text: () => out,
	};
}

describe("streamJob", () => {
	test("non-TTY stdio skips the pty wrapper and still runs the job", async () => {
		const dir = logDir();
		const out = sink();
		const result = await streamJob(
			{
				id: "brew",
				label: "brew",
				log: "brew.log",
				argv: ["sh", "-c", "echo did-run; test -t 1 && echo TTY || echo PIPE"],
				pty: true,
			},
			{ logDir: dir, color: false, write: out.write, usePty: false },
		);
		expect(result.code).toBe(0);
		expect(result.noOp).toBeUndefined();
		expect(out.text()).toContain("brew did-run");
		expect(out.text()).toContain("brew PIPE");
		expect(out.text()).not.toContain("TTY");
		const log = readFileSync(result.log, "utf8");
		expect(log).toContain("did-run");
		expect(log).not.toContain("brew ");
	});

	test("tags both streams live and logs raw output to a per-job file", async () => {
		const dir = logDir();
		const out = sink();
		const result = await streamJob(
			{
				id: "fake",
				label: "fake",
				log: "fake.log",
				argv: ["sh", "-c", "printf 'one\\ntwo\\n'; printf 'err\\n' >&2; exit 3"],
			},
			{ logDir: dir, color: false, write: out.write },
		);
		expect(result.code).toBe(3);
		expect(result.log).toBe(join(dir, "fake.log"));
		expect(out.text()).toContain("fake one");
		expect(out.text()).toContain("fake two");
		expect(out.text()).toContain("fake err");
		const log = readFileSync(result.log, "utf8");
		expect(log).toContain("one");
		expect(log).toContain("err");
		expect(log).not.toContain("fake one");
	});

	test("truncates an existing log before writing", async () => {
		const dir = logDir();
		const log = join(dir, "trunc.log");
		writeFileSync(log, "OLD CONTENT\n");
		const result = await streamJob(
			{
				id: "trunc",
				label: "trunc",
				log: "trunc.log",
				argv: ["sh", "-c", "echo fresh"],
			},
			{ logDir: dir, color: false, write: () => {} },
		);
		expect(result.code).toBe(0);
		const out = readFileSync(log, "utf8");
		expect(out).toContain("fresh");
		expect(out).not.toContain("OLD CONTENT");
	});

	test("registers and removes the child so a signal can stop it", async () => {
		const dir = logDir();
		const children = new Set<ReturnType<typeof Bun.spawn>>();
		const pending = streamJob(
			{
				id: "slow",
				label: "slow",
				log: "slow.log",
				argv: ["bun", "-e", "setTimeout(() => {}, 30000)"],
			},
			{ logDir: dir, color: false, write: () => {}, children },
		);
		expect(children.size).toBe(1);
		for (const child of children) child.kill();
		const result = await pending;
		expect(result.code).not.toBe(0);
		expect(children.size).toBe(0);
	});

	test("pty job runs under a terminal and forwards bytes raw", async () => {
		const dir = logDir();
		const out = sink();
		const result = await streamJob(
			{
				id: "ttycheck",
				label: "ttycheck",
				log: "ttycheck.log",
				argv: ["sh", "-c", "test -t 1 && echo TTY || echo PIPE"],
				pty: true,
			},
			{ logDir: dir, color: false, write: out.write, usePty: true },
		);
		expect(result.code).toBe(0);
		expect(result.noOp).toBeUndefined();
		expect(out.text()).toContain("TTY");
		expect(out.text()).not.toContain("PIPE");
		expect(out.text()).not.toContain("ttycheck ");
	});

	test("empty pty transcript turns exit 0 into a warning and non-zero verdict", async () => {
		const dir = logDir();
		const result = await streamJob(
			{
				id: "brew",
				label: "brew",
				log: "brew.log",
				argv: ["sh", "-c", "exit 0"],
				pty: true,
			},
			{ logDir: dir, color: false, write: () => {}, usePty: true },
		);
		expect(result.code).toBe(0);
		expect(result.noOp).toBe(true);
		const summary = summarize([result]);
		expect(summary.ok).toBe(false);
		expect(summary.worst).toBeGreaterThan(0);
		expect(summary.warnings).toEqual(["brew exited 0 without doing anything"]);
		expect(summary.text).toContain("brew exited 0 without doing anything");
	});
});
