import { describe, expect, test } from "bun:test";
import {
	closeScroll,
	frameOf,
	offsetOf,
	scrollSession,
	shiftArrow,
	shiftEnd,
	shiftPage,
} from "./scroll.ts";

describe("keyboard scrolling", () => {
	test("Shift+Up and Shift+Down move the focused pane one row", async () => {
		const { setup, session, detach } = await scrollSession();
		try {
			const pane = session.view.panes[0];
			expect(offsetOf(pane).total).toBeGreaterThan(offsetOf(pane).visible);
			shiftArrow(setup, "up");
			await frameOf(setup);
			expect(offsetOf(pane).offset).toBe(1);
			shiftArrow(setup, "down");
			await frameOf(setup);
			expect(offsetOf(pane).offset).toBe(0);
		} finally {
			await closeScroll(setup, session, detach);
		}
	});

	test("Shift+PgUp and Shift+PgDn move the focused pane one page", async () => {
		const { setup, session, detach } = await scrollSession();
		try {
			const pane = session.view.panes[0];
			expect(offsetOf(pane).total).toBeGreaterThan(offsetOf(pane).visible);
			const { visible } = offsetOf(pane);
			shiftPage(setup, true);
			await frameOf(setup);
			expect(offsetOf(pane).offset).toBe(visible);
			shiftPage(setup, false);
			await frameOf(setup);
			expect(offsetOf(pane).offset).toBe(0);
		} finally {
			await closeScroll(setup, session, detach);
		}
	});

	test("offset clamps at zero and at total minus visible", async () => {
		const { setup, session, detach } = await scrollSession();
		try {
			const pane = session.view.panes[0];
			expect(offsetOf(pane).total).toBeGreaterThan(offsetOf(pane).visible);
			for (let i = 0; i < 200; i++) shiftArrow(setup, "down");
			await frameOf(setup);
			expect(offsetOf(pane).offset).toBe(0);
			for (let i = 0; i < 200; i++) shiftArrow(setup, "up");
			await frameOf(setup);
			const { total, visible } = offsetOf(pane);
			expect(offsetOf(pane).offset).toBe(total - visible);
		} finally {
			await closeScroll(setup, session, detach);
		}
	});

	test("Shift+Home and Shift+End land exactly on the ends", async () => {
		const { setup, session, detach } = await scrollSession();
		try {
			const pane = session.view.panes[0];
			expect(offsetOf(pane).total).toBeGreaterThan(offsetOf(pane).visible);
			shiftEnd(setup, true);
			await frameOf(setup);
			expect(offsetOf(pane).offset).toBe(offsetOf(pane).total - offsetOf(pane).visible);
			shiftEnd(setup, false);
			await frameOf(setup);
			expect(offsetOf(pane).offset).toBe(0);
		} finally {
			await closeScroll(setup, session, detach);
		}
	});

	test("status shows scroll N/total while scrolled and clears at the live screen", async () => {
		const { setup, session, detach } = await scrollSession();
		try {
			expect(offsetOf(session.view.panes[0]).total).toBeGreaterThan(
				offsetOf(session.view.panes[0]).visible,
			);
			shiftArrow(setup, "up");
			let frame = await frameOf(setup);
			expect(frame).toContain("alpha");
			expect(frame).toMatch(/scroll\s+\d+\/\d+/);
			shiftEnd(setup, false);
			frame = await frameOf(setup);
			expect(frame).not.toMatch(/scroll\s+\d+\/\d+/);
		} finally {
			await closeScroll(setup, session, detach);
		}
	});

	test("a plain letter is delivered to the child, not swallowed as a scroll", async () => {
		const { setup, session, detach } = await scrollSession();
		try {
			const pane = session.view.panes[0];
			expect(offsetOf(pane).total).toBeGreaterThan(offsetOf(pane).visible);
			const received: string[] = [];
			pane.term.onData = (data) => received.push(new TextDecoder().decode(data));
			await setup.mockInput.typeText("x");
			await frameOf(setup);
			expect(received.join("")).toContain("x");
			expect(offsetOf(pane).offset).toBe(0);
		} finally {
			await closeScroll(setup, session, detach);
		}
	});

	test("an unfocused pane does not scroll when another pane has focus", async () => {
		const { setup, session, detach } = await scrollSession();
		try {
			expect(offsetOf(session.view.panes[1]).total).toBeGreaterThan(
				offsetOf(session.view.panes[1]).visible,
			);
			setup.mockInput.pressTab();
			expect(session.state.focused).toBe(1);
			shiftArrow(setup, "up");
			await frameOf(setup);
			expect(offsetOf(session.view.panes[0]).offset).toBe(0);
			expect(offsetOf(session.view.panes[1]).offset).toBe(1);
		} finally {
			await closeScroll(setup, session, detach);
		}
	});
});
