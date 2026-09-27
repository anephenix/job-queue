import { existsSync } from "node:fs";
import path from "node:path";
import csvImportQueue from "./queue.ts";

const filePath = process.argv[2];

if (!filePath) {
	console.error("Usage: npm run add-job -- <path-to-csv-file>");
	process.exit(1);
}

if (!existsSync(filePath)) {
	console.error(`File not found: ${filePath}`);
	process.exit(1);
}

await csvImportQueue.add({
	name: "csv-import",
	data: { filePath: path.resolve(filePath) },
});

console.log(`Queued ${filePath} for import.`);
await csvImportQueue.disconnect();
