import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { type Job, Worker } from "@anephenix/job-queue";
import transcodeQueue from "./queue.ts";

type TranscodeJob = Job & {
	data: {
		inputPath: string;
		outputDir: string;
	};
};

/*
 * Runs ffmpeg as a child process, converting the input mp4 file into an
 * HLS rendition (a .m3u8 playlist plus a series of .ts segment files)
 * inside outputDir. Requires ffmpeg to be installed and on the PATH.
 */
function runFfmpeg(inputPath: string, outputDir: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const playlistPath = path.join(outputDir, "index.m3u8");
		const segmentPath = path.join(outputDir, "segment%03d.ts");

		const ffmpeg = spawn("ffmpeg", [
			"-y",
			"-i",
			inputPath,
			"-codec:",
			"copy",
			"-start_number",
			"0",
			"-hls_time",
			"10",
			"-hls_list_size",
			"0",
			"-hls_segment_filename",
			segmentPath,
			"-f",
			"hls",
			playlistPath,
		]);

		let stderr = "";
		ffmpeg.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});

		ffmpeg.on("error", reject);
		ffmpeg.on("close", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`ffmpeg exited with code ${code}\n${stderr}`));
			}
		});
	});
}

class HLSTranscodeWorker extends Worker {
	async processJob(job: Job): Promise<void> {
		this.status = "processing";
		const { inputPath, outputDir } = (job as TranscodeJob).data;

		try {
			console.log(`Transcoding ${inputPath} -> ${outputDir}`);
			await mkdir(outputDir, { recursive: true });
			await runFfmpeg(inputPath, outputDir);
			console.log(`Finished transcoding ${inputPath}`);
			await this.completeJob(job);
		} catch (err) {
			console.error(`Error transcoding ${inputPath}:`, err);
			await this.failJob(job);
		}
	}
}

const hlsTranscodeWorker = new HLSTranscodeWorker(transcodeQueue);

export default hlsTranscodeWorker;
