// Dependencies
import Database from "better-sqlite3";

let db: Database.Database | null = null;

const getDb = (): Database.Database => {
	if (!db) {
		db = new Database(":memory:");
	}
	return db;
};

const createDb = (): Database.Database => new Database(":memory:");

export { createDb, getDb };
