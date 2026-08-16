import type { Database } from "better-sqlite3";
import { BaseQueue } from "./BaseQueue.js";
import type {
	Hooks,
	Job,
	JobQueue,
	SQLiteQueueOptions,
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

class SQLiteQueue extends BaseQueue implements JobQueue {
	db: Database;
	queueKey: string;
	tableName: string;

	constructor({ queueKey, db, hooks, tableName }: SQLiteQueueOptions) {
		super(hooks);
		this.db = db;
		this.queueKey = queueKey;
		this.tableName = tableName || DEFAULT_TABLE_NAME;
		assertValidTableName(this.tableName);

		// WAL mode allows other processes with a handle on the same file to
		// read and write concurrently; busy_timeout makes a writer wait for
		// a lock instead of throwing SQLITE_BUSY immediately.
		this.db.pragma("journal_mode = WAL");
		this.db.pragma("busy_timeout = 5000");
	}

	static migrate(db: Database, tableName: string = DEFAULT_TABLE_NAME): void {
		assertValidTableName(tableName);
		db.exec(`
			CREATE TABLE IF NOT EXISTS ${tableName} (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				queue_key TEXT NOT NULL,
				name TEXT NOT NULL,
				data TEXT NOT NULL,
				status TEXT NOT NULL DEFAULT 'available',
				created_at INTEGER NOT NULL DEFAULT (unixepoch('subsec') * 1000),
				updated_at INTEGER NOT NULL DEFAULT (unixepoch('subsec') * 1000)
			)
		`);
		db.exec(`
			CREATE INDEX IF NOT EXISTS ${tableName}_queue_status_id_idx
				ON ${tableName} (queue_key, status, id)
		`);
	}

	async disconnect(): Promise<void> {
		this.db.close();
	}

	async add(job: Job): Promise<void> {
		await this.callHook("add", "pre", job);
		this.db
			.prepare(
				`INSERT INTO ${this.tableName} (queue_key, name, data, status)
				 VALUES (?, ?, ?, 'available')`,
			)
			.run(this.queueKey, job.name, JSON.stringify(job));
		return await this.callHook("add", "post", job);
	}

	async inspect(keyType: SubQueueKey = "available"): Promise<Job | null> {
		const row = this.db
			.prepare(
				`SELECT data FROM ${this.tableName}
				 WHERE queue_key = ? AND status = ?
				 ORDER BY id DESC
				 LIMIT 1`,
			)
			.get(this.queueKey, keyType) as { data: string } | undefined;
		return row ? JSON.parse(row.data) : null;
	}

	async count(keyType: SubQueueKey): Promise<number> {
		const row = this.db
			.prepare(
				`SELECT COUNT(*) AS count FROM ${this.tableName}
				 WHERE queue_key = ? AND status = ?`,
			)
			.get(this.queueKey, keyType) as { count: number };
		return row.count;
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

	// Postgres uses FOR UPDATE SKIP LOCKED so several workers can each claim
	// a different row at the same time. SQLite only ever allows one writer,
	// so BEGIN IMMEDIATE achieves the same outcome (no two workers ever get
	// the same job) by serializing claims rather than skipping locked rows.
	async take(): Promise<Job | null> {
		await this.callHook("take", "pre");
		const claim = this.db.transaction(() => {
			const row = this.db
				.prepare(
					`SELECT id, data FROM ${this.tableName}
					 WHERE queue_key = ? AND status = 'available'
					 ORDER BY id ASC
					 LIMIT 1`,
				)
				.get(this.queueKey) as { id: number; data: string } | undefined;
			if (!row) return null;
			this.db
				.prepare(
					`UPDATE ${this.tableName}
					 SET status = 'processing', updated_at = unixepoch('subsec') * 1000
					 WHERE id = ?`,
				)
				.run(row.id);
			return JSON.parse(row.data) as Job;
		});
		const job = claim.immediate();
		await this.callHook("take", "post", job ?? undefined);
		return job;
	}

	private async conclude(
		job: Job,
		callHookAction: keyof Hooks,
		toStatus: SubQueueKey,
		fromStatus: SubQueueKey = "processing",
	): Promise<void> {
		await this.callHook(callHookAction, "pre", job);
		this.db
			.prepare(
				`UPDATE ${this.tableName}
				 SET status = ?, updated_at = unixepoch('subsec') * 1000
				 WHERE id = (
					SELECT id FROM ${this.tableName}
					WHERE queue_key = ? AND status = ? AND data = ?
					ORDER BY id ASC
					LIMIT 1
				 )`,
			)
			.run(toStatus, this.queueKey, fromStatus, JSON.stringify(job));
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
		this.db
			.prepare(`DELETE FROM ${this.tableName} WHERE queue_key = ?`)
			.run(this.queueKey);
		await this.callHook("flushAll", "post");
	}
}

export { SQLiteQueue };
