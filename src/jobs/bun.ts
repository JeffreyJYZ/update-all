import type { Job } from "../update-all-job.ts";

const bun: Job = {
	id: "bun",
	label: "bun",
	argv: ["bun", "update", "-g"],
	log: "bun.log",
};

export default bun;
