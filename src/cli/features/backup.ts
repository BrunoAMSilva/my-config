import { backupConfigFolder, backupLLMConfigs } from "../../backup";
import { pause, selectMenu } from "../prompt";
import { printPanel, printSection } from "../theme";

type BackupMenuAction = "config" | "models" | "back";

export async function openBackupMenu(): Promise<void> {
	while (true) {
		console.clear();
		printSection("Backup", "Capture the current config and model registry state before making changes.");
		printPanel("Backup targets", [
			"Config folder: ~/.config",
			"Model registry: ~/Models/package.json by default",
		]);

		const action = await selectMenu<BackupMenuAction>(
			"Backup actions",
			[
				{ value: "config", label: "Backup config folder", hint: "Archive ~/.config into the backup directory" },
				{ value: "models", label: "Backup model registry", hint: "Copy the shared llms config manifest" },
				{ value: "back", label: "Back", hint: "Return to the main dashboard" },
			],
		);

		if (action === "back") {
			return;
		}

		if (action === "config") {
			await backupConfigFolder();
		} else {
			await backupLLMConfigs();
		}

		await pause();
	}
}

export async function runBackupCommand(args: string[]): Promise<boolean> {
	const [action] = args;

	if (!action) {
		await openBackupMenu();
		return true;
	}

	switch (action) {
		case "config":
			await backupConfigFolder();
			return true;
		case "models":
		case "llms":
			await backupLLMConfigs();
			return true;
		default:
			return false;
	}
}