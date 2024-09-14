import { Job } from './types';

interface Queue {
	take(): Promise<Job | null>;
	complete(job: Job): Promise<void>;
	fail(job: Job): Promise<void>;
	release(job: Job): Promise<void>;
}

class Worker {
	queue: Queue;
	status: 'available' | 'processing' | 'stopped';
	pollTimeout: number;
	currentJob: Job | null;

	constructor(queue: Queue) {
		this.queue = queue;
		this.status = 'available';
		this.pollTimeout = 1000;
		this.currentJob = null;
	}

	async start(): Promise<void> {
		return await this.getJob();
	}

	async stop(): Promise<void> {
		this.status = 'stopped';
		if (this.currentJob) {
			const skipSettingStatus = true;
			await this.releaseJob(this.currentJob, skipSettingStatus);
		}
	}

	async getJob(): Promise<void> {
		if (this.status === 'available') {
			const job = await this.queue.take();
			if (job) {
				this.currentJob = job;
				await this.processJob(job);
			} else {
				setTimeout(async () => {
					await this.getJob();
				}, this.pollTimeout);
			}
		}
	}

	async processJob(job: Job): Promise<void> {
		this.status = 'processing';
		try {
			await this.completeJob(job);
		} catch (error) {
			// TODO - find a way to bind the error to the job, but to be fair this function gets overridden anyway I think
			await this.failJob(job);
		}
	}

	async concludeJob(
		job: Job,
		queueCommand: keyof Queue,
		skipSettingStatus?: boolean
	): Promise<void> {
		this.currentJob = null;
		await this.queue[queueCommand](job);
		if (!skipSettingStatus) this.status = 'available';
		await this.getJob();
	}

	async completeJob(job: Job, skipSettingStatus?: boolean): Promise<void> {
		return await this.concludeJob(job, 'complete', skipSettingStatus);
	}

	async failJob(job: Job, skipSettingStatus?: boolean): Promise<void> {
		return await this.concludeJob(job, 'fail', skipSettingStatus);
	}

	async releaseJob(job: Job, skipSettingStatus?: boolean): Promise<void> {
		return await this.concludeJob(job, 'release', skipSettingStatus);
	}
}

export default Worker;
