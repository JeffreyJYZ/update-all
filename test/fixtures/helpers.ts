import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JOBS } from "../../src/jobs/index.ts";
import type { Job } from "../../src/update-all-job.ts";
import { FAKE_IDS } from "./output.ts";

const dirs: string[] = [];

export function tempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "update-all-tui-"));
	dirs.push(dir);
	return dir;
}

export function cleanup(): void {
	for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
}

export function fakeJob(id: string, overrides: Partial<Job> = {}): Job {
	return { id, label: id, argv: ["sh", "-c", `echo ${id}`], log: `${id}.log`, ...overrides };
}

export function fourFakeJobs(): Job[] {
	return FAKE_IDS.map((id) => fakeJob(id));
}

export function paneTitles(view: { panes: { box: { title?: string } }[] }): string[] {
	return view.panes.map((pane) => pane.box.title ?? "");
}

export function paneLabels(view: { panes: { box: { title?: string } }[] }): string[] {
	return paneTitles(view).map((title) => title.replace("● ", ""));
}

/** Force non-TTY stdio; return a restore function. */
export function setNoTty(): () => void {
	const savedIn = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
	const savedOut = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
	for (const stream of [process.stdin, process.stdout]) {
		Object.defineProperty(stream, "isTTY", {
			value: false,
			configurable: true,
			writable: true,
		});
	}
	return () => {
		for (const [stream, saved] of [
			[process.stdin, savedIn],
			[process.stdout, savedOut],
		] as const) {
			if (saved) Object.defineProperty(stream, "isTTY", saved);
			else Reflect.deleteProperty(stream, "isTTY");
		}
	};
}

/** Run the real CLI with fake executables on PATH: no real upgrade, no network. */
export function runCli(args: string[]): { code: number; ran: string; out: string; err: string } {
	const bin = tempDir();
	const marker = join(bin, "ran.log");
	for (const job of JOBS) {
		const exe = join(bin, job.argv[0] ?? "missing");
		writeFileSync(exe, `#!/bin/sh\necho "${job.argv[0]}" >> "${marker}"\nexit 0\n`);
		chmodSync(exe, 0o755);
	}
	const proc = Bun.spawnSync({
		cmd: [process.execPath, "src/update-all.ts", ...args],
		cwd: join(import.meta.dir, "..", ".."),
		env: {
			...process.env,
			PATH: `${bin}:${process.env.PATH ?? ""}`,
			UPDATE_ALL_LOG_DIR: tempDir(),
		},
		stdout: "pipe",
		stderr: "pipe",
	});
	let ran = "";
	try {
		ran = readFileSync(marker, "utf8").trim();
	} catch {}
	return {
		code: proc.exitCode,
		ran,
		out: proc.stdout.toString(),
		err: proc.stderr.toString(),
	};
}
