// Dependencies
import assert from "node:assert";
import { createClient, type RedisClientType } from "redis";
import { beforeAll, describe, it } from "vitest";
import { Queue } from "../../src/Queue";
import type { Job } from "../../src/types";
import { delayUntil } from "../helpers";
import { getClient } from "../redis";

const prepareJob = async (
	queue: Queue,
	firstAction: keyof Queue,
	subQueueKey: keyof Queue["subQueueKeys"],
): Promise<void> => {
	const anotherJob: Job = { name: "Another example job" };
	await queue.add(anotherJob);
	await queue.take();
	// const action = queue[firstAction];
	const action = queue[firstAction] as (this: Queue, job: Job) => Promise<void>;
	if (typeof action === "function") {
		await action.call(queue, anotherJob);
	} else {
		throw new Error(`queue[${String(firstAction)}] is not a function`);
	}
	const redis = getClient();

	const processingRedisJob = await redis.lIndex(
		queue.subQueueKeys.processing,
		-1,
	);
	const failedRedisJob = await redis.lIndex(
		queue.subQueueKeys[subQueueKey],
		-1,
	);
	if (!failedRedisJob) {
		throw new Error("Jobs not found in queue");
	}
	assert.equal(processingRedisJob, null);
	assert.deepEqual(JSON.parse(failedRedisJob), anotherJob);
};

describe("Queue", () => {
	let queue: Queue;
	let job: Job;
	const redis: RedisClientType = getClient();

	beforeAll(async () => {
		const queueKey = "example-queue";
		queue = new Queue({ queueKey, redis });
		job = { name: "example-job" };
	});

	describe("creating an instance", () => {
		it("should set the redis client", () => {
			assert.deepEqual(redis, queue.redis);
		});
		it("should have a set of subQueueKeys for each list", () => {
			assert.deepEqual(queue.subQueueKeys, {
				available: "example-queue-available",
				processing: "example-queue-processing",
				completed: "example-queue-completed",
				failed: "example-queue-failed",
			});
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
			const queueKey = "this-example-queue";
			const anotherQueue = new Queue({ queueKey, redis });
			const result = await anotherQueue.inspect();
			assert.equal(result, null);
		});
	});
	describe("taking a job", () => {
		it("should move a job from the available queue to the processing queue", async () => {
			const fetchedJob = await queue.take();
			assert.deepEqual(job, fetchedJob);
			const redisJob = await redis.lIndex(queue.subQueueKeys.processing, -1);
			if (!redisJob) {
				throw new Error("Job not found in queue");
			}
			assert.deepEqual(JSON.parse(redisJob), fetchedJob);
		});
	});
	describe("completing a job", () => {
		it("should move a job from the processing queue to the completed queue", async () => {
			const redisJob = await redis.lIndex(queue.subQueueKeys.processing, -1);
			if (!redisJob) {
				throw new Error("Job not found in queue");
			}
			const parsedJob = JSON.parse(redisJob);
			await queue.complete(parsedJob);
			const processingRedisJob = await redis.lIndex(
				queue.subQueueKeys.processing,
				-1,
			);
			const completedRedisJob = await redis.lIndex(
				queue.subQueueKeys.completed,
				-1,
			);
			if (!completedRedisJob) {
				throw new Error("completedRedisJob not found in queue");
			}
			assert.equal(processingRedisJob, null);
			assert.deepEqual(JSON.parse(completedRedisJob), parsedJob);
		});
	});
	describe("failing a job", () => {
		it("should move a job from the processing queue to the failed queue", async () => {
			await prepareJob(queue, "fail", "failed");
		});
	});
	describe("releasing a job", () => {
		it("should move a job from the processing queue to the available queue", async () => {
			await prepareJob(queue, "release", "available");
		});
	});

	describe("retrying a job", () => {
		it("should move a job from the failed queue to the available queue", async () => {
			await queue.flushAll();
			await prepareJob(queue, "fail", "failed");
			const redisJob = await redis.lIndex(queue.subQueueKeys.failed, -1);
			if (!redisJob) {
				throw new Error("Job not found in queue");
			}
			const parsedJob = JSON.parse(redisJob);
			await queue.retry(parsedJob);
			const failedRedisJob = await redis.lIndex(queue.subQueueKeys.failed, -1);
			const availableRedisJob = await redis.lIndex(
				queue.subQueueKeys.available,
				-1,
			);
			if (!availableRedisJob) {
				throw new Error("Jobs not found in queue");
			}
			assert.equal(failedRedisJob, null);
			assert.deepEqual(JSON.parse(availableRedisJob), parsedJob);
		});
	});

	describe("flushing all jobs", () => {
		it("should remove all jobs from all queues", async () => {
			await queue.flushAll();
			const available = await redis.lIndex(queue.subQueueKeys.available, -1);
			const processing = await redis.lIndex(queue.subQueueKeys.processing, -1);
			const completed = await redis.lIndex(queue.subQueueKeys.completed, -1);
			const failed = await redis.lIndex(queue.subQueueKeys.failed, -1);
			assert.equal(available, null);
			assert.equal(processing, null);
			assert.equal(completed, null);
			assert.equal(failed, null);
		});
	});
	describe("hooks", () => {
		it("should allow the developer to add pre and post hooks to called actions", async () => {
			const queueKey = "another-example-queue";
			let jobParam: Job | undefined;
			const queue = new Queue({
				queueKey,
				redis,
				hooks: {
					add: {
						pre: async (job) => {
							jobParam = job;
							return Promise.resolve();
						},
					},
				},
			});
			job = { name: "example-job" };
			await queue.add(job);
			assert.deepEqual(jobParam, job);
		});
	});

	describe("count", () => {
		const queueKey = "another-example-queue";
		const queue = new Queue({
			queueKey,
			redis,
		});

		beforeAll(async () => {
			await queue.flushAll();
			const initialCount = await queue.count("available");
			assert.equal(initialCount, 0);
			job = { name: "example-job" };
			await queue.add(job);
		});

		it("should return the number of jobs in a queue with a specific status", async () => {
			const updatedCount = await queue.count("available");
			assert.equal(updatedCount, 1);
		});
	});
	describe("counts", () => {
		it("should return the number of jobs in a queue, for each status", async () => {
			job = { name: "example-job" };
			await queue.add(job);
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
		it("should disconnect from the redis server", async () => {
			const anotherRedisConnection: RedisClientType = createClient();
			await anotherRedisConnection.connect();
			const checkIfClientIsReady = async () => anotherRedisConnection.isReady;
			await delayUntil(checkIfClientIsReady, 200);
			const anotherQueue = new Queue({
				queueKey: "other-queue",
				redis: anotherRedisConnection,
			});

			await anotherQueue.disconnect();
			assert.equal(anotherRedisConnection.isOpen, false);
		});
	});
});
