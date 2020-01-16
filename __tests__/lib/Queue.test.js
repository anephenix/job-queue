// Dependencies
const assert = require('assert');
const Queue = require('../../lib/Queue');
const redis = require('../redis.test.js');

describe('Queue', () => {
	let queue;
	let job;

	beforeAll(() => {
		const queueKey = 'example-queue';
		queue = new Queue({ queueKey, redis });
		job = { name: 'example-job' };
	});
	describe('creating an instance', () => {
		it('should set the redis client', () => {
			assert.deepEqual(redis, queue.redis);
		});
		it('should have a set of subQeueKeys for each list', () => {
			assert.deepEqual(queue.subQueueKeys, {
				available: `example-queue-available`,
				processing: `example-queue-processing`,
				completed: `example-queue-completed`,
				failed: `example-queue-failed`,
			});
		});
	});
	describe('adding a job', () => {
		it('should add a job to the available queue', async () => {
			await queue.add(job);
			const fetchedJob = await queue.inspect();
			assert.deepEqual(job, fetchedJob);
		});
	});

	describe('inspecting a job', () => {
		it('should return the latest job on the available queue', async () => {
			const fetchedJob = await queue.inspect();
			assert.deepEqual(job, fetchedJob);
		});

		it('should return null if there are no available jobs on the queue', async () => {
			const queueKey = 'this-example-queue';
			const anotherQueue = new Queue({ queueKey, redis });
			const result = await anotherQueue.inspect();
			assert.equal(result, null);
		});
	});
	describe('taking a job', () => {
		it('should move a job from the available queue to the processing queue', async () => {
			const fetchedJob = await queue.take();
			assert.deepEqual(job, fetchedJob);
			const redisJob = await redis.lindexAsync(
				queue.subQueueKeys.processing,
				-1
			);
			assert.deepEqual(JSON.parse(redisJob), fetchedJob);
		});
	});
	describe('completing a job', () => {
		it('should move a job from the processing queue to the completed queue', async () => {
			const redisJob = await redis.lindexAsync(
				queue.subQueueKeys.processing,
				-1
			);
			const parsedJob = JSON.parse(redisJob);
			await queue.complete(parsedJob);
			const processingRedisJob = await redis.lindexAsync(
				queue.subQueueKeys.processing,
				-1
			);
			const completedRedisJob = await redis.lindexAsync(
				queue.subQueueKeys.completed,
				-1
			);
			assert.equal(processingRedisJob, null);
			assert.deepEqual(JSON.parse(completedRedisJob), parsedJob);
		});
	});
	describe('failing a job', () => {
		it('should move a job from the processing queue to the failed queue', async () => {
			const anotherJob = { name: 'Another example job' };
			await queue.add(anotherJob);
			await queue.take();
			await queue.fail(anotherJob);

			const processingRedisJob = await redis.lindexAsync(
				queue.subQueueKeys.processing,
				-1
			);
			const failedRedisJob = await redis.lindexAsync(
				queue.subQueueKeys.failed,
				-1
			);
			assert.equal(processingRedisJob, null);
			assert.deepEqual(JSON.parse(failedRedisJob), anotherJob);
		});
	});
	describe('releasing a job', () => {
		it('should move a job from the processing queue to the available queue', async () => {
			const anotherJob = { name: 'Another example job' };
			await queue.add(anotherJob);
			await queue.take();
			await queue.release(anotherJob);

			const processingRedisJob = await redis.lindexAsync(
				queue.subQueueKeys.processing,
				-1
			);
			const releasedRedisJob = await redis.lindexAsync(
				queue.subQueueKeys.available,
				-1
			);
			assert.equal(processingRedisJob, null);
			assert.deepEqual(JSON.parse(releasedRedisJob), anotherJob);
		});
	});
	describe('flushing all jobs', () => {
		it('should remove all jobs from all queues', async () => {
			await queue.flushAll();
			const available = await redis.lindexAsync(
				queue.subQueueKeys.available,
				-1
			);
			const processing = await redis.lindexAsync(
				queue.subQueueKeys.processing,
				-1
			);
			const completed = await redis.lindexAsync(
				queue.subQueueKeys.completed,
				-1
			);
			const failed = await redis.lindexAsync(
				queue.subQueueKeys.failed,
				-1
			);
			assert.equal(available, null);
			assert.equal(processing, null);
			assert.equal(completed, null);
			assert.equal(failed, null);
		});
	});
	describe('hooks', () => {
		it('should allow the developer to add pre and post hooks to called actions', async () => {
			const queueKey = 'another-example-queue';
			let jobParam = null;
			const queue = new Queue({
				queueKey,
				redis,
				hooks: {
					add: {
						pre: async job => {
							jobParam = job;
							return job;
						},
					},
				},
			});
			job = { name: 'example-job' };
			await queue.add(job);
			assert.deepEqual(jobParam, job);
		});
	});
});
