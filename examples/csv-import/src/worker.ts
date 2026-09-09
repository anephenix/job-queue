import { createReadStream } from "node:fs";
import { type Job, Worker } from "@anephenix/job-queue";
import { parse } from "csv-parse";
import pool from "./postgres.ts";
import csvImportQueue from "./queue.ts";

type CSVImportJob = Job & {
	data: {
		filePath: string;
	};
};

type ContactRow = { name: string; email: string };

// Rows are inserted in batches rather than one at a time, so importing a
// large CSV doesn't mean a round trip to Postgres per row.
const BATCH_SIZE = 500;

async function insertBatch(rows: ContactRow[]): Promise<void> {
	if (rows.length === 0) return;
	const values: string[] = [];
	const params: string[] = [];
	rows.forEach((row, index) => {
		const offset = index * 2;
		values.push(`($${offset + 1}, $${offset + 2})`);
		params.push(row.name, row.email);
	});
	await pool.query(
		`INSERT INTO imported_contacts (name, email) VALUES ${values.join(", ")}`,
		params,
	);
}

class CSVImportWorker extends Worker {
	async processJob(job: Job): Promise<void> {
		this.status = "processing";
		const { filePath } = (job as CSVImportJob).data;

		try {
			// Streamed rather than read fully into memory first, so this
			// scales to CSV files much larger than available RAM.
			const parser = createReadStream(filePath).pipe(
				parse({ columns: true, trim: true }),
			);

			let batch: ContactRow[] = [];
			let total = 0;

			for await (const record of parser as AsyncIterable<
				Record<string, string>
			>) {
				batch.push({ name: record.name, email: record.email });
				if (batch.length >= BATCH_SIZE) {
					await insertBatch(batch);
					total += batch.length;
					batch = [];
				}
			}
			await insertBatch(batch);
			total += batch.length;

			console.log(`Imported ${total} rows from ${filePath}`);
			await this.completeJob(job);
		} catch (err) {
			console.error(`Error importing ${filePath}:`, err);
			await this.failJob(job);
		}
	}
}

const csvImportWorker = new CSVImportWorker(csvImportQueue);

export default csvImportWorker;
