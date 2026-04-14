import { syncBundledSkillsToProjects } from "../../coding";
import { pause, selectMenu } from "../prompt";
import { printPanel, printSection } from "../theme";

type CodingMenuAction = "sync-skills" | "back";

export async function openCodingMenu(): Promise<void> {
	while (true) {
		console.clear();
		printSection("Coding", "Project-scoped developer tooling and skill distribution.");
		printPanel("Bundled skills sync", [
			"Searches under your developer projects directory for .github/skills folders.",
			"Copies the bundled skills in this repo into each project skills directory.",
		]);

		const action = await selectMenu<CodingMenuAction>(
			"Coding actions",
			[
				{ value: "sync-skills", label: "Sync bundled skills to projects", hint: "Copy repo skills into each discovered project skill folder" },
				{ value: "back", label: "Back", hint: "Return to the main dashboard" },
			],
		);

		if (action === "back") {
			return;
		}

		await syncBundledSkillsToProjects();
		await pause();
	}
}

export async function runCodingCommand(args: string[]): Promise<boolean> {
	const [action] = args;

	if (!action) {
		await openCodingMenu();
		return true;
	}

	switch (action) {
		case "sync-skills":
		case "sync":
			await syncBundledSkillsToProjects();
			return true;
		default:
			return false;
	}
}