import csvImportWorker from "./worker.ts";

console.log("CSV import worker started, polling for jobs...");
console.log("Press Ctrl+C to stop.");

process.on("SIGINT", async () => {
	console.log("\nStopping worker...");
	await csvImportWorker.stop();
	process.exit(0);
});

await csvImportWorker.start();
