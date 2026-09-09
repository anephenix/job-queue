import webhookWorker from "./worker.ts";

console.log("Webhook worker started, polling for jobs...");
console.log("Press Ctrl+C to stop.");

process.on("SIGINT", async () => {
	console.log("\nStopping worker...");
	await webhookWorker.stop();
	process.exit(0);
});

await webhookWorker.start();
