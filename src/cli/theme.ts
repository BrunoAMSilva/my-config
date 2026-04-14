const ansi = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	black: "\x1b[30m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	red: "\x1b[31m",
	gray: "\x1b[90m",
	fgSky: "\x1b[38;2;129;212;250m",
	fgMint: "\x1b[38;2;110;231;183m",
	fgGold: "\x1b[38;2;255;210;122m",
	fgRose: "\x1b[38;2;255;145;185m",
	fgLavender: "\x1b[38;2;198;177;255m",
	fgSlate: "\x1b[38;2;160;173;194m",
	bgSelection: "\x1b[48;2;112;231;191m",
	bgPanel: "\x1b[48;2;13;20;33m",
	bgPanelSoft: "\x1b[48;2;18;28;46m",
	bgBadge: "\x1b[48;2;30;44;69m",
} as const;

function paint(color: string, value: string): string {
	return `${color}${value}${ansi.reset}`;
}

function stripAnsi(value: string): string {
	return value.replace(/\x1b\[[0-9;]*m/g, "");
}

function repeat(character: string, count: number): string {
	return character.repeat(Math.max(0, count));
}

function truncate(value: string, maxLength: number): string {
	if (value.length <= maxLength) {
		return value;
	}

	return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function padContent(value: string, width: number): string {
	const visibleLength = stripAnsi(value).length;
	return `${value}${repeat(" ", Math.max(0, width - visibleLength))}`;
}

export const theme = {
	accent: (value: string) => paint(ansi.fgSky, value),
	info: (value: string) => paint(ansi.fgLavender, value),
	success: (value: string) => paint(ansi.fgMint, value),
	warning: (value: string) => paint(ansi.fgGold, value),
	error: (value: string) => paint(ansi.red, value),
	muted: (value: string) => paint(ansi.fgSlate, value),
	strong: (value: string) => paint(`${ansi.bold}${ansi.fgSky}`, value),
	headline: (value: string) => paint(`${ansi.bold}${ansi.fgRose}`, value),
	label: (value: string) => paint(ansi.bold, value),
	command: (value: string) => paint(`${ansi.bold}${ansi.fgMint}`, value),
	panelBorder: (value: string) => paint(ansi.fgSlate, value),
	panelSurface: (value: string) => paint(`${ansi.bgPanel}${ansi.fgSlate}`, value),
	panelTitle: (value: string) => paint(`${ansi.bgPanelSoft}${ansi.bold}${ansi.fgSky}`, value),
	badge: (value: string) => paint(`${ansi.bgBadge}${ansi.bold}${ansi.fgGold}`, ` ${value} `),
	keycap: (value: string) => paint(`${ansi.bgBadge}${ansi.bold}${ansi.fgSky}`, ` ${value} `),
	selectedLine: (value: string) => paint(`${ansi.bgSelection}${ansi.black}${ansi.bold}`, value),
	selectedHint: (value: string) => paint(`${ansi.bgSelection}${ansi.black}`, value),
	selectedMarker: (value: string) => paint(`${ansi.bgSelection}${ansi.black}${ansi.bold}`, value),
} as const;

export function getTerminalWidth(): number {
	const columns = process.stdout.columns ?? 88;
	return Math.max(72, Math.min(columns, 104));
}

export function printHero(): void {
	const width = getTerminalWidth();
	const contentWidth = width - 6;
	const title = truncate("my-config command deck", contentWidth);
	const subtitle = truncate("Backups, restores, skills sync, and local model management", contentWidth);
	const accentBar = paint("\x1b[48;2;129;212;250m", repeat(" ", Math.max(10, Math.floor(width * 0.16))));
	const mintBar = paint("\x1b[48;2;110;231;183m", repeat(" ", Math.max(8, Math.floor(width * 0.1))));
	const roseBar = paint("\x1b[48;2;255;145;185m", repeat(" ", Math.max(6, Math.floor(width * 0.08))));

	console.log(`${accentBar}${mintBar}${roseBar}`);
	console.log(theme.panelBorder(`╭${repeat("─", width - 2)}╮`));
	console.log(`${theme.panelBorder("│")} ${padContent(`${theme.badge("CLI")} ${theme.strong(title)}`, contentWidth)} ${theme.panelBorder("│")}`);
	console.log(`${theme.panelBorder("│")} ${padContent(theme.muted(subtitle), contentWidth)} ${theme.panelBorder("│")}`);
	console.log(theme.panelBorder(`╰${repeat("─", width - 2)}╯`));
	console.log(theme.muted("Use arrow keys to move through menus, or press the number shown for a shortcut."));
	console.log();
}

export function printSection(title: string, description?: string): void {
	console.log(theme.headline(title));
	if (description) {
		console.log(theme.muted(description));
	}
	console.log();
}

export function printPanel(title: string, lines: string[]): void {
	const width = getTerminalWidth();
	const contentWidth = width - 4;
	const safeLines = [theme.label(title), ...lines].map((line) => truncate(line, contentWidth));

	console.log(theme.panelBorder(`╭${repeat("─", width - 2)}╮`));
	for (const [index, line] of safeLines.entries()) {
		const content = index === 0 ? theme.panelTitle(padContent(` ${line} `, contentWidth)) : theme.panelSurface(padContent(` ${line} `, contentWidth));
		console.log(`${theme.panelBorder("│")}${content}${theme.panelBorder("│")}`);
	}
	console.log(theme.panelBorder(`╰${repeat("─", width - 2)}╯`));
	console.log();
}

export function printHelp(commands: string[]): void {
	printSection("Command Mode", "Run any action directly if you do not want the interactive dashboard.");
	for (const command of commands) {
		console.log(`  ${theme.command(command)}`);
	}
	console.log();
}

export function printOutro(): void {
	console.log();
	console.log(theme.success("Session complete."));
}

export function formatMenuItem(optionNumber: number, label: string, hint: string | undefined, selected: boolean, width: number): string {
	const keycap = theme.keycap(String(optionNumber));
	const baseLabel = selected ? label : theme.label(label);
	const baseHint = hint ? selected ? ` ${hint}` : theme.muted(` ${hint}`) : "";
	const marker = selected ? "▶" : theme.muted("·");
	const composed = `${marker} ${keycap} ${baseLabel}${baseHint}`;
	const padded = padContent(composed, width);

	if (!selected) {
		return padded;
	}

	return theme.selectedLine(padded);
}