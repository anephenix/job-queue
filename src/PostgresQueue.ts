import type { Pool } from "pg";
import { BaseQueue } from "./BaseQueue.js";
import type {
	Hooks,
	Job,
	JobQueue,
	PostgresQueueOptions,
	SubQueueKey,
} from "./types.ts";

const DEFAULT_TABLE_NAME = "job_queue_jobs";

// Table names are interpolated into raw SQL (identifiers can't be
// parameterized), so restrict them to a safe character set.
const VALID_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const assertValidTableName = (tableName: string): void => {
	if (!VALID_IDENTIFIER.test(tableName)) {
		throw new Error(`Invalid table name: ${tableName}`);
	}
};

class PostgresQueue extends BaseQueue implements JobQueue {
	pg: Pool;
	queueKey: string;
	tableName: string;

	constructor({ queueKey, pg, hooks, tableName }: PostgresQueueOptions) {
		super(hooks);
		this.pg = pg;
		this.queueKey = queueKey;
		this.tableName = tableName || DEFAULT_TABLE_NAME;
		assertValidTableName(this.tableName);
	}

	static async migrate(
		pg: Pool,
		tableName: string = DEFAULT_TABLE_NAME,
	): Promise<void> {
		assertValidTableName(tableName);
		await pg.query(`
			CREATE TABLE IF NOT EXISTS ${tableName} (
				id BIGSERIAL PRIMARY KEY,
				queue_key TEXT NOT NULL,
				name TEXT NOT NULL,
				data JSONB NOT NULL,
				status TEXT NOT NULL DEFAULT 'available',
				created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
			)
		`);
		await pg.query(`
			CREATE INDEX IF NOT EXISTS ${tableName}_queue_status_id_idx
				ON ${tableName} (queue_key, status, id)
		`);
	}

	async disconnect(): Promise<void> {
		await this.pg.end();
	}

	async add(job: Job): Promise<void> {
		await this.callHook("add", "pre", job);
		await this.pg.query(
			`INSERT INTO ${this.tableName} (queue_key, name, data, status)
			 VALUES ($1, $2, $3::jsonb, 'available')`,
			[this.queueKey, job.name, JSON.stringify(job)],
		);
		return await this.callHook("add", "post", job);
	}

	async inspect(keyType: SubQueueKey = "available"): Promise<Job | null> {
		const result = await this.pg.query(
			`SELECT data FROM ${this.tableName}
			 WHERE queue_key = $1 AND status = $2
			 ORDER BY id DESC
			 LIMIT 1`,
			[this.queueKey, keyType],
		);
		if (result.rowCount === 0) return null;
		return result.rows[0].data;
	}

	async count(keyType: SubQueueKey): Promise<number> {
		const result = await this.pg.query(
			`SELECT COUNT(*) FROM ${this.tableName}
			 WHERE queue_key = $1 AND status = $2`,
			[this.queueKey, keyType],
		);
		return Number.parseInt(result.rows[0].count, 10);
	}

	async counts(): Promise<{ [key: string]: number }> {
		const [available, processing, failed, completed] = await Promise.all([
			this.count("available"),
			this.count("processing"),
			this.count("failed"),
			this.count("completed"),
		]);
		return {
			available,
			processing,
			failed,
			completed,
		};
	}

	async take(): Promise<Job | null> {
		await this.callHook("take", "pre");
		const result = await this.pg.query(
			`UPDATE ${this.tableName}
			 SET status = 'processing', updated_at = now()
			 WHERE id = (
				SELECT id FROM ${this.tableName}
				WHERE queue_key = $1 AND status = 'available'
				ORDER BY id ASC
				FOR UPDATE SKIP LOCKED
				LIMIT 1
			 )
			 RETURNING data`,
			[this.queueKey],
		);
		if (result.rowCount === 0) {
			await this.callHook("take", "post");
			return null;
		}
		const job = result.rows[0].data;
		await this.callHook("take", "post", job);
		return job;
	}

	private async conclude(
		job: Job,
		callHookAction: keyof Hooks,
		toStatus: SubQueueKey,
		fromStatus: SubQueueKey = "processing",
	): Promise<void> {
		await this.callHook(callHookAction, "pre", job);
		await this.pg.query(
			`UPDATE ${this.tableName}
			 SET status = $1, updated_at = now()
			 WHERE id = (
				SELECT id FROM ${this.tableName}
				WHERE queue_key = $2 AND status = $3 AND data = $4::jsonb
				ORDER BY id ASC
				LIMIT 1
			 )`,
			[toStatus, this.queueKey, fromStatus, JSON.stringify(job)],
		);
		return await this.callHook(callHookAction, "post", job);
	}

	async complete(job: Job): Promise<void> {
		return await this.conclude(job, "complete", "completed");
	}

	async fail(job: Job): Promise<void> {
		return await this.conclude(job, "fail", "failed");
	}

	async release(job: Job): Promise<void> {
		return await this.conclude(job, "release", "available");
	}

	async retry(job: Job): Promise<void> {
		return await this.conclude(job, "retry", "available", "failed");
	}

	async flushAll(): Promise<void> {
		await this.callHook("flushAll", "pre");
		await this.pg.query(`DELETE FROM ${this.tableName} WHERE queue_key = $1`, [
			this.queueKey,
		]);
		await this.callHook("flushAll", "post");
	}
}

export { PostgresQueue };
