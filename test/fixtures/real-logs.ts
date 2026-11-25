import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { resultFromLog } from "../../src/update-all-log.ts";
import { tempDir } from "./helpers.ts";

export const SKILLS_RESULT = "✓ Updated 1 skill(s)";
export const BUN_RESULT = "2 packages installed [12.28s]";
export const BREW_RESULT = "Downloaded 16.3MB/ 16.3MB";
export const REDRAWS = 300;

const paint = (color: string, text: string) => `\x1b[${color}m${text}\x1b[0m`;

function write(name: string, text: string): string {
	const path = join(tempDir(), name);
	writeFileSync(path, text);
	return path;
}

/** Long spinner line: hundreds of \r redraws with ANSI colour and erase-line. */
const spinner = (label: string, count: number, width: number) =>
	Array.from(
		{ length: count },
		(_, index) =>
			`\r\x1b[2K${paint("36", `${label} ${index + 1}/${count}`.padEnd(width, "."))}`,
	).join("");

export const skillsLog = write(
	"skills-real.log",
	[
		`\x1b[?25l${spinner("fetching", REDRAWS, 90)}\n`,
		"Found 1 global update(s)\n",
		`${spinner("checking", REDRAWS, 90)}\n`,
		"Updating ui-ux-pro-max…\n",
		`${paint("32", "✓ Updated ui-ux-pro-max")}\n`,
		`${paint("32", SKILLS_RESULT)}\n`,
	].join(""),
);

export const bunLog = write(
	"bun-real.log",
	[`${spinner("Resolving", REDRAWS, 160)}\n`, "installing 2 packages\n", `${BUN_RESULT}\n`].join(
		"",
	),
);

export const brewLog = write(
	"brew-real.log",
	[
		"==> Downloading https://formulae.brew.sh/api/formula.jws.json\n",
		`${spinner("Downloading", REDRAWS, 60)}\n`,
		`${BREW_RESULT}\n`,
	].join(""),
);

export const escapeLog = write(
	"escape-only.log",
	`\x1b[2K\x1b[1A\r\x1b[31m\x1b[0m\n\x1b[?25l\r\x1b[2K\n`,
);

export const longLog = write(
	"long-line.log",
	`${"noise ".repeat(80)}\n${paint("32", `final ${"z".repeat(300)}`)}\n`,
);

const CELLAR_NOISE = [
	"==> Pouring zstd--1.6.0.arm64_golden_gate.bottle.tar.gz",
	"/opt/homebrew/Cellar/zstd/1.6.0: 34 files, 2.4MB",
	"Removing: /opt/homebrew/Cellar/zstd/1.5.7_1 (30 files, 2.2MB)",
	"==> Auto-updating Homebrew...",
].join("\n");

export const HINTS_LINE = "Hide these hints with `HOMEBREW_NO_ENV_HINTS=1` (see `man brew`).";
export const BREW_UPGRADED = "Upgraded 4 outdated packages.";

export const hintsLastLog = write(
	"brew-hints-last.log",
	`==> Auto-updating Homebrew...\n${spinner("Pouring", 40, 60)}\n${HINTS_LINE}\n`,
);

export const hintsMidLog = write(
	"brew-hints-mid.log",
	`${HINTS_LINE}\nWarning: something happened\n${BREW_UPGRADED}\n`,
);

export const upgradedLog = write(
	"brew-upgraded.log",
	`==> Auto-updating Homebrew...\nWarning: something happened\n${BREW_UPGRADED}\n`,
);

export const noOpBrewLog = write(
	"brew-noop-real.log",
	`==> Auto-updating Homebrew...\nWarning: You have 3 outdated formulae installed.\n${HINTS_LINE}\n`,
);

export const POURING_ONE = "upgraded zstd 1.6.0";
export const POURING_MANY = "upgraded 2 packages";

export const pouringOneLog = write("brew-pouring-one.log", CELLAR_NOISE);
export const pouringManyLog = write(
	"brew-pouring-many.log",
	`${CELLAR_NOISE}\n==> Pouring libpng--1.6.45.arm64_golden_gate.bottle.tar.gz\n`,
);
export const cellarNoiseLog = write(
	"brew-cellar-noise.log",
	[
		"/opt/homebrew/Cellar/zstd/1.6.0: 34 files, 2.4MB",
		"Removing: /opt/homebrew/Cellar/zstd/1.5.7_1 (30 files, 2.2MB)",
		"==> Auto-updating Homebrew...",
		HINTS_LINE,
	].join("\n"),
);

export const paths = {
	skillsLog,
	pouringOneLog,
	pouringManyLog,
	cellarNoiseLog,
	bunLog,
	brewLog,
	escapeLog,
	longLog,
	hintsLastLog,
	hintsMidLog,
	upgradedLog,
	noOpBrewLog,
};
export const results = {
	skills: resultFromLog(skillsLog),
	bun: resultFromLog(bunLog),
	brew: resultFromLog(brewLog),
	escape: resultFromLog(escapeLog),
	long: resultFromLog(longLog),
	hintsLast: resultFromLog(hintsLastLog),
	hintsMid: resultFromLog(hintsMidLog),
	upgraded: resultFromLog(upgradedLog),
	noOpBrew: resultFromLog(noOpBrewLog),
	pouringOne: resultFromLog(pouringOneLog),
	pouringMany: resultFromLog(pouringManyLog),
	cellarNoise: resultFromLog(cellarNoiseLog),
};
