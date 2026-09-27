import { type Hooks, SQLiteQueue } from "@anephenix/job-queue";
import db from "./sqlite.ts";

// Creates the job_queue_jobs table if it doesn't already exist.
// Safe to call every time the process starts.
SQLiteQueue.migrate(db);

type QueueOptions = { queueKey: string; db: typeof db; hooks: Partial<Hooks> };
const queueOptions: QueueOptions = {
	queueKey: "pdf-report-generation",
	db,
	hooks: {},
};
const reportQueue = new SQLiteQueue(queueOptions);

export default reportQueue;
