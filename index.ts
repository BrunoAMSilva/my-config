import { isCliCancellation, runCli } from "./src/cli/app";

runCli(Bun.argv.slice(2)).catch((error) => {
	if (isCliCancellation(error)) {
		console.log("\n\x1b[33m!\x1b[0m Cancelled.");
		process.exit(0);
	}

	console.error(`\x1b[31m✗\x1b[0m ${error instanceof Error ? error.message : String(error)}`);
	process.exit(1);
});