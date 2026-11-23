import { KeyCodes, createTestRenderer } from "@opentui/core/testing";
import { mountSession, type TuiSession } from "../../src/update-all-session.ts";
import { attachKeys } from "../../src/update-all-tui.ts";
import { fakeJob, tempDir } from "./helpers.ts";

type Setup = Awaited<ReturnType<typeof createTestRenderer>>;

/** Each job writes enough lines to give every pane real scrollback. */
export const SCROLL_LINES = 40;

export async function scrollSession() {
	const setup = await createTestRenderer({ width: 80, height: 24 });
	const jobs = ["alpha", "bravo"].map((id) =>
		fakeJob(id, {
			argv: [
				"sh",
				"-c",
				`i=0; while [ $i -lt ${SCROLL_LINES} ]; do echo ${id}-line-$i; i=$((i+1)); done`,
			],
		}),
	);
	const session = mountSession(setup.renderer, jobs, tempDir());
	const detach = attachKeys(setup.renderer, session.view, session.state, () => session.quit());
	await session.results;
	await setup.renderOnce();
	return { setup, session, jobs, detach };
}

export async function runningSession() {
	const setup = await createTestRenderer({ width: 80, height: 24 });
	const jobs = [fakeJob("slow", { argv: ["sh", "-c", "sleep 5"] })];
	const session = mountSession(setup.renderer, jobs, tempDir());
	const detach = attachKeys(setup.renderer, session.view, session.state, () => session.quit());
	await setup.renderOnce();
	return { setup, session, jobs, detach };
}

export async function closeScroll(setup: Setup, session: TuiSession, detach: () => void) {
	detach();
	session.quit();
	session.dispose();
	await Bun.sleep(50);
	setup.renderer.destroy();
}

export function offsetOf(pane: {
	term: { getScroll(): { offset: number; total: number; visible: number } };
}) {
	return pane.term.getScroll();
}

export function shiftArrow(setup: Setup, direction: "up" | "down") {
	setup.mockInput.pressArrow(direction, { shift: true });
}

export function shiftPage(setup: Setup, up: boolean) {
	setup.mockInput.pressKey(up ? "\x1B[5~" : "\x1B[6~", { shift: true });
}

export function shiftEnd(setup: Setup, end: boolean) {
	setup.mockInput.pressKey(end ? KeyCodes.END : KeyCodes.HOME, { shift: true });
}

export const frameOf = async (setup: Setup) => {
	await setup.renderOnce();
	return setup.captureCharFrame();
};
