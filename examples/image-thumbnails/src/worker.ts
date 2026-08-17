import { mkdir } from "node:fs/promises";
import path from "node:path";
import { type Job, Worker } from "@anephenix/job-queue";
import sharp from "sharp";
import thumbnailQueue from "./queue.ts";

type ThumbnailJob = Job & {
	data: {
		inputPath: string;
		outputDir: string;
	};
};

const SIZES = [
	{ name: "small", width: 200 },
	{ name: "medium", width: 500 },
	{ name: "large", width: 1000 },
];

async function generateThumbnails(
	inputPath: string,
	outputDir: string,
): Promise<void> {
	await mkdir(outputDir, { recursive: true });
	await Promise.all(
		SIZES.map(({ name, width }) =>
			sharp(inputPath)
				.resize({ width, withoutEnlargement: true })
				.webp()
				.toFile(path.join(outputDir, `${name}.webp`)),
		),
	);
}

class ThumbnailWorker extends Worker {
	async processJob(job: Job): Promise<void> {
		this.status = "processing";
		const { inputPath, outputDir } = (job as ThumbnailJob).data;

		try {
			console.log(`Generating thumbnails for ${inputPath} -> ${outputDir}`);
			await generateThumbnails(inputPath, outputDir);
			console.log(`Finished generating thumbnails for ${inputPath}`);
			await this.completeJob(job);
		} catch (err) {
			console.error(`Error generating thumbnails for ${inputPath}:`, err);
			await this.failJob(job);
		}
	}
}

const thumbnailWorker = new ThumbnailWorker(thumbnailQueue);

export default thumbnailWorker;
