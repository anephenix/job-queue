// Dependencies
import assert from "node:assert";
import type { Database } from "better-sqlite3";
import { beforeAll, describe, it } from "vitest";
import { SQLiteQueue } from "../../src/SQLiteQueue";
import type { Job, SubQueueKey } from "../../src/types";
import { createDb, getDb } from "../sqlite";

const fetchLatest = (
	db: Database,
	queueKey: string,
	status: SubQueueKey,
): Job | null => {
	const row = db
		.prepare(
			"SELECT data FROM job_queue_jobs WHERE queue_key = ? AND status = ? ORDER BY id DESC LIMIT 1",
		)
		.get(queueKey, status) as { data: string } | undefined;
	return row ? JSON.parse(row.data) : null;
};

const prepareJob = async (
	queue: SQLiteQueue,
	db: Database,
	firstAction: keyof SQLiteQueue,
	subQueueKey: SubQueueKey,
): Promise<void> => {
	const anotherJob: Job = { name: "Another example job" };
	await queue.add(anotherJob);
	await queue.take();
	const action = queue[firstAction] as (
		this: SQLiteQueue,
		job: Job,
	) => Promise<void>;
	if (typeof action === "function") {
		await action.call(queue, anotherJob);
	} else {
		throw new Error(`queue[${String(firstAction)}] is not a function`);
	}
	const processingJob = fetchLatest(db, queue.queueKey, "processing");
	const concludedJob = fetchLatest(db, queue.queueKey, subQueueKey);
	if (!concludedJob) {
		throw new Error("Jobs not found in queue");
	}
	assert.equal(processingJob, null);
	assert.deepEqual(concludedJob, anotherJob);
};

describe("SQLiteQueue", () => {
	let queue: SQLiteQueue;
	let job: Job;
	const db: Database = getDb();

	beforeAll(async () => {
		SQLiteQueue.migrate(db);
		const queueKey = "example-sqlite-queue";
		queue = new SQLiteQueue({ queueKey, db });
		await queue.flushAll();
		job = { name: "example-job" };
	});

	describe("creating an instance", () => {
		it("should set the db", () => {
			assert.deepEqual(db, queue.db);
		});
		it("should set the queueKey", () => {
			assert.equal(queue.queueKey, "example-sqlite-queue");
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
			const queueKey = "this-example-sqlite-queue";
			const anotherQueue = new SQLiteQueue({ queueKey, db });
			await anotherQueue.flushAll();
			const result = await anotherQueue.inspect();
			assert.equal(result, null);
		});
	});

	describe("taking a job", () => {
		it("should move a job from the available queue to the processing queue", async () => {
			const fetchedJob = await queue.take();
			assert.deepEqual(job, fetchedJob);
			const sqliteJob = fetchLatest(db, queue.queueKey, "processing");
			if (!sqliteJob) {
				throw new Error("Job not found in queue");
			}
			assert.deepEqual(sqliteJob, fetchedJob);
		});
	});

	describe("completing a job", () => {
		it("should move a job from the processing queue to the completed queue", async () => {
			const processingJob = fetchLatest(db, queue.queueKey, "processing");
			if (!processingJob) {
				throw new Error("Job not found in queue");
			}
			await queue.complete(processingJob);
			const stillProcessingJob = fetchLatest(db, queue.queueKey, "processing");
			const completedJob = fetchLatest(db, queue.queueKey, "completed");
			if (!completedJob) {
				throw new Error("completedJob not found in queue");
			}
			assert.equal(stillProcessingJob, null);
			assert.deepEqual(completedJob, processingJob);
		});
	});

	describe("failing a job", () => {
		it("should move a job from the processing queue to the failed queue", async () => {
			await prepareJob(queue, db, "fail", "failed");
		});
	});

	describe("releasing a job", () => {
		it("should move a job from the processing queue to the available queue", async () => {
			await prepareJob(queue, db, "release", "available");
		});
	});

	describe("retrying a job", () => {
		it("should move a job from the failed queue to the available queue", async () => {
			await queue.flushAll();
			await prepareJob(queue, db, "fail", "failed");
			const failedJob = fetchLatest(db, queue.queueKey, "failed");
			if (!failedJob) {
				throw new Error("Job not found in queue");
			}
			await queue.retry(failedJob);
			const stillFailedJob = fetchLatest(db, queue.queueKey, "failed");
			const availableJob = fetchLatest(db, queue.queueKey, "available");
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
			const available = fetchLatest(db, queue.queueKey, "available");
			const processing = fetchLatest(db, queue.queueKey, "processing");
			const completed = fetchLatest(db, queue.queueKey, "completed");
			const failed = fetchLatest(db, queue.queueKey, "failed");
			assert.equal(available, null);
			assert.equal(processing, null);
			assert.equal(completed, null);
			assert.equal(failed, null);
		});
	});

	describe("hooks", () => {
		it("should allow the developer to add pre and post hooks to called actions", async () => {
			const queueKey = "another-example-sqlite-queue";
			let jobParam: Job | undefined;
			const hookQueue = new SQLiteQueue({
				queueKey,
				db,
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
		const queueKey = "another-example-sqlite-queue-count";
		const countQueue = new SQLiteQueue({ queueKey, db });

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
		it("should close the sqlite database", async () => {
			const anotherDb = createDb();
			SQLiteQueue.migrate(anotherDb);
			const anotherQueue = new SQLiteQueue({
				queueKey: "other-sqlite-queue",
				db: anotherDb,
			});
			await anotherQueue.disconnect();
			assert.throws(() => anotherDb.prepare("SELECT 1").get());
		});
	});
});
