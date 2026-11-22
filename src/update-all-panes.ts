import {
	type CliRenderer,
	BoxRenderable,
	EmbeddedTerminalRenderable,
	TextRenderable,
} from "@opentui/core";
import type { Job } from "./update-all-jobs.ts";

/** Focused border colour, plain border colour. */
const FOCUSED = "#22c55e";
const IDLE = "#52525b";

/** One stacked pane: a bordered box holding a VT-aware child terminal. */
export interface Pane {
	name: string;
	/** createView always assigns a title through setFocus, so it is never unset. */
	box: BoxRenderable & { title: string };
	term: EmbeddedTerminalRenderable;
}

/** The whole view: panes plus the single bottom status line. */
export interface TuiView {
	panes: Pane[];
	focused: number;
	setFocus(index: number): void;
	setHeights(heights: number[]): void;
	setStatus(text: string): void;
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
	const status = new TextRenderable(renderer, {
		content: "",
		height: 1,
		flexShrink: 0,
	});
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
			maxScrollback: 0,
		});
		box.add(term);
		root.add(box);
		return { name: job.label, box: box as BoxRenderable & { title: string }, term, index };
	});
	root.add(status);
	renderer.root.add(root);

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
		setHeights(next) {
			panes.forEach((pane, i) => {
				pane.box.height = next[i];
			});
		},
		setStatus(text) {
			status.content = text;
		},
	};
	view.setFocus(0);
	return view;
}
