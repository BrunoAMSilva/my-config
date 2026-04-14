import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { formatMenuItem, getTerminalWidth, theme } from "./theme";

export class CliCancelledError extends Error {
	constructor(message = "Cancelled by user") {
		super(message);
		this.name = "CliCancelledError";
	}
}

export type MenuOption<T extends string> = {
	value: T;
	label: string;
	hint?: string;
};

type PromptTextOptions = {
	label: string;
	defaultValue?: string;
	placeholder?: string;
	validate?: (value: string) => string | null;
	optional?: boolean;
};

type PromptConfirmOptions = {
	label: string;
	defaultValue?: boolean;
};

function formatPromptLabel(label: string, suffix = "> "): string {
	return `${theme.accent("?")} ${label} ${theme.muted(suffix)}`;
}

async function askQuestion(prompt: string): Promise<string> {
	const rl = createInterface({ input, output });

	try {
		return await rl.question(prompt);
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			throw new CliCancelledError();
		}

		throw error;
	} finally {
		rl.close();
	}
}

function buildMenuLines<T extends string>(title: string, hint: string | undefined, options: MenuOption<T>[], selectedIndex: number): string[] {
	const lines = [theme.label(title)];
	if (hint) {
		lines.push(theme.muted(hint));
	}

	const menuWidth = getTerminalWidth() - 2;

	for (const [index, option] of options.entries()) {
		lines.push(formatMenuItem(index + 1, option.label, option.hint, index === selectedIndex, menuWidth));
	}

	return lines;
}

async function selectByNumber<T extends string>(title: string, hint: string | undefined, options: MenuOption<T>[]): Promise<T> {
	console.log(theme.label(title));
	if (hint) {
		console.log(theme.muted(hint));
	}

	for (const [index, option] of options.entries()) {
		console.log(`  ${formatMenuItem(index + 1, option.label, option.hint, false, getTerminalWidth() - 4)}`);
	}

	while (true) {
		const answer = (await askQuestion(formatPromptLabel("Choose an option", "1-9 or q > "))).trim().toLowerCase();

		if (answer === "q" || answer === "quit") {
			throw new CliCancelledError();
		}

		const index = Number(answer);
		if (Number.isInteger(index) && index >= 1 && index <= options.length) {
			return options[index - 1].value;
		}

		console.log(theme.warning("Enter one of the numbers shown, or q to cancel."));
	}
}

export async function selectMenu<T extends string>(title: string, options: MenuOption<T>[], hint?: string): Promise<T> {
	if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== "function") {
		return selectByNumber(title, hint, options);
	}

	return new Promise<T>((resolve, reject) => {
		let selectedIndex = 0;
		let renderedLineCount = 0;

		const render = () => {
			const lines = buildMenuLines(title, hint, options, selectedIndex);

			if (renderedLineCount > 0) {
				output.write(`\x1b[${renderedLineCount}F`);
			}

			output.write("\x1b[0J");
			output.write(lines.join("\n"));
			output.write("\n");
			renderedLineCount = lines.length;
		};

		const cleanup = () => {
			input.off("data", onData);
			input.setRawMode?.(false);
			output.write("\x1b[?25h");
			input.pause();
		};

		const finish = (value: T) => {
			cleanup();
			output.write("\n");
			resolve(value);
		};

		const cancel = () => {
			cleanup();
			output.write("\n");
			reject(new CliCancelledError());
		};

		const onData = (buffer: Buffer) => {
			const key = buffer.toString("utf8");

			if (key === "\u0003" || key === "q" || key === "Q" || key === "\u001b") {
				cancel();
				return;
			}

			if (key === "\r") {
				finish(options[selectedIndex].value);
				return;
			}

			if (key === "\u001b[A" || key === "k") {
				selectedIndex = (selectedIndex - 1 + options.length) % options.length;
				render();
				return;
			}

			if (key === "\u001b[B" || key === "j") {
				selectedIndex = (selectedIndex + 1) % options.length;
				render();
				return;
			}

			if (/^[1-9]$/.test(key)) {
				const optionIndex = Number(key) - 1;
				if (optionIndex < options.length) {
					finish(options[optionIndex].value);
				}
			}
		};

		output.write("\x1b[?25l");
		input.setRawMode?.(true);
		input.resume();
		input.on("data", onData);
		render();
	});
}

export async function promptText(options: PromptTextOptions): Promise<string | undefined> {
	const { label, defaultValue, placeholder, validate, optional } = options;

	while (true) {
		const defaultSuffix = defaultValue ? ` [${defaultValue}]` : placeholder ? ` (${placeholder})` : "";
		const answer = await askQuestion(formatPromptLabel(`${label}${defaultSuffix}`));
		const trimmed = answer.trim();
		const value = trimmed.length > 0 ? trimmed : defaultValue ?? "";

		if (optional && value.length === 0) {
			return undefined;
		}

		if (!optional && value.length === 0) {
			console.log(theme.warning("A value is required."));
			continue;
		}

		const validationMessage = validate?.(value) ?? null;
		if (validationMessage) {
			console.log(theme.warning(validationMessage));
			continue;
		}

		return value;
	}
}

export async function promptConfirm(options: PromptConfirmOptions): Promise<boolean> {
	const { label, defaultValue = true } = options;
	const defaultHint = defaultValue ? "Y/n" : "y/N";

	while (true) {
		const answer = (await askQuestion(formatPromptLabel(label, `${defaultHint} > `))).trim().toLowerCase();

		if (answer.length === 0) {
			return defaultValue;
		}

		if (answer === "y" || answer === "yes") {
			return true;
		}

		if (answer === "n" || answer === "no") {
			return false;
		}

		console.log(theme.warning("Type y or n."));
	}
}

export async function pause(message = "Press Enter to continue"): Promise<void> {
	await askQuestion(`${theme.muted(message)} `);
}

export async function withSpinner<T>(label: string, action: () => Promise<T>): Promise<T> {
	if (!output.isTTY) {
		return action();
	}

	const frames = ["-", "\\", "|", "/"];
	let frameIndex = 0;
	output.write(`${theme.accent(frames[0])} ${label}`);

	const timer = setInterval(() => {
		frameIndex = (frameIndex + 1) % frames.length;
		output.write(`\r${theme.accent(frames[frameIndex])} ${label}`);
	}, 80);

	try {
		const result = await action();
		clearInterval(timer);
		output.write(`\r${theme.success("[ok]")} ${label}\n`);
		return result;
	} catch (error) {
		clearInterval(timer);
		output.write(`\r${theme.error("[x]")} ${label}\n`);
		throw error;
	}
}