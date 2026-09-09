import emailWorker from "./worker.ts";

console.log("Email worker started, polling for jobs...");
console.log("Press Ctrl+C to stop.");

process.on("SIGINT", async () => {
	console.log("\nStopping worker...");
	await emailWorker.stop();
	process.exit(0);
});

await emailWorker.start();
