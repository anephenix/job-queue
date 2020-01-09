### How the queue works behind the scenes

Job queue consists of 2 elements, queues and workers:

- Queues, essentially categorised lists of jobs that need processing.
- Workers, programs that process jobs on the queue.

Redis is used to store the data for the queues. Each queue consists of 4
lists in Redis. For example, say you have a queue named "email", in Redis
there will be 4 lists for that queue:

- email-available
- email-processing
- email-completed
- email-failed

A job that is added to the email queue will first be inserted into the
"email-available" list.

When a worker takes the job, the job is moved from the "email-available" list
into the "email-processing" list.

If the job is completed, the job is moved from the "email-processing" list to
the "email-completed" list.

If the job is failed, the job is moved from the "email-processing" list to
the "email-failed" list.
