// A local SQLite database file is used so that this example can be run
// without needing to install and run Redis or Postgres.
import Database from "better-sqlite3";

const db = new Database("./job-queue.db");

export default db;
