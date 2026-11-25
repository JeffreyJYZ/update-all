import { afterAll, describe, expect, test } from "bun:test";
import "./fixtures/scroll-tests.ts";
import "./fixtures/banner-tests.ts";
import "./fixtures/boundary-tests.ts";
import "./fixtures/log-result-tests.ts";
import "./fixtures/env-hint-tests.ts";
import "./fixtures/pouring-tests.ts";
import { EmbeddedTerminalRenderable } from "@opentui/core";
import { createTestRenderer } from "@opentui/core/testing";
import { JOBS } from "../src/jobs/index.ts";
import { canUsePty, jobArgv, run } from "../src/update-all-jobs.ts";
import { createView } from "../src/update-all-panes.ts";
import { summarize } from "../src/update-all-summary.ts";
import { attachKeys } from "../src/update-all-tui.ts";
import { MIN_PANE_HEIGHT, splitHeights, worstExitCode } from "../src/update-all-tui-state.ts";
import {
	cleanup,
	fakeJob,
	fourFakeJobs,
	paneLabels,
	paneTitles,
	runCli,
	setNoTty,
	tempDir,
} from "./fixtures/helpers.ts";
import {
	BREW_FINAL,
	BREW_PROGRESS,
	BREW_STALE,
	FAILING_JOB,
	FAILING_LINE,
	SKILLS_FINAL,
	SKILLS_SPINNER,
	SKILLS_STALE,
} from "./fixtures/output.ts";

afterAll(cleanup);

describe("frame render", () => {
	test("captured frame keeps only the final \\r progress state", async () => {
		const setup = await createTestRenderer({ width: 60, height: 8 });
		try {
			const term = new EmbeddedTerminalRenderable(setup.renderer, {
				width: 60,
				height: 6,
				cols: 60,
				rows: 6,
				maxScrollback: 0,
			});
			setup.renderer.root.add(term);
			term.write(BREW_PROGRESS);
			await setup.renderOnce();
			const frame = setup.captureCharFrame();
			console.log(`captured frame:\n${frame}`);
			expect(frame).toContain(BREW_FINAL);
			expect(frame).toContain("Installed foo");
			for (const stale of BREW_STALE) expect(frame).not.toContain(stale);
			expect(term.screen().text).toContain(BREW_FINAL);
		} finally {
			setup.renderer.destroy();
		}
	});

	test("four registry jobs render four panes with independent screens", async () => {
		const setup = await createTestRenderer({ width: 80, height: 40 });
		try {
			const jobs = fourFakeJobs();
			const heights = splitHeights(setup.renderer.height - 1, jobs.length);
			const view = createView(setup.renderer, jobs, heights, setup.renderer.width);
			expect(view.panes).toHaveLength(4);
			expect(paneLabels(view)).toEqual(jobs.map((job) => job.label));
			view.panes[0].term.write(BREW_PROGRESS);
			view.panes[1].term.write(SKILLS_SPINNER);
			view.panes[2].term.write(FAILING_JOB);
			await setup.renderOnce();
			const frame = setup.captureCharFrame();
			expect(frame).toContain(BREW_FINAL);
			expect(frame).toContain(SKILLS_FINAL);
			expect(frame).toContain(FAILING_LINE);
			for (const stale of [...BREW_STALE, ...SKILLS_STALE])
				expect(frame).not.toContain(stale);
		} finally {
			setup.renderer.destroy();
		}
	});
});

describe("focus and geometry", () => {
	test("Tab cycles focus through all four panes and wraps", async () => {
		const setup = await createTestRenderer({ width: 80, height: 40 });
		try {
			const jobs = fourFakeJobs();
			const heights = splitHeights(39, jobs.length);
			const view = createView(setup.renderer, jobs, heights, 80);
			const state = { heights, focused: 0 };
			attachKeys(setup.renderer, view, state, () => {});
			for (const next of [1, 2, 3, 0]) {
				setup.mockInput.pressTab();
				expect(state.focused).toBe(next);
				expect(view.focused).toBe(next);
				expect(paneTitles(view)[next]).toContain("●");
			}
		} finally {
			setup.renderer.destroy();
		}
	});

	test("reordering the registry reorders panes and the focus cycle", async () => {
		const setup = await createTestRenderer({ width: 80, height: 40 });
		try {
			const jobs = [...fourFakeJobs()].reverse();
			const heights = splitHeights(39, jobs.length);
			const view = createView(setup.renderer, jobs, heights, 80);
			const state = { heights, focused: 0 };
			attachKeys(setup.renderer, view, state, () => {});
			expect(paneLabels(view)).toEqual(jobs.map((job) => job.label));
			setup.mockInput.pressTab();
			expect(paneTitles(view)[state.focused]).toContain(jobs[1].label);
		} finally {
			setup.renderer.destroy();
		}
	});

	test("] moves the boundary below the focused pane and clamps at four rows", async () => {
		const setup = await createTestRenderer({ width: 80, height: 40 });
		try {
			const jobs = fourFakeJobs();
			const heights = splitHeights(39, jobs.length);
			const view = createView(setup.renderer, jobs, heights, 80);
			const state = { heights, focused: 0 };
			attachKeys(setup.renderer, view, state, () => {});
			const before = [...state.heights];
			await setup.mockInput.typeText("]");
			expect(state.heights[0]).toBe(before[0] + 1);
			expect(state.heights[1]).toBe(before[1] - 1);
			for (let i = 0; i < 20; i++) await setup.mockInput.typeText("[");
			expect(state.heights[0]).toBe(MIN_PANE_HEIGHT);
			expect(state.heights.reduce((sum, n) => sum + n, 0)).toBe(39);
		} finally {
			setup.renderer.destroy();
		}
	});
});

describe("registry and flags", () => {
	test("--only accepts every registry id and rejects an unknown one", () => {
		for (const job of JOBS) {
			const result = runCli(["--only", job.id, "--json"]);
			expect(result.code).toBe(0);
			expect(result.ran).toBe(job.argv[0]);
		}
		const bad = runCli(["--only", "no-such-job", "--json"]);
		expect(bad.code).toBe(2);
		expect(bad.err).toContain("unknown job");
	});

	test("no id is special-cased: the pty flag alone selects the pty path", () => {
		const withPty = fakeJob("brew", { pty: true });
		const without = fakeJob("brew", { pty: false });
		expect(jobArgv(withPty, "brew.log", true)).toEqual([
			"script",
			"-q",
			"brew.log",
			...withPty.argv,
		]);
		expect(jobArgv(without, "brew.log", false)).toEqual(without.argv);
		expect(jobArgv(fakeJob("made-up", { pty: true }), "x.log", true)[0]).toBe("script");
	});

	test("non-TTY stdio falls back to the piped path", () => {
		const restore = setNoTty();
		try {
			expect(canUsePty()).toBe(false);
			expect(jobArgv(fakeJob("brew", { pty: true }), "x.log", false)).toEqual(
				fakeJob("brew").argv,
			);
		} finally {
			restore();
		}
	});
});

describe("verdict", () => {
	test("worst exit code comes from jobs, not pane count", async () => {
		const results = await run({
			jobs: [
				fakeJob("one", { argv: ["sh", "-c", "echo ok"] }),
				fakeJob("two", { argv: ["sh", "-c", "exit 2"] }),
			],
			logDir: tempDir(),
			color: false,
			write: () => {},
		});
		const codes = results.map((result) => result.code);
		expect(codes).toEqual([0, 2]);
		expect(worstExitCode(codes)).toBe(2);
		const summary = summarize(results);
		expect(summary.ok).toBe(false);
		expect(summary.worst).toBe(2);
		expect(summary.text).toContain("worst exit code: 2");
	});
});
