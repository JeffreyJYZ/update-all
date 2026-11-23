import {
	type CliRenderer,
	BoxRenderable,
	EmbeddedTerminalRenderable,
	TextRenderable,
} from "@opentui/core";
import type { Job } from "./update-all-job.ts";
import { readScroll, scrollTerminal } from "./update-all-scroll.ts";
import type { ScrollKind, ScrollState } from "./update-all-tui-state.ts";

/** Focused border colour, plain border colour. */
const FOCUSED = "#22c55e";
const IDLE = "#52525b";
/** Native attribute bit for bold text. */
const BOLD = 1;
/** One row for the all-done banner. */
export const BANNER_ROWS = 1;
const SUCCESS_BG = "#166534";
const FAILURE_BG = "#991b1b";

/** One stacked pane: a bordered box holding a VT-aware child terminal. */
export interface Pane {
	name: string;
	/** createView always assigns a title through setFocus, so it is never unset. */
	box: BoxRenderable & { title: string };
	term: EmbeddedTerminalRenderable;
}

/** The whole view: banner, panes, and the single bottom status line. */
export interface TuiView {
	panes: Pane[];
	focused: number;
	onScrollChange?: (label: string, state: ScrollState | null) => void;
	setFocus(index: number): void;
	focusChanged(): void;
	setHeights(heights: number[]): void;
	setStatus(text: string): void;
	showBanner(text: string, ok: boolean): void;
	scroll(kind: ScrollKind): void;
}

/** Build the render tree. `cols` seeds the emulator grid; pane heights set its rows. */
export function createView(
	renderer: CliRenderer,
	jobs: Job[],
	heights: number[],
	cols: number,
): TuiView {
	const root = new BoxRenderable(renderer, {
		width: "100%",
		height: "100%",
		flexDirection: "column",
	});
	const banner = new TextRenderable(renderer, {
		width: "100%",
		height: BANNER_ROWS,
		flexShrink: 0,
		bg: SUCCESS_BG,
		fg: "#ffffff",
		attributes: BOLD,
		wrapMode: "none",
		truncate: true,
		visible: false,
	});
	const status = new TextRenderable(renderer, {
		content: "",
		height: 1,
		flexShrink: 0,
	});
	root.add(banner);
	const panes = jobs.map((job, index) => {
		const box = new BoxRenderable(renderer, {
			width: "100%",
			height: heights[index],
			border: true,
			borderColor: IDLE,
			title: job.label,
			flexShrink: 1,
		});
		const term = new EmbeddedTerminalRenderable(renderer, {
			width: "100%",
			height: "100%",
			cols: Math.max(1, cols - 2),
			rows: Math.max(1, heights[index] - 2),
			/** 1 MiB of history gives the wheel and keys somewhere to scroll. */
			maxScrollback: 1 << 20,
		});
		box.add(term);
		root.add(box);
		return { name: job.label, box: box as BoxRenderable & { title: string }, term, index };
	});
	root.add(status);
	renderer.root.add(root);

	const currentPane = () => panes[view.focused];
	const notifyScroll = () => {
		const pane = currentPane();
		if (!pane) return;
		const state = readScroll(pane.term);
		view.onScrollChange?.(pane.name, state.offset > 0 ? state : null);
	};
	const view: TuiView = {
		panes: panes.map(({ name, box, term }) => ({ name, box, term })),
		focused: 0,
		setFocus(index) {
			view.focused = index;
			panes.forEach((pane, i) => {
				pane.box.borderColor = i === index ? FOCUSED : IDLE;
				pane.box.title = i === index ? `● ${pane.name}` : pane.name;
			});
			panes[index]?.term.focus();
		},
		focusChanged: notifyScroll,
		setHeights(next) {
			panes.forEach((pane, i) => {
				pane.box.height = next[i];
			});
		},
		setStatus(text) {
			status.content = text;
		},
		showBanner(text, ok) {
			banner.bg = ok ? SUCCESS_BG : FAILURE_BG;
			banner.content = text.padEnd(renderer.width, " ");
			banner.visible = true;
		},
		scroll(kind) {
			const pane = currentPane();
			if (!pane) return;
			scrollTerminal(pane.term, kind);
			notifyScroll();
		},
	};
	view.setFocus(0);
	return view;
}
