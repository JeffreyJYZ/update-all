#!/usr/bin/env bun
/**
 * Run the global upgrade jobs concurrently. On a TTY, each registry job gets
 * its own PTY pane; otherwise the original tagged piped mode is used.
 */
import { cac } from "cac";
import { JOBS } from "./jobs/index.ts";
import { runTui } from "./update-all-tui.ts";
import { run } from "./update-all-jobs.ts";
import { summarize } from "./update-all-summary.ts";

export {
	DEFAULT_JOBS,
	canUsePty,
	jobArgv,
	pumpRaw,
	run,
	streamJob,
	transcriptIsBlank,
	type Job,
	type JobResult,
	type RunOptions,
} from "./update-all-jobs.ts";
export { summarize, type Summary } from "./update-all-summary.ts";
export { JOBS } from "./jobs/index.ts";

const VERSION = "0.1.0";

if (import.meta.main) {
	const cli = cac("update-all");
	cli.option("--only <job>", "run one registry job (repeatable)");
	cli.option("--no-tui", "use the piped front end even on a TTY");
	cli.option("--json", "print a machine summary");
	cli.version(VERSION);
	cli.help();
	const { options } = cli.parse(Bun.argv);
	if (options.help || options.version) process.exit(0);

	const requested: string[] =
		options.only === undefined
			? []
			: Array.isArray(options.only)
				? options.only
				: [options.only];
	const jobs = requested.length ? JOBS.filter((job) => requested.includes(job.id)) : JOBS;
	if (requested.length > 0 && requested.length !== jobs.length) {
		const unknown = requested.filter((name) => !jobs.some((job) => job.id === name));
		console.error(`update-all: unknown job(s): ${unknown.join(", ")}`);
		process.exit(2);
	}

	const children = new Set<ReturnType<typeof Bun.spawn>>();
	const onSigint = () => {
		for (const child of children) child.kill();
	};
	process.on("SIGINT", onSigint);

	const json = options.json === true;
	const useTui = process.stdout.isTTY === true && options.tui !== false && !json;
	const results = useTui
		? await runTui({ jobs })
		: await run({
				jobs,
				color: process.stdout.isTTY === true && !process.env.NO_COLOR,
				children,
			});
	process.off("SIGINT", onSigint);

	const { text, ok, worst, warnings } = summarize(results);
	if (json) {
		const payload: Record<string, unknown> = { jobs: results, ok };
		if (warnings.length > 0) payload.warnings = warnings;
		process.stdout.write(`${JSON.stringify(payload)}\n`);
	} else {
		process.stdout.write(text);
	}
	process.exit(ok ? 0 : worst);
}
