import { describe, expect, test } from "bun:test";
import { finishedSession } from "./results.ts";
import { closeScroll, frameOf, runningSession } from "./scroll.ts";

describe("all-done banner", () => {
	test("banner is absent while any job is still running", async () => {
		const { setup, session, detach } = await runningSession();
		try {
			const frame = await frameOf(setup);
			expect(frame).not.toContain("ALL DONE");
			expect(frame).not.toContain("press q to exit");
		} finally {
			await closeScroll(setup, session, detach);
		}
	});

	test("banner appears in the captured frame once all jobs resolve", async () => {
		const { setup, session, detach } = await finishedSession();
		try {
			expect(await frameOf(setup)).toContain("ALL DONE");
		} finally {
			await closeScroll(setup, session, detach);
		}
	});

	test("success text carries the job count and the duration", async () => {
		const { setup, session, detach } = await finishedSession();
		try {
			const frame = await frameOf(setup);
			expect(frame).toContain("2 jobs ok");
			expect(frame).toMatch(/\d+(ms|s|m\d+s)/);
			expect(frame).toContain("press q to exit");
		} finally {
			await closeScroll(setup, session, detach);
		}
	});

	test("failure text names the failing job and its exit code", async () => {
		const { setup, session, detach } = await finishedSession([0, 2, 0]);
		try {
			const frame = await frameOf(setup);
			expect(frame).toContain("job1");
			expect(frame).toContain("exit 2");
			expect(frame).toContain("press q to exit");
		} finally {
			await closeScroll(setup, session, detach);
		}
	});

	test("frame still shows every pane after the banner appears", async () => {
		const { setup, session, jobs, detach } = await finishedSession();
		try {
			const frame = await frameOf(setup);
			for (const job of jobs) expect(frame).toContain(job.label);
			expect(frame).toContain("ALL DONE");
		} finally {
			await closeScroll(setup, session, detach);
		}
	});

	test("banner survives a resize and stays until q is pressed", async () => {
		const { setup, session, detach } = await finishedSession();
		try {
			setup.resize(100, 30);
			let frame = await frameOf(setup);
			expect(frame).toContain("ALL DONE");
			frame = await frameOf(setup);
			expect(frame).toContain("press q to exit");
			await setup.mockInput.typeText("q");
			expect((await session.waitForQuit()).length).toBe(2);
		} finally {
			await closeScroll(setup, session, detach);
		}
	});
});
