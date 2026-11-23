/** Keyboard scrolling through the embedded terminal's own scroll handler. */
import { MouseEvent, type EmbeddedTerminalRenderable } from "@opentui/core";
import { type ScrollKind, type ScrollState, scrollTarget } from "./update-all-tui-state.ts";

/** The native scroll primitive the renderable's wheel handler uses. */
interface NativeScroll {
	lib: { contextEmbeddedTerminalScroll(ctx: unknown, handle: unknown, delta: number): void };
	handle: { context: unknown } | null;
}

export function readScroll(term: EmbeddedTerminalRenderable): ScrollState {
	const scroll = term.getScroll();
	return { offset: scroll.offset, total: scroll.total, visible: scroll.visible };
}

function wheelEvent(term: EmbeddedTerminalRenderable, direction: "up" | "down", delta: number) {
	return new MouseEvent(term, {
		type: "scroll",
		button: 0,
		x: 0,
		y: 0,
		modifiers: { shift: true, alt: false, ctrl: false },
		scroll: { direction, delta },
	});
}

/**
 * Move the viewport to an exact line offset. The public scroll handler takes a
 * wheel event, but its internal step is three rows, so the last few rows use
 * the same native scroll primitive that handler calls.
 */
export function scrollTerminal(term: EmbeddedTerminalRenderable, kind: ScrollKind): ScrollState {
	const before = readScroll(term);
	const target = scrollTarget(kind, before);
	if (target === before.offset) return before;
	const direction = target > before.offset ? "up" : "down";
	const delta = Math.abs(target - before.offset);

	term.onMouseScroll?.(wheelEvent(term, direction, delta));
	let offset = readScroll(term).offset;
	if (offset === before.offset) {
		term.processMouseEvent(wheelEvent(term, direction, delta));
		offset = readScroll(term).offset;
	}
	const native = term as unknown as NativeScroll;
	if (offset !== target && native.handle) {
		native.lib.contextEmbeddedTerminalScroll(
			native.handle.context,
			native.handle,
			offset - target,
		);
		offset = readScroll(term).offset;
	}
	term.invalidate();
	return { ...before, offset };
}
