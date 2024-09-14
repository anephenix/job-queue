const delay = (duration: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, duration));
import redis from '../redis.test';
import assert from 'assert';

interface Queue {
	subQueueKeys: { [key: string]: string };
}

const checkJobsMatch = async (
	queue: Queue,
	job: any,
	subQueueKey: string
): Promise<void> => {
	const fetchedJob = await redis.lIndex(queue.subQueueKeys[subQueueKey], -1);
	if (!fetchedJob) {
		throw new Error('Job not found in queue');
	}
	assert.deepEqual(JSON.parse(fetchedJob), job);
};

interface IncrementCallCountResult {
	newCallCount: number;
	result: any;
}

const incrementCallCountOrReturnJob = (
	callCount: number,
	job: any
): IncrementCallCountResult => {
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

export { delay, checkJobsMatch, incrementCallCountOrReturnJob };
