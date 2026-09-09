import { type Job, Worker } from "@anephenix/job-queue";
import webhookQueue from "./queue.ts";

type WebhookJob = Job & {
	data: {
		id: string;
		url: string;
		payload: unknown;
	};
};

class WebhookWorker extends Worker {
	async processJob(job: Job): Promise<void> {
		this.status = "processing";
		const { id, url, payload } = (job as WebhookJob).data;

		try {
			const response = await fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
				signal: AbortSignal.timeout(5000),
			});

			if (!response.ok) {
				throw new Error(`Webhook responded with status ${response.status}`);
			}

			console.log(`Delivered webhook ${id} to ${url}`);
			await this.completeJob(job);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			console.error(`Failed to deliver webhook ${id} to ${url}: ${message}`);
			await this.failJob(job);
		}
	}
}

const webhookWorker = new WebhookWorker(webhookQueue);

export default webhookWorker;
