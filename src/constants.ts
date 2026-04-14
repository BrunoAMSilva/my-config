export const envVars = {
	homeDir: "HOME",
	backupDir: "BACKUP_DIR",
	developerProjectsDir: "DEVELOPER_PROJECTS_DIR",
} as const;

export const bundledSkillsPath = `${import.meta.dir}/../coding/skills`;
export const defaultDeveloperProjectsDirName = "Developer";
export const projectSkillsDir = ".github/skills";
export const skillTargetDirs = [".claude/skills", ".copilot/skills"] as const;