import { $ } from "bun";
import { envVars } from "./constants";
import { getLLMConfigPath } from "./llms";
import { pathExists } from "./utils/filesystem";

export async function backupConfigFolder(): Promise<void> {
    const backupDir = process.env[envVars.backupDir];
    const homeDir = process.env[envVars.homeDir];

    if (!backupDir) {
        throw new Error(`${envVars.backupDir} environment variable is not set`);
    }

    if (!homeDir) {
        throw new Error(`${envVars.homeDir} environment variable is not set`);
    }

    const sourceDir = `${homeDir}/.config`;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = `${backupDir}/config-backup-latest`;
    const timestampedPath = `${backupDir}/config-backup-${timestamp}`;
    
    // Move previous latest backup to timestamped version if it exists
    try {
        await $`mkdir -p ${backupDir}`;
        
        const backupPathExists = await pathExists(backupPath);
        if (backupPathExists) {
            await $`mv ${backupPath} ${timestampedPath}`;
        }

        await $`cp -r ${sourceDir} ${backupPath}`;
        console.log(`\x1b[32m✓\x1b[0m Config folder backed up to ${backupPath}`);
    } catch (error) {
        throw new Error(`Failed to backup config folder: ${error}`);
    }
}

export async function backupLLMConfigs(): Promise<void> {
    const backupDir = process.env[envVars.backupDir];

    if (!backupDir) {
        throw new Error(`${envVars.backupDir} environment variable is not set`);
    }

    const sourceDir = getLLMConfigPath();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = `${backupDir}/llm-config-backup-latest.json`;
    const timestampedPath = `${backupDir}/llm-config-backup-${timestamp}.json`;

    try {
        await $`mkdir -p ${backupDir}`;

        const backupPathExists = await pathExists(backupPath);
        if (backupPathExists) {
            await $`mv ${backupPath} ${timestampedPath}`;
        }

        await $`cp ${sourceDir} ${backupPath}`;
        console.log(`\x1b[32m✓\x1b[0m LLM config backed up to ${backupPath}`);
    } catch (error) {
        throw new Error(`Failed to backup LLM config: ${error}`);
    }
}