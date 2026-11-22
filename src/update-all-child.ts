import { closeSync, openSync, writeSync } from "node:fs";
import type { EmbeddedTerminalRenderable } from "@opentui/core";
import { PTY_ENV } from "./update-all-job.ts";

/** A spawned PTY child paired with the pane that displays it. */
export interface PtyChild {
	child: ReturnType<typeof Bun.spawn>;
	kill(): void;
	close(): void;
}

/**
 * Spawn argv under a real PTY. The child sees a terminal, its bytes feed the
 * pane's VT parser and the log file, and pane input/resize reach the child.
 */
export function startPtyChild(
	argv: string[],
	pane: EmbeddedTerminalRenderable,
	log: string,
	cols: number,
	rows: number,
	env: Record<string, string> = {},
): PtyChild {
	let fd = openSync(log, "w");
	const terminal = Bun.spawn(argv, {
		terminal: {
			cols,
			rows,
			name: "xterm-256color",
			data: (_term, data) => {
				pane.write(data);
				if (fd >= 0) writeSync(fd, data);
			},
		},
		env: { ...process.env, ...PTY_ENV, ...env },
	});
	pane.onData = (data) => terminal.terminal?.write(data);
	pane.onTerminalResize = (nextCols, nextRows) => terminal.terminal?.resize(nextCols, nextRows);
	return {
		child: terminal,
		kill() {
			terminal.kill();
		},
		close() {
			if (fd < 0) return;
			closeSync(fd);
			fd = -1;
		},
	};
}
