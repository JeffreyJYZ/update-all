/** Piped (non-TTY) execution mode. Jobs come from the registry. */
import { closeSync, mkdirSync, openSync, writeFileSync, writeSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { type Job, PTY_ENV } from "./update-all-job.ts";
import { JOBS } from "./jobs/index.ts";
import { resultFromLog, transcriptIsBlank } from "./update-all-log.ts";

export { ANSI, transcriptIsBlank } from "./update-all-log.ts";
export type { Job } from "./update-all-job.ts";
/** The registry, exposed under the name the piped mode has always used. */
export const DEFAULT_JOBS: Job[] = JOBS;

/** Wrap a job in `script` to give it a pty, or leave its argv alone. */
export function jobArgv(job: Job, log: string, pty = job.pty === true): string[] {
	return pty ? ["script", "-q", log, ...job.argv] : job.argv;
}

/** A pty is only safe when both ends are real terminals. */
export function canUsePty(): boolean {
	return process.stdin.isTTY === true && process.stdout.isTTY === true;
}

export interface JobResult {
	name: string;
	code: number;
	log: string;
	/** Wall-clock duration from spawn to exit, in milliseconds. */
	ms: number;
	/** Last meaningful line of the log, already stripped and truncated. */
	result: string;
	noOp?: boolean;
}

export interface RunOptions {
	jobs?: Job[];
	logDir?: string;
	color?: boolean;
	write?: (chunk: string) => void;
	children?: Set<ReturnType<typeof Bun.spawn>>;
	usePty?: boolean;
}

const RESET = "\x1b[0m";
/** Colours are assigned by registry position, never by job name. */
const TAG_COLORS = ["\x1b[35m", "\x1b[36m", "\x1b[33m", "\x1b[34m", "\x1b[31m"];
const FALLBACK_COLOR = "\x1b[37m";

function tagColor(job: Job): string {
	const index = JOBS.findIndex((candidate) => candidate.id === job.id);
	return TAG_COLORS[Math.max(index, 0) % TAG_COLORS.length] ?? FALLBACK_COLOR;
}
export function defaultLogDir(): string {
	return process.env.UPDATE_ALL_LOG_DIR ?? join(homedir(), ".cache", "update-all");
}

/** Split a byte stream into lines, including a final line with no trailing newline. */
async function* lines(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			let at = buffer.indexOf("\n");
			while (at !== -1) {
				yield buffer.slice(0, at);
				buffer = buffer.slice(at + 1);
				at = buffer.indexOf("\n");
			}
		}
		buffer += decoder.decode();
		if (buffer.length > 0) yield buffer;
	} finally {
		reader.releaseLock();
	}
}

/** Pump one stream: tag each line for the terminal, write the raw line to the log. */
async function pump(
	stream: ReadableStream<Uint8Array>,
	tag: string,
	write: (chunk: string) => void,
	fd: number,
): Promise<void> {
	for await (const line of lines(stream)) {
		write(`${tag} ${line}\n`);
		writeSync(fd, `${line}\n`);
	}
}

/** Forward pty bytes raw: brew redraws with \r, so no line splitting or tags. */
export async function pumpRaw(
	stream: ReadableStream<Uint8Array>,
	write: (chunk: string) => void,
): Promise<void> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			write(decoder.decode(value, { stream: true }));
		}
		write(decoder.decode());
	} finally {
		reader.releaseLock();
	}
}

/** Spawn one job with inherited stdin, stream both outputs, return its result. */
export async function streamJob(job: Job, options: RunOptions = {}): Promise<JobResult> {
	const logDir = options.logDir ?? defaultLogDir();
	mkdirSync(logDir, { recursive: true });
	const log = join(logDir, job.log);
	writeFileSync(log, "");
	const color = options.color ?? false;
	const tag = color ? `${tagColor(job)}${job.label}${RESET}` : job.label;
	const write = options.write ?? ((chunk: string) => process.stdout.write(chunk));
	const pty = job.pty === true && (options.usePty ?? canUsePty());
	const argv = jobArgv(job, log, pty);
	const startedAt = Date.now();
	const child = Bun.spawn(argv, {
		stdin: "inherit",
		stdout: "pipe",
		stderr: "pipe",
		env: { ...process.env, ...PTY_ENV, ...job.env },
	});
	options.children?.add(child);
	try {
		if (pty) {
			await Promise.all([
				pumpRaw(child.stdout, write),
				pumpRaw(child.stderr, write),
				child.exited,
			]);
		} else {
			const fd = openSync(log, "a");
			try {
				await Promise.all([
					pump(child.stdout, tag, write, fd),
					pump(child.stderr, tag, write, fd),
					child.exited,
				]);
			} finally {
				closeSync(fd);
			}
		}
	} finally {
		options.children?.delete(child);
	}
	const result: JobResult = {
		name: job.id,
		code: child.exitCode ?? 1,
		log,
		ms: Date.now() - startedAt,
		result: resultFromLog(log),
	};
	if (pty && result.code === 0 && transcriptIsBlank(log)) result.noOp = true;
	return result;
}

/** Start every job before awaiting any of them. */
export async function run(options: RunOptions = {}): Promise<JobResult[]> {
	const jobs = options.jobs ?? DEFAULT_JOBS;
	return Promise.all(jobs.map((job) => streamJob(job, options)));
}
