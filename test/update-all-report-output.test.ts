import { afterAll, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestRenderer } from "@opentui/core/testing";
import { runTui } from "../src/update-all-tui.ts";
import { fakeJob } from "./fixtures/helpers.ts";

const dirs: string[] = [];
function tempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "update-all-report-"));
	dirs.push(dir);
	return dir;
}
afterAll(() => {
	for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

/** Real CLI run with fake executables: PATH shadows every registry command. */
function fakeRun(): { code: number; out: string } {
	const dir = tempDir();
	const bin = join(dir, "bin");
	mkdirSync(bin, { recursive: true });
	const output: Record<string, string> = {
		skills: "Updated 2 skill(s)",
		brew: "Upgraded 4 outdated packages",
		bun: "22 packages installed",
	};
	for (const [name, text] of Object.entries(output)) {
		const exe = join(bin, name);
		writeFileSync(exe, `#!/bin/sh\nprintf '%s\\n' '${text}'\n`);
		chmodSync(exe, 0o755);
	}
	const proc = Bun.spawnSync({
		cmd: [process.execPath, "src/update-all.ts", "--no-tui"],
		cwd: join(import.meta.dir, ".."),
		env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}` },
		stdout: "pipe",
		stderr: "pipe",
	});
	return { code: proc.exitCode, out: proc.stdout.toString() };
}

describe("result report", () => {
	test("fake job run prints a line for every job, in registry order", () => {
		const { code, out } = fakeRun();
		console.log(`fake job output:\n${out}`);
		expect(code).toBe(0);
		expect(out).toContain("=== update-all results ===");
		for (const text of [
			"skills ok",
			"Updated 2 skill(s)",
			"brew   ok",
			"Upgraded 4 outdated packages",
			"bun    ok",
			"22 packages installed",
		]) {
			expect(out).toContain(text);
		}
		expect(out.indexOf("skills ok")).toBeLessThan(out.indexOf("brew   ok"));
		expect(out.indexOf("brew   ok")).toBeLessThan(out.indexOf("bun    ok"));
	});
});

describe("TUI teardown order", () => {
	test("runTui resolves only after the renderer is destroyed and closed", async () => {
		const setup = await createTestRenderer({ width: 60, height: 20 });
		const events: string[] = [];
		setup.renderer.once("destroy", () => events.push("destroy"));
		const jobs = ["alpha", "brew"].map((id) => fakeJob(id));
		const pending = runTui({ renderer: setup.renderer, jobs, logDir: tempDir() });
		await setup.waitForFrame((frame) => frame.includes("q to exit"));
		expect(events).not.toContain("destroy");
		await setup.mockInput.typeText("q");
		const results = await pending;
		expect(results).toHaveLength(2);
		expect(events).toContain("destroy");
		await setup.renderer.closed;
	});
});
