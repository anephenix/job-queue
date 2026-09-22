import { existsSync } from "node:fs";
import path from "node:path";
import reportQueue from "./queue.ts";

const inputPath = process.argv[2];

if (!inputPath) {
	console.error("Usage: npm run add-job -- <path-to-report-json-file>");
	process.exit(1);
}

if (!existsSync(inputPath)) {
	console.error(`File not found: ${inputPath}`);
	process.exit(1);
}

const name = path.basename(inputPath, path.extname(inputPath));
const outputPath = path.join("output", `${name}.pdf`);

await reportQueue.add({
	name: "generate-report",
	data: { inputPath, outputPath },
});

console.log(`Queued ${inputPath} for report generation -> ${outputPath}`);
await reportQueue.disconnect();
