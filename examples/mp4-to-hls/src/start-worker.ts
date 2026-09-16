import hlsTranscodeWorker from "./worker.ts";

console.log("HLS transcode worker started, polling for jobs...");
console.log("Press Ctrl+C to stop.");

process.on("SIGINT", async () => {
	console.log("\nStopping worker...");
	await hlsTranscodeWorker.stop();
	process.exit(0);
});

await hlsTranscodeWorker.start();
