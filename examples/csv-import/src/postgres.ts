// Dependencies
import { Pool, type PoolConfig } from "pg";

const poolConfig: PoolConfig = {
	host: process.env.POSTGRES_HOST || "localhost",
	port: process.env.POSTGRES_PORT
		? Number.parseInt(process.env.POSTGRES_PORT, 10)
		: 5432,
	user: process.env.POSTGRES_USER || "postgres",
	password: process.env.POSTGRES_PASSWORD || "postgres",
	database: process.env.POSTGRES_DB || "postgres",
};

const pool = new Pool(poolConfig);

export default pool;
