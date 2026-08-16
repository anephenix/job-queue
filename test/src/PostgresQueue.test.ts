// Dependencies
import assert from "node:assert";
import type { Pool } from "pg";
import { beforeAll, describe, it } from "vitest";
import { PostgresQueue } from "../../src/PostgresQueue";
import type { Job, SubQueueKey } from "../../src/types";
import { createPool, getPool } from "../postgres";

const fetchLatest = async (
	pool: Pool,
	queueKey: string,
	status: SubQueueKey,
): Promise<Job | null> => {
	const result = await pool.query(
		"SELECT data FROM job_queue_jobs WHERE queue_key = $1 AND status = $2 ORDER BY id DESC LIMIT 1",
		[queueKey, status],
	);
	if (result.rowCount === 0) return null;
	return result.rows[0].data;
};

const prepareJob = async (
	queue: PostgresQueue,
	pool: Pool,
	firstAction: keyof PostgresQueue,
	subQueueKey: SubQueueKey,
): Promise<void> => {
	const anotherJob: Job = { name: "Another example job" };
	await queue.add(anotherJob);
	await queue.take();
	const action = queue[firstAction] as (
		this: PostgresQueue,
		job: Job,
	) => Promise<void>;
	if (typeof action === "function") {
		await action.call(queue, anotherJob);
	} else {
		throw new Error(`queue[${String(firstAction)}] is not a function`);
	}
	const processingJob = await fetchLatest(pool, queue.queueKey, "processing");
	const concludedJob = await fetchLatest(pool, queue.queueKey, subQueueKey);
	if (!concludedJob) {
		throw new Error("Jobs not found in queue");
	}
	assert.equal(processingJob, null);
	assert.deepEqual(concludedJob, anotherJob);
};

describe("PostgresQueue", () => {
	let queue: PostgresQueue;
	let job: Job;
	const pool: Pool = getPool();

	beforeAll(async () => {
		await PostgresQueue.migrate(pool);
		const queueKey = "example-pg-queue";
		queue = new PostgresQueue({ queueKey, pg: pool });
		await queue.flushAll();
		job = { name: "example-job" };
	});

	describe("creating an instance", () => {
		it("should set the pg pool", () => {
			assert.deepEqual(pool, queue.pg);
		});
		it("should set the queueKey", () => {
			assert.equal(queue.queueKey, "example-pg-queue");
		});
	});

	describe("adding a job", () => {
		it("should add a job to the available queue", async () => {
			await queue.add(job);
			const fetchedJob = await queue.inspect();
			assert.deepEqual(job, fetchedJob);
		});
	});

	describe("inspecting a job", () => {
		it("should return the latest job on the available queue", async () => {
			const fetchedJob = await queue.inspect();
			assert.deepEqual(job, fetchedJob);
		});

		it("should return null if there are no available jobs on the queue", async () => {
			const queueKey = "this-example-pg-queue";
			const anotherQueue = new PostgresQueue({ queueKey, pg: pool });
			await anotherQueue.flushAll();
			const result = await anotherQueue.inspect();
			assert.equal(result, null);
		});
	});

	describe("taking a job", () => {
		it("should move a job from the available queue to the processing queue", async () => {
			const fetchedJob = await queue.take();
			assert.deepEqual(job, fetchedJob);
			const pgJob = await fetchLatest(pool, queue.queueKey, "processing");
			if (!pgJob) {
				throw new Error("Job not found in queue");
			}
			assert.deepEqual(pgJob, fetchedJob);
		});
	});

	describe("completing a job", () => {
		it("should move a job from the processing queue to the completed queue", async () => {
			const processingJob = await fetchLatest(
				pool,
				queue.queueKey,
				"processing",
			);
			if (!processingJob) {
				throw new Error("Job not found in queue");
			}
			await queue.complete(processingJob);
			const stillProcessingJob = await fetchLatest(
				pool,
				queue.queueKey,
				"processing",
			);
			const completedJob = await fetchLatest(pool, queue.queueKey, "completed");
			if (!completedJob) {
				throw new Error("completedJob not found in queue");
			}
			assert.equal(stillProcessingJob, null);
			assert.deepEqual(completedJob, processingJob);
		});
	});

	describe("failing a job", () => {
		it("should move a job from the processing queue to the failed queue", async () => {
			await prepareJob(queue, pool, "fail", "failed");
		});
	});

	describe("releasing a job", () => {
		it("should move a job from the processing queue to the available queue", async () => {
			await prepareJob(queue, pool, "release", "available");
		});
	});

	describe("retrying a job", () => {
		it("should move a job from the failed queue to the available queue", async () => {
			await queue.flushAll();
			await prepareJob(queue, pool, "fail", "failed");
			const failedJob = await fetchLatest(pool, queue.queueKey, "failed");
			if (!failedJob) {
				throw new Error("Job not found in queue");
			}
			await queue.retry(failedJob);
			const stillFailedJob = await fetchLatest(pool, queue.queueKey, "failed");
			const availableJob = await fetchLatest(pool, queue.queueKey, "available");
			if (!availableJob) {
				throw new Error("Jobs not found in queue");
			}
			assert.equal(stillFailedJob, null);
			assert.deepEqual(availableJob, failedJob);
		});
	});

	describe("flushing all jobs", () => {
		it("should remove all jobs from all queues", async () => {
			await queue.flushAll();
			const available = await fetchLatest(pool, queue.queueKey, "available");
			const processing = await fetchLatest(pool, queue.queueKey, "processing");
			const completed = await fetchLatest(pool, queue.queueKey, "completed");
			const failed = await fetchLatest(pool, queue.queueKey, "failed");
			assert.equal(available, null);
			assert.equal(processing, null);
			assert.equal(completed, null);
			assert.equal(failed, null);
		});
	});

	describe("hooks", () => {
		it("should allow the developer to add pre and post hooks to called actions", async () => {
			const queueKey = "another-example-pg-queue";
			let jobParam: Job | undefined;
			const hookQueue = new PostgresQueue({
				queueKey,
				pg: pool,
				hooks: {
					add: {
						pre: async (job) => {
							jobParam = job;
							return Promise.resolve();
						},
					},
				},
			});
			const hookJob = { name: "example-job" };
			await hookQueue.add(hookJob);
			assert.deepEqual(jobParam, hookJob);
		});
	});

	describe("count", () => {
		const queueKey = "another-example-pg-queue-count";
		const countQueue = new PostgresQueue({ queueKey, pg: pool });

		beforeAll(async () => {
			await countQueue.flushAll();
			const initialCount = await countQueue.count("available");
			assert.equal(initialCount, 0);
			await countQueue.add({ name: "example-job" });
		});

		it("should return the number of jobs in a queue with a specific status", async () => {
			const updatedCount = await countQueue.count("available");
			assert.equal(updatedCount, 1);
		});
	});

	describe("counts", () => {
		it("should return the number of jobs in a queue, for each status", async () => {
			await queue.flushAll();
			await queue.add({ name: "example-job" });
			const counts = await queue.counts();
			assert.deepEqual(counts, {
				available: 1,
				processing: 0,
				completed: 0,
				failed: 0,
			});
			await queue.flushAll();
		});
	});

	describe("disconnect", () => {
		it("should disconnect from the postgres pool", async () => {
			const anotherPool = createPool();
			await anotherPool.query("SELECT 1");
			const anotherQueue = new PostgresQueue({
				queueKey: "other-pg-queue",
				pg: anotherPool,
			});
			await anotherQueue.disconnect();
			await assert.rejects(() => anotherPool.query("SELECT 1"));
		});
	});
});
