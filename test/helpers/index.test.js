const delay = (duration) =>
	new Promise((resolve) => setTimeout(resolve, duration));
const redis = require('../redis.test.js');
const assert = require('assert');

const checkJobsMatch = async (queue, job, subQueueKey) => {
	const fetchedJob = await redis.lIndex(queue.subQueueKeys[subQueueKey], -1);
	assert.deepEqual(JSON.parse(fetchedJob), job);
};

const incrementCallCountOrReturnJob = (callCount, job) => {
	if (callCount === 0) {
		callCount++;
		return {
			newCallCount: callCount,
			result: job,
		};
	} else {
		callCount++;
		return {
			newCallCount: callCount,
			result: null,
		};
	}
};

module.exports = { delay, checkJobsMatch, incrementCallCountOrReturnJob };
