/** The single job shape. Each file in `src/jobs/` default-exports one of these. */
export interface Job {
	/** Stable key: `--only` value, map key, and result name. */
	id: string;
	/** Human label shown in pane titles and the status line. */
	label: string;
	argv: string[];
	/** Give the child a pty so progress bars and spinners draw. */
	pty?: boolean;
	/** Extra environment for this child, merged over process.env. */
	env?: Record<string, string>;
	/** Log file name inside the log directory. */
	log: string;
}

/** Default environment every child needs to behave like an interactive shell. */
export const PTY_ENV: Record<string, string> = {
	TERM: "xterm-256color",
	COLORTERM: "truecolor",
};
