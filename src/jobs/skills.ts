import type { Job } from "../update-all-job.ts";

const skills: Job = {
	id: "skills",
	label: "skills",
	argv: ["skills", "update", "-g"],
	log: "skills.log",
};

export default skills;
