// Dependencies
const assert = require("assert");
const Queue = require("../../lib/Queue");
const Worker = require("../../lib/Worker");
const redis = require("../redis.test.js");

// Helper function
const delay = duration => new Promise(resolve => setTimeout(resolve, duration));

describe("Worker", () => {
	let worker;
	let queue;

	beforeAll(() => {
		const queueKey = "example-queue";
		queue = new Queue({ queueKey, redis });
		worker = new Worker(queue);
	});

	describe("on initialising an instance", () => {
		it("should have a queue", () => {
			assert.deepEqual(worker.queue, queue);
		});

		it("should have a status of available", () => {
			assert.deepEqual(worker.status, "available");
		});
	});

	describe("#start", () => {
		it("should get a job", async () => {
			let called = false;
			const anotherWorker = new Worker(queue);
			anotherWorker.getJob = () => (called = true);
			await anotherWorker.start();
			assert(called);
		});
	});

	describe("#getJob", () => {
		describe("if status is available", () => {
			it("should poll the queue for a job", async () => {
				let callCount = 0;
				const anotherQueue = new Queue({
					queueKey: "another-example",
					redis
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
			it("should stop polling that queue once it has a job", async () => {
				let callCount = 0;
				let processJobCalled = false;
				const job = { name: "Example job" };
				const anotherQueue = new Queue({
					queueKey: "another-example",
					redis
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

		describe("if status is not available", () => {
			it("should just return without doing any polling", async () => {
				let callCount = 0;
				const anotherQueue = new Queue({
					queueKey: "another-example",
					redis
				});
				anotherQueue.take = async () => {
					callCount++;
					return null;
				};
				const anotherWorker = new Worker(anotherQueue);
				anotherWorker.status = "processing";
				await anotherWorker.getJob();
				assert.equal(callCount, 0);
			});
		});

		describe("#processJob", () => {
			it("should set the status to processing", async () => {
				const anotherQueue = new Queue({
					queueKey: "another-example",
					redis
				});
				const job = { name: "Example job" };
				await anotherQueue.add(job);
				const anotherWorker = new Worker(anotherQueue);
				anotherWorker.completeJob = () => {};
				await anotherWorker.start();
				assert.equal(anotherWorker.status, "processing");
			});

			describe("if the job is processed fine", () => {
				it("should complete the job", async () => {
					const anotherQueue = new Queue({
						queueKey: "another-example",
						redis
					});
					const job = { name: "Another example job to complete" };
					await anotherQueue.add(job);
					const anotherWorker = new Worker(anotherQueue);
					await anotherWorker.start();
					await delay(200);
					const fetchedJob = await redis.lindexAsync(
						anotherQueue.subQueueKeys.completed,
						-1
					);
					assert.deepEqual(JSON.parse(fetchedJob), job);
				});
			});

			describe("if an error occurs during processing", () => {
				it("should fail the job", async () => {
					const anotherQueue = new Queue({
						queueKey: "another-example",
						redis
					});
					const job = { name: "A job to fail" };
					await anotherQueue.add(job);
					const anotherWorker = new Worker(anotherQueue);
					// Stub the function to fail the job
					anotherWorker.completeJob = async () => {
						throw new Error("Something");
					};
					await anotherWorker.start();
					await delay(500);
					const fetchedJob = await redis.lindexAsync(
						anotherQueue.subQueueKeys.failed,
						-1
					);
					assert.deepEqual(JSON.parse(fetchedJob), job);
				});
			});
		});

		describe("#completeJob", () => {
			let anotherQueue;
			let job;
			let anotherWorker;
			let callCount = 0;

			beforeAll(async () => {
				anotherQueue = new Queue({
					queueKey: "another-example",
					redis
				});
				job = { name: "Another example job to complete" };
				await anotherQueue.add(job);
				anotherWorker = new Worker(anotherQueue);
				anotherWorker.queue.take = async () => {
					if (callCount === 0) {
						callCount++;
						return job;
					} else {
						callCount++;
						return null;
					}
				};
				await anotherWorker.start();
				await delay(200);
			});

			it("should push the job to the completed queue", async () => {
				const fetchedJob = await redis.lindexAsync(
					anotherQueue.subQueueKeys.completed,
					-1
				);
				assert.deepEqual(JSON.parse(fetchedJob), job);
			});
			it("should set the worker's status to available", async () => {
				assert.deepEqual(anotherWorker.status, "available");
			});
			it("should then attempt to get another job", async () => {
				assert.equal(callCount, 2);
			});
		});

		describe("#failJob", () => {
			let anotherQueue;
			let job;
			let anotherWorker;
			let callCount = 0;

			beforeAll(async () => {
				anotherQueue = new Queue({
					queueKey: "another-example",
					redis
				});
				job = { name: "Another example job to complete" };
				await anotherQueue.add(job);
				anotherWorker = new Worker(anotherQueue);
				anotherWorker.queue.take = async () => {
					if (callCount === 0) {
						callCount++;
						return job;
					} else {
						callCount++;
						return null;
					}
				};
				anotherWorker.completeJob = async () => {
					throw new Error("Something");
				};
				await anotherWorker.start();
				await delay(200);
			});

			it("should push the job to the failed queue", async () => {
				const fetchedJob = await redis.lindexAsync(
					anotherQueue.subQueueKeys.failed,
					-1
				);
				assert.deepEqual(JSON.parse(fetchedJob), job);
			});
			it("should set the worker's status to available", async () => {
				assert.deepEqual(anotherWorker.status, "available");
			});
			it("should then attempt to get another job", async () => {
				assert.equal(callCount, 2);
			});
		});
	});
});
