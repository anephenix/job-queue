import { existsSync } from "node:fs";
import path from "node:path";
import thumbnailQueue from "./queue.ts";

const inputPath = process.argv[2];

if (!inputPath) {
	console.error("Usage: npm run add-job -- <path-to-image-file>");
	process.exit(1);
}

if (!existsSync(inputPath)) {
	console.error(`File not found: ${inputPath}`);
	process.exit(1);
}

const name = path.basename(inputPath, path.extname(inputPath));
const outputDir = path.join("output", name);

await thumbnailQueue.add({
	name: "generate-thumbnails",
	data: { inputPath, outputDir },
});

console.log(
	`Queued ${inputPath} for thumbnail generation. Output will be written to ${outputDir}/`,
);
await thumbnailQueue.disconnect();
