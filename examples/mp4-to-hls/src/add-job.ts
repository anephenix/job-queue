import { existsSync } from "node:fs";
import path from "node:path";
import transcodeQueue from "./queue.ts";

const inputPath = process.argv[2];

if (!inputPath) {
	console.error("Usage: npm run add-job -- <path-to-mp4-file>");
	process.exit(1);
}

if (!existsSync(inputPath)) {
	console.error(`File not found: ${inputPath}`);
	process.exit(1);
}

const name = path.basename(inputPath, path.extname(inputPath));
const outputDir = path.join("output", name);

await transcodeQueue.add({
	name: "hls-transcode",
	data: { inputPath, outputDir },
});

console.log(
	`Queued ${inputPath} for transcoding. Output will be written to ${outputDir}/`,
);
await transcodeQueue.disconnect();
