import { $ } from "bun";
import { defaultModelsDirName, envVars, llmConfigFileName } from "./constants";
import { pathExists } from "./utils/filesystem";

type SupportedModelProvider = "huggingface";

export type LLMModelConfig = {
	id: string;
	description?: string;
	provider: SupportedModelProvider;
	repo: string;
	revision: string;
	files: string[];
	targetDir?: string;
	tokenEnvVar?: string;
};

export type LLMConfigFile = {
	configVersion: 1;
	models: LLMModelConfig[];
};

type LLMPackageFile = Record<string, unknown> & {
	name?: string;
	private?: boolean;
	llms?: unknown;
};

export type LLMInstallationStatus = {
	model: LLMModelConfig;
	installed: boolean;
	missingFiles: string[];
	targetDir: string;
};

export type AddHuggingFaceLLMInput = {
	id: string;
	repo: string;
	files: string[];
	revision?: string;
	targetDir?: string;
	description?: string;
	tokenEnvVar?: string;
};

const defaultLLMConfig: LLMConfigFile = {
	configVersion: 1,
	models: [],
};

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNonEmptyString(value: unknown, fieldName: string): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`Invalid LLM config: \"${fieldName}\" must be a non-empty string`);
	}

	return value.trim();
}

function toStringArray(value: unknown, fieldName: string): string[] {
	if (!Array.isArray(value) || value.length === 0) {
		throw new Error(`Invalid LLM config: \"${fieldName}\" must be a non-empty array of strings`);
	}

	return value.map((item, index) => toNonEmptyString(item, `${fieldName}[${index}]`));
}

function joinPosixPath(...parts: string[]): string {
	return parts
		.filter((part) => part.length > 0)
		.map((part, index) => {
			if (index === 0) {
				return part.replace(/\/+$/g, "");
			}

			return part.replace(/^\/+|\/+$/g, "");
		})
		.join("/");
}

function getParentDir(path: string): string {
	const lastSlashIndex = path.lastIndexOf("/");
	return lastSlashIndex === -1 ? "." : path.slice(0, lastSlashIndex);
}

function encodeHuggingFacePath(path: string): string {
	return path
		.split("/")
		.map((part) => encodeURIComponent(part))
		.join("/");
}

function getDefaultTargetDirName(id: string): string {
	return id.trim().replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function parseCommaSeparatedList(value: string, fieldName: string): string[] {
	const parts = value
		.split(",")
		.map((item) => item.trim())
		.filter((item) => item.length > 0);

	if (parts.length === 0) {
		throw new Error(`Invalid ${fieldName}: provide at least one value`);
	}

	return parts;
}

function parseModelConfig(value: unknown, index: number): LLMModelConfig {
	if (!isObject(value)) {
		throw new Error(`Invalid LLM config: models[${index}] must be an object`);
	}

	const provider = toNonEmptyString(value.provider, `models[${index}].provider`);
	if (provider !== "huggingface") {
		throw new Error(`Invalid LLM config: unsupported provider \"${provider}\"`);
	}

	const tokenEnvVarValue = value.tokenEnvVar;
	if (tokenEnvVarValue !== undefined && typeof tokenEnvVarValue !== "string") {
		throw new Error(`Invalid LLM config: \"models[${index}].tokenEnvVar\" must be a string when provided`);
	}

	const targetDirValue = value.targetDir;
	if (targetDirValue !== undefined && typeof targetDirValue !== "string") {
		throw new Error(`Invalid LLM config: \"models[${index}].targetDir\" must be a string when provided`);
	}

	const descriptionValue = value.description;
	if (descriptionValue !== undefined && typeof descriptionValue !== "string") {
		throw new Error(`Invalid LLM config: \"models[${index}].description\" must be a string when provided`);
	}

	return {
		id: toNonEmptyString(value.id, `models[${index}].id`),
		description: descriptionValue,
		provider,
		repo: toNonEmptyString(value.repo, `models[${index}].repo`),
		revision: toNonEmptyString(value.revision, `models[${index}].revision`),
		files: toStringArray(value.files, `models[${index}].files`),
		targetDir: targetDirValue,
		tokenEnvVar: tokenEnvVarValue,
	};
}

function parseLLMConfig(value: unknown, configPath: string): LLMConfigFile {
	if (!isObject(value)) {
		throw new Error(`Invalid LLM config at ${configPath}: expected a JSON object`);
	}

	const modelsValue = value.models;
	if (!Array.isArray(modelsValue)) {
		throw new Error(`Invalid LLM config at ${configPath}: \"models\" must be an array`);
	}

	const configVersion = value.configVersion;
	if (configVersion !== 1) {
		throw new Error(`Invalid LLM config at ${configPath}: \"configVersion\" must be 1`);
	}

	return {
		configVersion: 1,
		models: modelsValue.map((model, index) => parseModelConfig(model, index)),
	};
}

async function readLLMPackageFile(configPath: string): Promise<LLMPackageFile> {
	const configExists = await pathExists(configPath);
	if (!configExists) {
		return {};
	}

	const configText = await Bun.file(configPath).text();
	let parsedConfig: unknown;

	try {
		parsedConfig = JSON.parse(configText);
	} catch (error) {
		throw new Error(`Failed to parse LLM config at ${configPath}: ${error}`);
	}

	if (!isObject(parsedConfig)) {
		throw new Error(`Invalid LLM config at ${configPath}: expected a JSON object`);
	}

	return parsedConfig;
}

async function writeLLMPackageFile(configPath: string, pkg: LLMPackageFile): Promise<void> {
	await $`mkdir -p ${getParentDir(configPath)}`;
	await Bun.write(configPath, `${JSON.stringify(pkg, null, "\t")}\n`);
}

function getEmbeddedLLMConfig(pkg: LLMPackageFile, configPath: string): LLMConfigFile | null {
	if (pkg.llms !== undefined) {
		return parseLLMConfig(pkg.llms, configPath);
	}

	if (pkg.configVersion !== undefined || pkg.models !== undefined) {
		return parseLLMConfig(pkg, configPath);
	}

	return null;
}

async function readLLMState(): Promise<{ configPath: string; pkg: LLMPackageFile; config: LLMConfigFile }> {
	const configPath = getLLMConfigPath();
	const pkg = await readLLMPackageFile(configPath);
	const config = getEmbeddedLLMConfig(pkg, configPath);

	if (!config) {
		throw new Error(`LLM config not found in ${configPath}. Run \"bun run index.ts models init\" first.`);
	}

	return { configPath, pkg, config };
}

async function writeLLMConfig(config: LLMConfigFile): Promise<string> {
	const configPath = getLLMConfigPath();
	const pkg = await readLLMPackageFile(configPath);
	const nextPackage: LLMPackageFile = {
		name: typeof pkg.name === "string" ? pkg.name : "llm-central",
		private: typeof pkg.private === "boolean" ? pkg.private : true,
		...pkg,
		llms: config,
	};

	await writeLLMPackageFile(configPath, nextPackage);
	return configPath;
}

function getModelTargetDir(modelsDir: string, model: LLMModelConfig): string {
	return joinPosixPath(modelsDir, model.targetDir ?? model.id);
}

function buildHuggingFaceUrl(model: LLMModelConfig, filePath: string): string {
	return `https://huggingface.co/${model.repo}/resolve/${encodeURIComponent(model.revision)}/${encodeHuggingFacePath(filePath)}?download=true`;
}

export function getDefaultModelsDir(homeDir?: string): string {
	if (!homeDir) {
		throw new Error(`${envVars.homeDir} environment variable is not set`);
	}

	return joinPosixPath(homeDir, defaultModelsDirName);
}

export function getModelsDir(): string {
	const configuredModelsDir = process.env[envVars.modelsDir];
	if (configuredModelsDir && configuredModelsDir.trim().length > 0) {
		return configuredModelsDir;
	}

	return getDefaultModelsDir(process.env[envVars.homeDir]);
}

export function getLLMConfigPath(): string {
	return joinPosixPath(getModelsDir(), llmConfigFileName);
}

export async function initLLMConfig(): Promise<string> {
	const configPath = getLLMConfigPath();
	const pkg = await readLLMPackageFile(configPath);
	const existingConfig = getEmbeddedLLMConfig(pkg, configPath);

	if (existingConfig) {
		console.log(`\x1b[33m!\x1b[0m LLM config already exists at ${configPath}`);
	} else {
		const nextPackage: LLMPackageFile = {
			name: typeof pkg.name === "string" ? pkg.name : "llm-central",
			private: typeof pkg.private === "boolean" ? pkg.private : true,
			...pkg,
			llms: defaultLLMConfig,
		};

		await writeLLMPackageFile(configPath, nextPackage);
		console.log(`\x1b[32m✓\x1b[0m Initialized llms config in ${configPath}`);
	}

	console.log(`\x1b[36mℹ\x1b[0m Models directory: ${getModelsDir()}`);
	return configPath;
}

export async function readLLMConfig(): Promise<LLMConfigFile> {
	const state = await readLLMState();
	return state.config;
}

export async function addHuggingFaceLLM(input: AddHuggingFaceLLMInput): Promise<void> {
	const { config, configPath } = await readLLMState();
	const id = toNonEmptyString(input.id, "id");

	if (config.models.some((model) => model.id === id)) {
		throw new Error(`Model \"${id}\" already exists in ${configPath}`);
	}

	const files = input.files.map((file, index) => toNonEmptyString(file, `files[${index}]`));
	const model: LLMModelConfig = {
		id,
		provider: "huggingface",
		repo: toNonEmptyString(input.repo, "repo"),
		revision: input.revision ? toNonEmptyString(input.revision, "revision") : "main",
		files,
		targetDir: input.targetDir ? toNonEmptyString(input.targetDir, "targetDir") : getDefaultTargetDirName(id),
		description: input.description ? toNonEmptyString(input.description, "description") : undefined,
		tokenEnvVar: input.tokenEnvVar ? toNonEmptyString(input.tokenEnvVar, "tokenEnvVar") : undefined,
	};

	const nextConfig: LLMConfigFile = {
		...config,
		models: [...config.models, model],
	};

	await writeLLMConfig(nextConfig);
	console.log(`\x1b[32m✓\x1b[0m Added Hugging Face model ${model.id} to ${configPath}`);
	console.log(`\x1b[36mℹ\x1b[0m Files: ${model.files.join(", ")}`);
	console.log(`\x1b[36mℹ\x1b[0m Target dir: ${getModelTargetDir(getModelsDir(), model)}`);
}

export function parseAddHuggingFaceInput(args: string[]): AddHuggingFaceLLMInput {
	const [id, repo, filesArg, revision, targetDir, description, tokenEnvVar] = args;

	if (!id || !repo || !filesArg) {
		throw new Error(
			"Missing arguments. Use \"bun run index.ts models add-hf <id> <repo> <file[,file2]> [revision] [target-dir] [description] [token-env-var]\".",
		);
	}

	return {
		id,
		repo,
		files: parseCommaSeparatedList(filesArg, "files"),
		revision,
		targetDir,
		description,
		tokenEnvVar,
	};
}

export async function listConfiguredLLMs(): Promise<LLMInstallationStatus[]> {
	const modelsDir = getModelsDir();
	const configPath = getLLMConfigPath();
	const config = await readLLMConfig();

	if (config.models.length === 0) {
		console.log(`\x1b[33m!\x1b[0m No models configured in ${configPath}`);
		return [];
	}

	const statuses = await Promise.all(
		config.models.map(async (model) => {
			const targetDir = getModelTargetDir(modelsDir, model);
			const missingFiles: string[] = [];

			for (const filePath of model.files) {
				const localPath = joinPosixPath(targetDir, filePath);
				if (!(await pathExists(localPath))) {
					missingFiles.push(filePath);
				}
			}

			return {
				model,
				installed: missingFiles.length === 0,
				missingFiles,
				targetDir,
			};
		}),
	);

	console.log(`\x1b[36mℹ\x1b[0m Config file: ${configPath}`);
	console.log(`\x1b[36mℹ\x1b[0m Models directory: ${modelsDir}`);

	for (const status of statuses) {
		const stateLabel = status.installed ? "\x1b[32minstalled\x1b[0m" : "\x1b[33mnot installed\x1b[0m";
		console.log(`- ${status.model.id} [${stateLabel}]`);
		console.log(`  ${status.model.repo}@${status.model.revision}`);
		console.log(`  -> ${status.targetDir}`);
	}

	return statuses;
}

async function downloadModelFile(model: LLMModelConfig, filePath: string, targetPath: string): Promise<void> {
	const tokenEnvVar = model.tokenEnvVar ?? envVars.huggingFaceToken;
	const token = process.env[tokenEnvVar];
	const response = await fetch(buildHuggingFaceUrl(model, filePath), {
		headers: token ? { Authorization: `Bearer ${token}` } : undefined,
	});

	if (!response.ok) {
		throw new Error(`Failed to download ${filePath} from ${model.repo}@${model.revision}: ${response.status} ${response.statusText}`);
	}

	await $`mkdir -p ${getParentDir(targetPath)}`;
	await Bun.write(targetPath, response);
	console.log(`\x1b[32m✓\x1b[0m Downloaded ${filePath} -> ${targetPath}`);
}

export async function pullLLM(modelId: string): Promise<void> {
	const config = await readLLMConfig();
	const model = config.models.find((entry) => entry.id === modelId);

	if (!model) {
		throw new Error(`Model \"${modelId}\" is not defined in ${getLLMConfigPath()}`);
	}

	const targetDir = getModelTargetDir(getModelsDir(), model);
	for (const filePath of model.files) {
		const localPath = joinPosixPath(targetDir, filePath);
		if (await pathExists(localPath)) {
			console.log(`\x1b[33m!\x1b[0m Skipping existing file ${localPath}`);
			continue;
		}

		await downloadModelFile(model, filePath, localPath);
	}

	console.log(`\x1b[32m✓\x1b[0m Model ${model.id} is ready in ${targetDir}`);
}

export async function pullAllLLMs(): Promise<void> {
	const config = await readLLMConfig();

	if (config.models.length === 0) {
		console.log(`\x1b[33m!\x1b[0m No models configured in ${getLLMConfigPath()}`);
		return;
	}

	for (const model of config.models) {
		await pullLLM(model.id);
	}
}
