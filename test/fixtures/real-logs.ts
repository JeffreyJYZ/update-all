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

export const paths = { skillsLog, bunLog, brewLog, escapeLog, longLog };
export const results = {
	skills: resultFromLog(skillsLog),
	bun: resultFromLog(bunLog),
	brew: resultFromLog(brewLog),
	escape: resultFromLog(escapeLog),
	long: resultFromLog(longLog),
};
