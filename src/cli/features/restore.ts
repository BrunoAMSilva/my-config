import { restoreAiSkills, restoreConfigFolder, restoreLLMConfigs } from "../../restore";
import { pause, promptConfirm, selectMenu } from "../prompt";
import { printPanel, printSection, theme } from "../theme";

type RestoreMenuAction = "config" | "skills" | "models" | "back";

async function confirmDestructiveAction(message: string): Promise<boolean> {
	const confirmed = await promptConfirm({ label: message, defaultValue: false });
	if (!confirmed) {
		console.log(theme.warning("Restore cancelled."));
	}

	return confirmed;
}

export async function openRestoreMenu(): Promise<void> {
	while (true) {
		console.clear();
		printSection("Restore", "Replay a known-good config, skill bundle, or model registry into your home directory.");
		printPanel("Restore notes", [
			"Config and model restores archive the previous file before copying the latest backup.",
			"AI skills restore copies bundled skills into both .claude/skills and .copilot/skills.",
		]);

		const action = await selectMenu<RestoreMenuAction>(
			"Restore actions",
			[
				{ value: "config", label: "Restore config folder", hint: "Replace ~/.config from the latest backup" },
				{ value: "skills", label: "Restore AI skills", hint: "Copy bundled skills back into the home directory" },
				{ value: "models", label: "Restore model registry", hint: "Replace the Models package manifest from backup" },
				{ value: "back", label: "Back", hint: "Return to the main dashboard" },
			],
		);

		if (action === "back") {
			return;
		}

		if (action === "config") {
			if (await confirmDestructiveAction("Restore ~/.config from the latest backup?")) {
				await restoreConfigFolder();
			}
		} else if (action === "skills") {
			await restoreAiSkills();
		} else if (await confirmDestructiveAction("Restore the shared model registry from backup?")) {
			await restoreLLMConfigs();
		}

		await pause();
	}
}

export async function runRestoreCommand(args: string[]): Promise<boolean> {
	const [action] = args;

	if (!action) {
		await openRestoreMenu();
		return true;
	}

	switch (action) {
		case "config":
			if (await confirmDestructiveAction("Restore ~/.config from the latest backup?")) {
				await restoreConfigFolder();
			}
			return true;
		case "skills":
			await restoreAiSkills();
			return true;
		case "models":
		case "llms":
			if (await confirmDestructiveAction("Restore the shared model registry from backup?")) {
				await restoreLLMConfigs();
			}
			return true;
		default:
			return false;
	}
}