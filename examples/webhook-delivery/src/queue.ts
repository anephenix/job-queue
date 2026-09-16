import { type Hooks, type Job, SQLiteQueue } from "@anephenix/job-queue";
import db from "./sqlite.ts";

// Creates the job_queue_jobs table if it doesn't already exist.
// Safe to call every time the process starts.
SQLiteQueue.migrate(db);

type WebhookJobData = { id: string };

// How long to wait before each retry. The Nth entry is the delay before
// the (N+1)th attempt. Once a job has used up all of these, it's left
// failed rather than retried again.
const BACKOFF_DELAYS_MS = [1000, 3000, 8000];

// Tracks how many times each job has failed so far. Scoped to this
// worker process - a production setup would persist this alongside the
// job itself so retries survive a restart.
const attemptsByJobId = new Map<string, number>();

let webhookQueue: SQLiteQueue;

const hooks: Partial<Hooks> = {
	fail: {
		post: async (job?: Job) => {
			if (!job) return;
			const { id } = job.data as WebhookJobData;
			const attempt = attemptsByJobId.get(id) ?? 0;

			if (attempt >= BACKOFF_DELAYS_MS.length) {
				console.log(
					`Webhook ${id} failed after ${attempt} attempts. Giving up.`,
				);
				return;
			}

			const delay = BACKOFF_DELAYS_MS[attempt];
			attemptsByJobId.set(id, attempt + 1);
			console.log(
				`Webhook ${id} failed (attempt ${attempt + 1}/${BACKOFF_DELAYS_MS.length + 1}). Retrying in ${delay}ms...`,
			);
			setTimeout(() => {
				webhookQueue
					.retry(job)
					.catch((err) => console.error(`Failed to retry webhook ${id}:`, err));
			}, delay);
		},
	},
	retry: {
		post: async (job?: Job) => {
			if (!job) return;
			const { id } = job.data as WebhookJobData;
			console.log(`Webhook ${id} is back in the queue for another attempt.`);
		},
	},
};

const queueOptions = { queueKey: "webhook-delivery", db, hooks };
webhookQueue = new SQLiteQueue(queueOptions);

export default webhookQueue;
