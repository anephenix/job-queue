// Dependencies
const assert = require("assert");
const Queue = require("../../lib/Queue");
const redis = require("../redis.test.js");

describe("Queue", () => {
  let queue;
  let job;

  beforeAll(() => {
    const queueKey = "example-queue";
    queue = new Queue({ queueKey, redis });
    job = { name: "example-job" };
  });
  describe("creating an instance", () => {
    it("should set the redis client", () => {
      assert.deepEqual(redis, queue.redis);
    });
    it("should have a set of subQeueKeys for each list", () => {
      assert.deepEqual(queue.subQueueKeys, {
        available: `example-queue-available`,
        processing: `example-queue-processing`,
        completed: `example-queue-completed`,
        failed: `example-queue-failed`
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
  });
  describe("taking a job", () => {
    it("should move a job from the available queue to the processing queue", async () => {
      const fetchedJob = await queue.take();
      assert.deepEqual(job, fetchedJob);
      const redisJob = await redis.lindexAsync(
        queue.subQueueKeys.processing,
        -1
      );
      assert.deepEqual(JSON.parse(redisJob), fetchedJob);
    });
  });
  describe("completing a job", () => {
    it("should move a job from the processing queue to the completed queue", async () => {
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
  describe("failing a job", () => {
    it("should move a job from the processing queue to the failed queue", async () => {
      const anotherJob = { name: "Another example job" };
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
  describe("flushing all jobs", () => {
    it("should remove all jobs from all queues", async () => {
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
      const failed = await redis.lindexAsync(queue.subQueueKeys.failed, -1);
      assert.equal(available, null);
      assert.equal(processing, null);
      assert.equal(completed, null);
      assert.equal(failed, null);
    });
  });
});
