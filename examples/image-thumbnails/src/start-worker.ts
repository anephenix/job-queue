import thumbnailWorker from "./worker.ts";

console.log("Thumbnail worker started, polling for jobs...");
console.log("Press Ctrl+C to stop.");

process.on("SIGINT", async () => {
	console.log("\nStopping worker...");
	await thumbnailWorker.stop();
	process.exit(0);
});

await thumbnailWorker.start();
