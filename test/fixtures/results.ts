import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTestRenderer } from "@opentui/core/testing";
import type { JobResult } from "../../src/update-all-jobs.ts";
import { streamJob } from "../../src/update-all-jobs.ts";
import { mountSession, type TuiSession } from "../../src/update-all-session.ts";
import { attachKeys, runTui } from "../../src/update-all-tui.ts";
import { fakeJob, tempDir } from "./helpers.ts";
import { CLEAN } from "./output.ts";

export interface TimedResult extends JobResult {
	ms: number;
	result: string;
}

const LOG_ROOT = "/logs";

export function cleanResults(): TimedResult[] {
	return CLEAN.map((job) => ({
		name: job.name,
		code: 0,
		ms: job.ms,
		result: job.result,
		log: `${LOG_ROOT}/${job.name}.log`,
	}));
}

export function mixedResults(): TimedResult[] {
	const log = join(tempDir(), "beta.log");
	const lines = Array.from({ length: 40 }, (_, index) => `line-${index + 1}`);
	writeFileSync(log, `${lines.join("\n")}\n`);
	const [first, , last] = cleanResults();
	return [first, { name: "beta", code: 2, ms: 900, result: "beta failed", log }, last];
}

export function streamMeaningful() {
	const log = join(import.meta.dir, "meaningful.log");
	return streamJob(fakeJob("meaningful", { argv: ["cat", log] }), {
		logDir: tempDir(),
		color: false,
		write: () => {},
		usePty: false,
	});
}

export function runPipedFake() {
	return streamJob(fakeJob("piped", { argv: ["sh", "-c", "echo done"] }), {
		logDir: tempDir(),
		color: false,
		write: () => {},
	});
}

type Setup = Awaited<ReturnType<typeof createTestRenderer>>;

/** Mount fake jobs, let them finish, keep the TUI open with keys attached. */
export async function finishedSession(codes: number[] = [0, 0]) {
	const setup = await createTestRenderer({ width: 80, height: 40 });
	const jobs = codes.map((code, index) =>
		fakeJob(`job${index}`, { argv: ["sh", "-c", `echo job${index}; exit ${code}`] }),
	);
	const session = mountSession(setup.renderer, jobs, tempDir());
	const detach = attachKeys(setup.renderer, session.view, session.state, () => session.quit());
	await session.results;
	await setup.renderOnce();
	return { setup, session, jobs, detach };
}

export async function quitSession(setup: Setup) {
	await setup.mockInput.typeText("q");
}

export function closeSession(setup: Setup, session: TuiSession, detach: () => void) {
	detach();
	session.dispose();
	setup.renderer.destroy();
}

/** Public TUI path: results stay pending until q. */
export async function runTuiFake() {
	const setup = await createTestRenderer({ width: 80, height: 40 });
	try {
		const jobs = ["a", "b"].map((id) => fakeJob(id, { argv: ["sh", "-c", `echo ${id}`] }));
		const pending = runTui({ renderer: setup.renderer, jobs, logDir: tempDir() });
		await Bun.sleep(400);
		await setup.mockInput.typeText("q");
		return await pending;
	} finally {
		setup.renderer.destroy();
	}
}
