export const envVars = {
	homeDir: "HOME",
	backupDir: "BACKUP_DIR",
	developerProjectsDir: "DEVELOPER_PROJECTS_DIR",
	modelsDir: "MODELS_DIR",
	huggingFaceToken: "HF_TOKEN",
} as const;

export const bundledSkillsPath = `${import.meta.dir}/../coding/skills`;
export const defaultDeveloperProjectsDirName = "Developer";
export const defaultModelsDirName = "Models";
export const llmConfigFileName = "package.json";
export const projectSkillsDir = ".github/skills";
export const skillTargetDirs = [".claude/skills", ".copilot/skills"] as const;