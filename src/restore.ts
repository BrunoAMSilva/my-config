import { $ } from "bun";
import { bundledSkillsPath, envVars, skillTargetDirs } from "./constants";
import { pathExists } from "./utils/filesystem";

export async function restoreConfigFolder(): Promise<void> {
	const backupDir = process.env[envVars.backupDir];
	const homeDir = process.env[envVars.homeDir];

	if (!backupDir) {
		throw new Error(`${envVars.backupDir} environment variable is not set`);
	}

	if (!homeDir) {
		throw new Error(`${envVars.homeDir} environment variable is not set`);
	}

	const backupPath = `${backupDir}/config-backup-latest`;
	const targetPath = `${homeDir}/.config`;
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const archivedPath = `${backupDir}/config-pre-restore-${timestamp}`;
	const partialRestorePath = `${backupDir}/config-restore-incomplete-${timestamp}`;

	const backupExists = await pathExists(backupPath);
	if (!backupExists) {
		throw new Error(`Latest config backup not found at ${backupPath}`);
	}

	const targetExists = await pathExists(targetPath);

	try {
		await $`mkdir -p ${backupDir}`;

		if (targetExists) {
			await $`mv ${targetPath} ${archivedPath}`;
		}

		try {
			await $`cp -R ${backupPath} ${targetPath}`;
		} catch (error) {
			if (await pathExists(targetPath)) {
				await $`mv ${targetPath} ${partialRestorePath}`;
			}

			if (targetExists && (await pathExists(archivedPath))) {
				await $`mv ${archivedPath} ${targetPath}`;
			}

			throw error;
		}

		console.log(`\x1b[32m✓\x1b[0m Config folder restored from ${backupPath}`);

		if (targetExists) {
			console.log(`\x1b[33m!\x1b[0m Previous config archived at ${archivedPath}`);
		}
	} catch (error) {
		throw new Error(`Failed to restore config folder: ${error}`);
	}
}

export async function restoreAiSkills(): Promise<void> {
	const homeDir = process.env[envVars.homeDir];

	if (!homeDir) {
		throw new Error(`${envVars.homeDir} environment variable is not set`);
	}

	const bundledSkillsExist = await pathExists(bundledSkillsPath);
	if (!bundledSkillsExist) {
		throw new Error(`Bundled skills folder not found at ${bundledSkillsPath}`);
	}

	try {
		for (const relativeTargetDir of skillTargetDirs) {
			const targetPath = `${homeDir}/${relativeTargetDir}`;

			await $`mkdir -p ${targetPath}`;
			await $`cp -R ${`${bundledSkillsPath}/.`} ${targetPath}`;
		}

		console.log(`\x1b[32m✓\x1b[0m Skills copied from ${bundledSkillsPath}`);
		for (const relativeTargetDir of skillTargetDirs) {
			console.log(`  -> ${homeDir}/${relativeTargetDir}`);
		}
	} catch (error) {
		throw new Error(`Failed to copy bundled skills: ${error}`);
	}
}

export async function restoreLLMConfigs(): Promise<void> {
    const backupDir = process.env[envVars.backupDir];
    const homeDir = process.env[envVars.homeDir];

    if (!backupDir) {
        throw new Error(`${envVars.backupDir} environment variable is not set`);
    }

    if (!homeDir) {
        throw new Error(`${envVars.homeDir} environment variable is not set`);
    }

    const backupPath = `${backupDir}/llm-config-backup-latest.json`;
    const targetPath = `${homeDir}/Models/package.json`;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const archivedPath = `${backupDir}/llm-config-pre-restore-${timestamp}.json`;
    const partialRestorePath = `${backupDir}/llm-config-restore-incomplete-${timestamp}.json`;

    const backupExists = await pathExists(backupPath);
    if (!backupExists) {
        throw new Error(`Latest LLM config backup not found at ${backupPath}`);
    }

    const targetExists = await pathExists(targetPath);

    try {
        await $`mkdir -p ${backupDir}`;

        if (targetExists) {
            await $`mv ${targetPath} ${archivedPath}`;
        }

        try {
            await $`cp ${backupPath} ${targetPath}`;
        } catch (error) {
            if (await pathExists(targetPath)) {
                await $`mv ${targetPath} ${partialRestorePath}`;
            }

            if (targetExists && (await pathExists(archivedPath))) {
                await $`mv ${archivedPath} ${targetPath}`;
            }

            throw error;
        }

        console.log(`\x1b[32m✓\x1b[0m LLM config restored from ${backupPath}`);

        if (targetExists) {
            console.log(`\x1b[33m!\x1b[0m Previous LLM config archived at ${archivedPath}`);
        }
    } catch (error) {
        throw new Error(`Failed to restore LLM config: ${error}`);
    }
}