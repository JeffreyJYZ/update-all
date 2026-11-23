import { describe, expect, test } from "bun:test";
import { available, boundarySession, closeBoundary, sum } from "./boundary.ts";

describe("boundary resizing", () => {
	test("moving the boundary below pane 1 changes only panes 1 and 2", async () => {
		const { setup, session, detach } = await boundarySession();
		try {
			setup.mockInput.pressTab();
			expect(session.state.focused).toBe(1);
			const before = [...session.state.heights];
			await setup.mockInput.typeText("]");
			const after = session.state.heights;
			expect(after[1]).toBe(before[1] + 1);
			expect(after[2]).toBe(before[2] - 1);
			expect(after[0]).toBe(before[0]);
			expect(after[3]).toBe(before[3]);
		} finally {
			await closeBoundary(setup, session, detach);
		}
	});

	test("focusing the last pane moves the boundary above it", async () => {
		const { setup, session, detach } = await boundarySession();
		try {
			for (let i = 0; i < 3; i++) setup.mockInput.pressTab();
			expect(session.state.focused).toBe(3);
			const before = [...session.state.heights];
			await setup.mockInput.typeText("]");
			const after = session.state.heights;
			expect(after[3]).toBe(before[3] + 1);
			expect(after[2]).toBe(before[2] - 1);
			expect(after[0]).toBe(before[0]);
			expect(after[1]).toBe(before[1]);
		} finally {
			await closeBoundary(setup, session, detach);
		}
	});

	test("a move that would take either side under four rows does nothing", async () => {
		const { setup, session, detach } = await boundarySession();
		try {
			const heights = [4, 4, 27, 4];
			session.state.heights = [...heights];
			session.view.setHeights([...heights]);
			await setup.mockInput.typeText("[");
			expect(session.state.heights).toEqual(heights);
			setup.mockInput.pressTab();
			setup.mockInput.pressTab();
			await setup.mockInput.typeText("]");
			expect(session.state.heights).toEqual(heights);
		} finally {
			await closeBoundary(setup, session, detach);
		}
	});

	test("all three boundaries are reachable with four panes", async () => {
		const { setup, session, detach } = await boundarySession();
		try {
			const base = [10, 10, 10, 9];
			session.state.heights = [...base];
			session.view.setHeights([...base]);
			for (let index = 0; index < 3; index++) {
				const before = [...session.state.heights];
				await setup.mockInput.typeText("]");
				const after = session.state.heights;
				expect(after[index]).toBe(before[index] + 1);
				expect(after[index + 1]).toBe(before[index + 1] - 1);
				if (index < 2) setup.mockInput.pressTab();
			}
		} finally {
			await closeBoundary(setup, session, detach);
		}
	});

	test("totals survive moves, the banner and a terminal resize", async () => {
		const { setup, session, detach } = await boundarySession(true);
		try {
			const total = available(setup, true);
			expect(sum(session.state.heights)).toBe(total);
			await setup.mockInput.typeText("]");
			expect(sum(session.state.heights)).toBe(total);
			setup.resize(100, 30);
			await setup.renderOnce();
			expect(sum(session.state.heights)).toBe(available(setup, true));
		} finally {
			await closeBoundary(setup, session, detach);
		}
	});
});
