/** The registry. Adding a job: drop in one file, import it here, add it to JOBS. */
import type { Job } from "../update-all-job.ts";
import brew from "./brew.ts";
import bun from "./bun.ts";
import skills from "./skills.ts";

/** Single source of truth for pane count, order, status, flags and summaries. */
export const JOBS: Job[] = [skills, brew, bun];

export type { Job };
