import { getClient } from '../redis';
import assert from 'assert';

// Types and Interfaces
interface Queue {
	subQueueKeys: { [key: string]: string };
}

interface IncrementCallCountResult {
	newCallCount: number;
	result: any;
}

// Helper functions
const delay = (duration: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, duration));

const delayUntil = async (
	condition: () => Promise<boolean>,
	timeout: number
): Promise<void> => {
	const conditionMet = await condition();
	if (conditionMet) {
		return;
	} else {
		await delay(timeout);
		await delayUntil(condition, timeout);
	}
};

const checkJobsMatch = async (
	queue: Queue,
	job: any,
	subQueueKey: string
): Promise<void> => {
	const redis = getClient();
	const fetchedJob = await redis.lIndex(queue.subQueueKeys[subQueueKey], -1);
	if (!fetchedJob) {
		throw new Error('Job not found in queue');
	}
	assert.deepEqual(JSON.parse(fetchedJob), job);
};

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

export { delay, delayUntil, checkJobsMatch, incrementCallCountOrReturnJob };
