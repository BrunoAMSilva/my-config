import { envVars } from "../constants";
import { getDefaultModelsDir, getModelsDir } from "../llms";
import { CliCancelledError, pause, selectMenu, withSpinner } from "./prompt";
import { openBackupMenu, runBackupCommand } from "./features/backup";
import { openCodingMenu, runCodingCommand } from "./features/coding";
import { openModelsMenu, runModelsCommand } from "./features/models";
import { openRestoreMenu, runRestoreCommand } from "./features/restore";
import { printHelp, printHero, printOutro, printPanel, printSection, theme } from "./theme";

type MainMenuAction = "models" | "backup" | "restore" | "coding" | "help" | "exit";

function resolveModelsDirLabel(): string {
	try {
		return getModelsDir();
	} catch {
		try {
			return getDefaultModelsDir(process.env[envVars.homeDir]);
		} catch {
			return "not set";
		}
	}
}

function getEnvSummaryLines(): string[] {
	const homeDir = process.env[envVars.homeDir] ?? "not set";
	const backupDir = process.env[envVars.backupDir] ?? "not set";
	const developerProjectsDir = process.env[envVars.developerProjectsDir] ?? "not set";
	const modelsDir = resolveModelsDirLabel();

	return [
		`HOME: ${homeDir}`,
		`BACKUP_DIR: ${backupDir}`,
		`DEVELOPER_PROJECTS_DIR: ${developerProjectsDir}`,
		`MODELS_DIR: ${modelsDir}`,
	];
}

function printDashboard(): void {
	console.clear();
	printHero();
	printPanel("Environment", getEnvSummaryLines());
	printSection("Main menu", "Choose a feature area, then move through actions with arrow keys or tap the matching number.");
}

async function openMainMenu(): Promise<MainMenuAction> {
	return selectMenu<MainMenuAction>(
		"Feature areas",
		[
			{ value: "models", label: "Models", hint: "Registry setup, Hugging Face entries, and pulls" },
			{ value: "backup", label: "Backup", hint: "Archive config and llms state" },
			{ value: "restore", label: "Restore", hint: "Recover config, skills, or llms state from backup" },
			{ value: "coding", label: "Coding", hint: "Sync bundled skills into project directories" },
			{ value: "help", label: "Command mode help", hint: "Show direct command equivalents for scripting" },
			{ value: "exit", label: "Exit", hint: "Leave the dashboard" },
		],
	);
}

function printCommandModeHelp(): void {
	printHelp([
		"bun run index.ts models",
		"bun run index.ts models add-hf <id> <repo> <file[,file2]> [revision] [target-dir] [description] [token-env-var]",
		"bun run index.ts backup config",
		"bun run index.ts backup models",
		"bun run index.ts restore config",
		"bun run index.ts restore skills",
		"bun run index.ts restore models",
		"bun run index.ts coding sync-skills",
	]);
	console.log(theme.muted(`Default models directory: ${resolveModelsDirLabel()}`));
	console.log();
}

export async function startInteractiveCli(): Promise<void> {
	await withSpinner("Loading dashboard", async () => undefined);

	while (true) {
		printDashboard();
		const action = await openMainMenu();

		switch (action) {
			case "models":
				await openModelsMenu();
				break;
			case "backup":
				await openBackupMenu();
				break;
			case "restore":
				await openRestoreMenu();
				break;
			case "coding":
				await openCodingMenu();
				break;
			case "help":
				console.clear();
				printHero();
				printCommandModeHelp();
				await pause();
				break;
			case "exit":
				printOutro();
				return;
		}
	}
}

export async function runCli(args: string[]): Promise<void> {
	if (args.length === 0) {
		await startInteractiveCli();
		return;
	}

	const [scope, ...rest] = args;
	let handled = false;

	switch (scope) {
		case "models":
			handled = await runModelsCommand(rest);
			break;
		case "backup":
			handled = await runBackupCommand(rest);
			break;
		case "restore":
			handled = await runRestoreCommand(rest);
			break;
		case "coding":
			handled = await runCodingCommand(rest);
			break;
		case "help":
			printCommandModeHelp();
			handled = true;
			break;
	}

	if (!handled) {
		console.log(theme.warning("Unknown command."));
		printCommandModeHelp();
	}
}

export function isCliCancellation(error: unknown): boolean {
	return error instanceof CliCancelledError;
}