import type { Job } from "../update-all-job.ts";

const brew: Job = {
	id: "brew",
	label: "brew",
	argv: ["brew", "upgrade", "-y"],
	pty: true,
	/** Stop brew printing the env-hint banner instead of filtering it later. */
	env: { HOMEBREW_NO_ENV_HINTS: "1" },
	log: "brew.log",
};

export default brew;
