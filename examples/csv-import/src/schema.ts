import type { Pool } from "pg";

// The table that imported CSV rows are written into. Separate from the
// job_queue_jobs table that PostgresQueue.migrate() creates.
async function ensureContactsTable(pool: Pool): Promise<void> {
	await pool.query(`
		CREATE TABLE IF NOT EXISTS imported_contacts (
			id BIGSERIAL PRIMARY KEY,
			name TEXT NOT NULL,
			email TEXT NOT NULL,
			imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`);
}

export { ensureContactsTable };
