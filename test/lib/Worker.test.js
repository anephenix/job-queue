// Dependencies
const assert = require('assert');
const Queue = require('../../lib/Queue');
const Worker = require('../../lib/Worker');
const redis = require('../redis.test.js');
const { before } = require('mocha');
const {
	delay,
	checkJobsMatch,
	incrementCallCountOrReturnJob,
} = require('../helpers/index.test');

describe('Worker', () => {
	let worker;
	let queue;

	before(async () => {
		const queueKey = 'example-queue';
		queue = new Queue({ queueKey, redis });
		worker = new Worker(queue);
	});

	describe('on initialising an instance', () => {
		it('should have a queue', () => {
			assert.deepEqual(worker.queue, queue);
		});

		it('should have a status of available', () => {
			assert.deepEqual(worker.status, 'available');
		});
	});

	describe('#start', () => {
		it('should get a job', async () => {
			let called = false;
			const anotherWorker = new Worker(queue);
			anotherWorker.getJob = () => (called = true);
			await anotherWorker.start();
			assert(called);
		});
	});

	describe('#stop', () => {
		it('should set the worker status to stopped', async () => {
			const anotherQueue = new Queue({
				queueKey: 'another-example',
				redis,
			});
			const anotherWorker = new Worker(anotherQueue);
			await anotherWorker.stop();
			assert.equal(anotherWorker.status, 'stopped');
		});
		it('should release the job, if called when processing a job, and prevent releaseJob from setting the worker status to available afterwards', async () => {
			const anotherQueue = new Queue({
				queueKey: 'another-test-example',
				redis,
			});
			const job = { name: 'a job I must take' };
			await anotherQueue.add(job);
			const anotherWorker = new Worker(anotherQueue);
			anotherWorker.processJob = async () => {};
			await anotherWorker.start();
			assert.equal(anotherWorker.status, 'available');
			await delay(500);
			await anotherWorker.stop();
			assert.equal(anotherWorker.status, 'stopped');
			const fetchedJob = await redis.lIndex(
				anotherQueue.subQueueKeys.available,
				-1
			);
			assert.deepEqual(JSON.parse(fetchedJob), job);
		});
	});

	describe('#getJob', () => {
		describe('if status is available', () => {
			it('should poll the queue for a job', async function () {
				this.timeout(5000);
				let callCount = 0;
				const anotherQueue = new Queue({
					queueKey: 'another-example',
					redis,
				});
				anotherQueue.take = async () => {
					callCount++;
					return null;
				};
				const anotherWorker = new Worker(anotherQueue);
				await anotherWorker.getJob();
				await delay(2000);
				assert.equal(callCount, 2);
				await anotherWorker.stop();
			});
			it('should stop polling that queue once it has a job', async function () {
				this.timeout(5000);
				let callCount = 0;
				let processJobCalled = false;
				const job = { name: 'Example job' };
				const anotherQueue = new Queue({
					queueKey: 'another-example',
					redis,
				});
				anotherQueue.take = async () => {
					if (callCount === 0) {
						callCount++;
						return null;
					} else {
						return job;
					}
				};
				const anotherWorker = new Worker(anotherQueue);
				anotherWorker.processJob = async () => {
					processJobCalled = true;
				};
				await anotherWorker.getJob();
				await delay(3000);
				assert.equal(callCount, 1);
				assert(processJobCalled);
			});
		});

		describe('if status is not available', () => {
			it('should just return without doing any polling', async () => {
				let callCount = 0;
				const anotherQueue = new Queue({
					queueKey: 'another-example',
					redis,
				});
				anotherQueue.take = async () => {
					callCount++;
					return null;
				};
				const anotherWorker = new Worker(anotherQueue);
				anotherWorker.status = 'processing';
				await anotherWorker.getJob();
				assert.equal(callCount, 0);
			});
		});

		describe('#processJob', () => {
			it('should set the status to processing', async () => {
				const anotherQueue = new Queue({
					queueKey: 'another-example',
					redis,
				});
				const job = { name: 'Example job' };
				await anotherQueue.add(job);
				const anotherWorker = new Worker(anotherQueue);
				anotherWorker.completeJob = () => {};
				await anotherWorker.start();
				assert.equal(anotherWorker.status, 'processing');
			});

			it('should set the currentJob value to that of the job', async () => {
				const anotherQueue = new Queue({
					queueKey: 'another-example-bam',
					redis,
				});
				const job = { name: 'Example job' };
				await anotherQueue.add(job);
				const anotherWorker = new Worker(anotherQueue);
				anotherWorker.completeJob = () => {};
				await anotherWorker.start();
				assert.deepEqual(anotherWorker.currentJob, job);
			});

			describe('if the job is processed fine', () => {
				it('should complete the job', async () => {
					const anotherQueue = new Queue({
						queueKey: 'another-example',
						redis,
					});
					const job = { name: 'Another example job to complete' };
					await anotherQueue.add(job);
					const anotherWorker = new Worker(anotherQueue);
					await anotherWorker.start();
					await delay(200);
					const fetchedJob = await redis.lIndex(
						anotherQueue.subQueueKeys.completed,
						-1
					);
					assert.deepEqual(JSON.parse(fetchedJob), job);
				});
			});

			describe('if an error occurs during processing', () => {
				it('should fail the job', async () => {
					const anotherQueue = new Queue({
						queueKey: 'another-example',
						redis,
					});
					const job = { name: 'A job to fail' };
					await anotherQueue.add(job);
					const anotherWorker = new Worker(anotherQueue);
					// Stub the function to fail the job
					anotherWorker.completeJob = async () => {
						throw new Error('Something');
					};
					await anotherWorker.start();
					await delay(500);
					const fetchedJob = await redis.lIndex(
						anotherQueue.subQueueKeys.failed,
						-1
					);
					assert.deepEqual(JSON.parse(fetchedJob), job);
				});
			});
		});

		describe('#completeJob', () => {
			let anotherQueue;
			let job;
			let anotherWorker;
			let callCount = 0;

			before(async () => {
				anotherQueue = new Queue({
					queueKey: 'another-example',
					redis,
				});
				job = { name: 'Another example job to complete' };
				await anotherQueue.add(job);
				anotherWorker = new Worker(anotherQueue);
				anotherWorker.queue.take = async () => {
					const { newCallCount, result } =
						incrementCallCountOrReturnJob(callCount, job);
					callCount = newCallCount;
					return result;
				};
				await anotherWorker.start();
				await delay(200);
			});

			it('should push the job to the completed queue', async () => {
				await checkJobsMatch(anotherQueue, job, 'completed');
			});
			it("should set the worker's status to available", async () => {
				assert.deepEqual(anotherWorker.status, 'available');
			});
			it('should then attempt to get another job', async () => {
				assert.equal(callCount, 2);
			});
			it('should unset the currentJob value', async () => {
				assert.equal(anotherWorker.currentJob, null);
			});
		});

		describe('#failJob', () => {
			let anotherQueue;
			let job;
			let anotherWorker;
			let callCount = 0;

			before(async () => {
				anotherQueue = new Queue({
					queueKey: 'another-example',
					redis,
				});
				job = { name: 'Another example job to complete' };
				await anotherQueue.add(job);
				anotherWorker = new Worker(anotherQueue);
				anotherWorker.queue.take = async () => {
					const { newCallCount, result } =
						incrementCallCountOrReturnJob(callCount, job);
					callCount = newCallCount;
					return result;
				};
				anotherWorker.completeJob = async () => {
					throw new Error('Something');
				};
				await anotherWorker.start();
				await delay(200);
			});

			it('should push the job to the failed queue', async () => {
				await checkJobsMatch(anotherQueue, job, 'failed');
			});
			it("should set the worker's status to available", async () => {
				assert.deepEqual(anotherWorker.status, 'available');
			});
			it('should then attempt to get another job', async () => {
				assert.equal(callCount, 2);
			});

			it('should unset the currentJob value', async () => {
				assert.equal(anotherWorker.currentJob, null);
			});
		});

		describe('#releaseJob', () => {
			let anotherQueue;
			let job;
			let anotherWorker;
			let callCount = 0;

			before(async () => {
				anotherQueue = new Queue({
					queueKey: 'another-example',
					redis,
				});
				job = { name: 'Another example job to complete' };
				await anotherQueue.add(job);
				anotherWorker = new Worker(anotherQueue);
				anotherWorker.queue.take = async () => {
					const { newCallCount, result } =
						incrementCallCountOrReturnJob(callCount, job);
					callCount = newCallCount;
					return result;
				};
				anotherWorker.processJob = async () => {};
				await anotherWorker.start();
				await anotherWorker.releaseJob(job);
				await delay(10);
			});

			it('should push the job to the available queue', async () => {
				await checkJobsMatch(anotherQueue, job, 'available');
			});
			it("should set the worker's status to available", async () => {
				assert.deepEqual(anotherWorker.status, 'available');
			});
			it('should then attempt to get another job', async () => {
				assert.equal(callCount, 2);
			});

			it('should unset the currentJob value', async () => {
				assert.equal(anotherWorker.currentJob, null);
			});
		});
	});
});
