import { type Hooks, PostgresQueue } from "@anephenix/job-queue";
import pool from "./postgres.ts";
import { ensureContactsTable } from "./schema.ts";

// Creates the job_queue_jobs and imported_contacts tables if they don't
// already exist. Safe to call every time the process starts.
await PostgresQueue.migrate(pool);
await ensureContactsTable(pool);

type QueueOptions = {
	queueKey: string;
	pg: typeof pool;
	hooks: Partial<Hooks>;
};
const queueOptions: QueueOptions = {
	queueKey: "csv-import",
	pg: pool,
	hooks: {},
};
const csvImportQueue = new PostgresQueue(queueOptions);

export default csvImportQueue;
