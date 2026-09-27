import reportWorker from "./worker.ts";

console.log("Report worker started, polling for jobs...");
console.log("Press Ctrl+C to stop.");

process.on("SIGINT", async () => {
	console.log("\nStopping worker...");
	await reportWorker.stop();
	process.exit(0);
});

await reportWorker.start();
