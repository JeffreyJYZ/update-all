import { describe, expect, test } from "bun:test";
import { JOBS } from "../../src/jobs/index.ts";
import { runCli } from "./helpers.ts";
import { closeSession, finishedSession, quitSession } from "./results.ts";

describe("finished TUI stays open", () => {
	test("after jobs resolve the view is mounted and the frame still renders every pane", async () => {
		const { setup, session, jobs, detach } = await finishedSession();
		try {
			expect(session.view.panes).toHaveLength(jobs.length);
			const frame = setup.captureCharFrame();
			for (const job of jobs) expect(frame).toContain(job.label);
		} finally {
			await quitSession(setup);
			closeSession(setup, session, detach);
		}
	});

	test("status line switches to the verdict text with the exit hint", async () => {
		const { setup, session, detach } = await finishedSession();
		try {
			const frame = setup.captureCharFrame();
			expect(frame).toContain("all done");
			expect(frame).toContain("q to exit");
		} finally {
			await quitSession(setup);
			closeSession(setup, session, detach);
		}
	});

	test("focus and resize keys still work in the finished state", async () => {
		const { setup, session, detach } = await finishedSession();
		try {
			const before = [...session.state.heights];
			setup.mockInput.pressTab();
			expect(session.state.focused).toBe(1);
			await setup.mockInput.typeText("]");
			expect(session.state.heights[1]).toBe(before[1] + 1);
		} finally {
			await quitSession(setup);
			closeSession(setup, session, detach);
		}
	});

	test("run resolves only after q, not when the jobs complete", async () => {
		const { setup, session, jobs, detach } = await finishedSession();
		let settled = false;
		let quit = false;
		session.waitForQuit().then(
			() => {
				settled = true;
			},
			() => {
				settled = true;
			},
		);
		try {
			await Bun.sleep(200);
			expect(settled).toBe(false);
			await quitSession(setup);
			const results = await session.waitForQuit();
			expect(results).toHaveLength(jobs.length);
			expect(settled).toBe(true);
			quit = true;
		} finally {
			if (!quit) await quitSession(setup);
			closeSession(setup, session, detach);
		}
	});

	test("failed run shows the failing job in the verdict line", async () => {
		const { setup, session, detach } = await finishedSession([0, 2, 0]);
		try {
			const frame = setup.captureCharFrame();
			expect(frame).toContain("job1 exit 2");
			expect(frame).toContain("q to exit");
		} finally {
			await quitSession(setup);
			closeSession(setup, session, detach);
		}
	});

	test("--json and --no-tui exit immediately when jobs finish", () => {
		for (const args of [["--json"], ["--no-tui"]]) {
			const started = Date.now();
			const { code, ran } = runCli(args);
			expect(code).toBe(0);
			expect(Date.now() - started).toBeLessThan(5000);
			expect(ran.split("\n").filter(Boolean)).toHaveLength(JOBS.length);
		}
	});
});
