import { $ } from "bun";

export async function pathExists(path: string): Promise<boolean> {
	const result = await $`test -e ${path}`.quiet().nothrow();
	return result.exitCode === 0;
}