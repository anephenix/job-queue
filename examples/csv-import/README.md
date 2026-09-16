# Example: CSV import into Postgres

This example shows how to use [`@anephenix/job-queue`](https://github.com/anephenix/job-queue)
to import a CSV file into Postgres in the background rather than blocking
a request while a (potentially large) file is parsed and inserted. It
uses the Postgres-backed `PostgresQueue`.

### How it works

-   `src/postgres.ts` creates a `pg` connection pool.
-   `src/schema.ts` creates the `imported_contacts` table that rows are
    imported into.
-   `src/queue.ts` creates a `PostgresQueue` called `csv-import`, and
    runs both table migrations on startup.
-   `src/worker.ts` defines a `Worker` subclass that streams the CSV file
    named in the job (rather than loading it fully into memory) and
    inserts its rows into `imported_contacts` in batches.
-   `src/add-job.ts` is a small CLI script that queues a CSV file for
    import.
-   `src/start-worker.ts` starts the worker, which polls the queue and
    processes jobs as they arrive.

The CSV is expected to have `name` and `email` columns — see
`sample/contacts.csv` for the format.

### Prerequisites

-   Node.js
-   Postgres running locally on the default port (5432), e.g.:

    ```shell
    docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres
    ```

    The example connects as user `postgres`, password `postgres`,
    database `postgres` by default — override with the `POSTGRES_HOST`,
    `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD` and
    `POSTGRES_DB` environment variables if needed.

### Setup

From this directory:

```shell
npm install
```

### Usage

1.  Queue the sample CSV for import:

    ```shell
    npm run add-job -- sample/contacts.csv
    ```

2.  In another terminal, start the worker to process queued jobs:

    ```shell
    npm run worker
    ```

The worker will pick up the job, stream and parse the file, and insert
its rows into the `imported_contacts` table. You can check the results
with `psql`:

```shell
psql postgresql://postgres:postgres@localhost:5432/postgres \
  -c "SELECT * FROM imported_contacts;"
```

Queue up as many CSV files as you like with `npm run add-job -- <path>`
— the worker will keep polling and process them one after another.
