import { addHuggingFaceLLM, getLLMConfigPath, getModelsDir, initLLMConfig, listConfiguredLLMs, parseAddHuggingFaceInput, pullAllLLMs, pullLLM, readLLMConfig } from "../../llms";
import { CliCancelledError, pause, promptConfirm, promptText, selectMenu, withSpinner } from "../prompt";
import { printPanel, printSection, theme } from "../theme";

type ModelsMenuAction = "init" | "list" | "add-hf" | "pull-one" | "pull-all" | "back";

type ParsedHuggingFaceSource = {
	repo: string;
	revision?: string;
	files: string[];
};

function parseCommaSeparatedFiles(value: string): string[] {
	return value
		.split(",")
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}

function parseHuggingFaceSource(value: string): ParsedHuggingFaceSource {
	const trimmed = value.trim();
	if (!trimmed) {
		throw new Error("A Hugging Face repo or URL is required.");
	}

	if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
		return { repo: trimmed, files: [] };
	}

	const url = new URL(trimmed);
	if (!["huggingface.co", "www.huggingface.co"].includes(url.hostname)) {
		throw new Error("Only huggingface.co URLs are supported.");
	}

	const parts = url.pathname.split("/").filter((part) => part.length > 0).map((part) => decodeURIComponent(part));
	if (parts.length < 2) {
		throw new Error("The Hugging Face URL must include an owner and repository name.");
	}

	const [owner, repo, mode, revision, ...rest] = parts;
	return {
		repo: `${owner}/${repo}`,
		revision: mode === "blob" || mode === "resolve" ? revision : undefined,
		files: mode === "blob" || mode === "resolve" ? (rest.length > 0 ? [rest.join("/")] : []) : [],
	};
}

function slugify(value: string): string {
	return value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

function deriveModelId(parsed: ParsedHuggingFaceSource): string {
	const fileName = parsed.files[0]?.split("/").at(-1)?.replace(/\.[^.]+$/g, "");
	if (fileName) {
		return slugify(fileName);
	}

	return slugify(parsed.repo.split("/").at(-1) ?? parsed.repo);
}

function validateModelId(value: string): string | null {
	return /^[a-zA-Z0-9._-]+$/.test(value) ? null : "Use letters, numbers, dots, underscores, or hyphens only.";
}

async function renderModelsOverview(): Promise<void> {
	printSection("Models", "Manage the shared registry under your home Models directory and pull configured artifacts.");
	printPanel("Registry", [
		`Config file: ${getLLMConfigPath()}`,
		`Models directory: ${getModelsDir()}`,
		`Auth token: HF_TOKEN (optional, per-model override supported)`,
	]);
}

async function addModelInteractive(): Promise<void> {
	const source = await promptText({
		label: "Paste a Hugging Face repo or file URL",
		placeholder: "Qwen/Qwen2.5-Coder-7B-Instruct-GGUF or https://huggingface.co/.../blob/main/model.gguf",
		validate: (value) => {
			try {
				parseHuggingFaceSource(value);
				return null;
			} catch (error) {
				return error instanceof Error ? error.message : String(error);
			}
		},
	});

	const parsed = parseHuggingFaceSource(source ?? "");
	const idDefault = deriveModelId(parsed);
	const id = await promptText({ label: "Model id", defaultValue: idDefault, validate: validateModelId });

	const filesDefault = parsed.files.join(",");
	const filesValue = await promptText({
		label: "Files to download",
		defaultValue: filesDefault || undefined,
		placeholder: "model.gguf,tokenizer.json",
		validate: (value) => (parseCommaSeparatedFiles(value).length > 0 ? null : "Provide at least one file path."),
	});

	const revision = await promptText({ label: "Revision", defaultValue: parsed.revision ?? "main" });
	const targetDir = await promptText({ label: "Target directory", defaultValue: slugify(id ?? idDefault) });
	const description = await promptText({ label: "Description", optional: true, placeholder: "Optional" });
	const tokenEnvVar = await promptText({ label: "Token env var", optional: true, placeholder: "HF_TOKEN" });

	printPanel("Review", [
		`Id: ${id}`,
		`Repo: ${parsed.repo}`,
		`Revision: ${revision}`,
		`Files: ${filesValue}`,
		`Target dir: ${targetDir}`,
		`Token env var: ${tokenEnvVar ?? "HF_TOKEN"}`,
	]);

	const confirmed = await promptConfirm({ label: "Add this model to the registry?", defaultValue: true });
	if (!confirmed) {
		console.log(theme.warning("Model creation cancelled."));
		return;
	}

	await addHuggingFaceLLM({
		id: id ?? idDefault,
		repo: parsed.repo,
		files: parseCommaSeparatedFiles(filesValue ?? filesDefault),
		revision,
		targetDir,
		description,
		tokenEnvVar,
	});
}

async function pullModelInteractive(): Promise<void> {
	const config = await readLLMConfig();
	if (config.models.length === 0) {
		console.log(theme.warning("No models are configured yet."));
		return;
	}

	const selectedModel = await selectMenu(
		"Select a model to pull",
		[
			...config.models.map((model) => ({
				value: model.id,
				label: model.id,
				hint: `${model.repo}@${model.revision}`,
			})),
			{ value: "back", label: "Back", hint: "Return to the models menu" },
		],
		"Arrow keys move through the list. Number keys jump straight to a model.",
	);

	if (selectedModel === "back") {
		return;
	}

	await pullLLM(selectedModel);
}

export async function openModelsMenu(): Promise<void> {
	while (true) {
		console.clear();
		await renderModelsOverview();
		const action = await selectMenu<ModelsMenuAction>(
			"Model actions",
			[
				{ value: "init", label: "Initialize registry", hint: "Create the llms section in the Models manifest" },
				{ value: "list", label: "List configured models", hint: "Show status for configured downloads" },
				{ value: "add-hf", label: "Add Hugging Face model", hint: "Paste a repo or file URL and save it to the registry" },
				{ value: "pull-one", label: "Pull one model", hint: "Download a configured model into the Models directory" },
				{ value: "pull-all", label: "Pull all configured models", hint: "Download every configured artifact" },
				{ value: "back", label: "Back", hint: "Return to the main dashboard" },
			],
			"Use Enter after selecting with arrows, or tap the number for an instant shortcut.",
		);

		switch (action) {
			case "init":
				await initLLMConfig();
				break;
			case "list":
				await listConfiguredLLMs();
				break;
			case "add-hf":
				await addModelInteractive();
				break;
			case "pull-one":
				await pullModelInteractive();
				break;
			case "pull-all":
				await pullAllLLMs();
				break;
			case "back":
				return;
		}

		await pause();
	}
}

export async function runModelsCommand(args: string[]): Promise<boolean> {
	const [action, ...rest] = args;

	if (!action) {
		await openModelsMenu();
		return true;
	}

	switch (action) {
		case "init":
			await initLLMConfig();
			return true;
		case "list":
			await withSpinner("Loading model registry", async () => {
				await listConfiguredLLMs();
			});
			return true;
		case "add-hf":
			if (rest.length === 0) {
				await addModelInteractive();
				return true;
			}

			await addHuggingFaceLLM(parseAddHuggingFaceInput(rest));
			return true;
		case "pull": {
			const [modelId] = rest;
			if (!modelId) {
				await pullModelInteractive();
				return true;
			}

			if (modelId === "all") {
				await pullAllLLMs();
				return true;
			}

			await pullLLM(modelId);
			return true;
		}
		default:
			return false;
	}
}

export function isCliCancelled(error: unknown): boolean {
	return error instanceof CliCancelledError;
}