import type { Job } from "../update-all-job.ts";

const brew: Job = {
	id: "brew",
	label: "brew",
	argv: ["brew", "upgrade", "-y"],
	pty: true,
	log: "brew.log",
};

export default brew;
