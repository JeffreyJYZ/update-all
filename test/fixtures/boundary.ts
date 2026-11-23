import { createTestRenderer } from "@opentui/core/testing";
import { BANNER_ROWS } from "../../src/update-all-panes.ts";
import { STATUS_ROWS } from "../../src/update-all-tui-state.ts";
import { mountSession, type TuiSession } from "../../src/update-all-session.ts";
import { attachKeys } from "../../src/update-all-tui.ts";
import { fourFakeJobs, tempDir } from "./helpers.ts";

type Setup = Awaited<ReturnType<typeof createTestRenderer>>;

export async function boundarySession(wait = false) {
	const setup = await createTestRenderer({ width: 80, height: 40 });
	const jobs = fourFakeJobs();
	const session = mountSession(setup.renderer, jobs, tempDir());
	const detach = attachKeys(setup.renderer, session.view, session.state, () => session.quit());
	if (wait) await session.results;
	await setup.renderOnce();
	return { setup, session, jobs, detach };
}

export async function closeBoundary(setup: Setup, session: TuiSession, detach: () => void) {
	detach();
	session.quit();
	session.dispose();
	await Bun.sleep(50);
	setup.renderer.destroy();
}

export const sum = (heights: number[]) => heights.reduce((total, height) => total + height, 0);
export const available = (setup: Setup, banner = false) =>
	setup.renderer.height - STATUS_ROWS - (banner ? BANNER_ROWS : 0);
