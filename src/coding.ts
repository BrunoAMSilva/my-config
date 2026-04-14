import { $ } from "bun";
import { bundledSkillsPath, defaultDeveloperProjectsDirName, envVars, projectSkillsDir } from "./constants";
import { pathExists } from "./utils/filesystem";

export async function syncBundledSkillsToProjects(): Promise<void> {
	const homeDir = process.env[envVars.homeDir];
	const developerProjectsDir = process.env[envVars.developerProjectsDir] ?? (homeDir ? `${homeDir}/${defaultDeveloperProjectsDirName}` : undefined);

	if (!homeDir) {
		throw new Error(`${envVars.homeDir} environment variable is not set`);
	}

	if (!developerProjectsDir) {
		throw new Error(`${envVars.developerProjectsDir} environment variable is not set`);
	}

	const bundledSkillsExist = await pathExists(bundledSkillsPath);
	if (!bundledSkillsExist) {
		throw new Error(`Bundled skills folder not found at ${bundledSkillsPath}`);
	}

	const developerProjectsDirExists = await pathExists(developerProjectsDir);
	if (!developerProjectsDirExists) {
		throw new Error(`Developer projects directory not found at ${developerProjectsDir}`);
	}

	const skillDirectoryResults = await $`find ${developerProjectsDir} -type d -path ${`*/${projectSkillsDir}`}`.quiet().text();
	const skillDirectories = skillDirectoryResults
		.split("\n")
		.map((directory) => directory.trim())
		.filter((directory) => directory.length > 0);

	if (skillDirectories.length === 0) {
		console.log(`\x1b[33m!\x1b[0m No project skill directories found under ${developerProjectsDir}`);
		return;
	}

	try {
		for (const skillDirectory of skillDirectories) {
			await $`cp -R ${`${bundledSkillsPath}/.`} ${skillDirectory}`;
		}

		console.log(`\x1b[32m✓\x1b[0m Synced bundled skills to ${skillDirectories.length} project directories`);
		for (const skillDirectory of skillDirectories) {
			console.log(`  -> ${skillDirectory}`);
		}
	} catch (error) {
		throw new Error(`Failed to sync bundled skills to project directories: ${error}`);
	}
}
