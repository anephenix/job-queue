# CHANGELOG

### 1.3.0 - Monday 1st June, 2020

-   Added the Queue.count and Queue.counts functions to list the number of jobs in a queue

### 1.2.0 - Monday 1st June, 2020

-   Added the Queue.retry function to retry failed jobs

### 1.1.0 - Wednesday 22nd January, 2020

-   Changed Worker.stop() so that it will call Worker.releaseJob() to support interrupting a worker during processing.

### 1.0.3 - Thursday 16th January, 2020

-   Added Worker.releaseJob(job) to support putting a job back on the queue when it is in the stage of processing.

### 1.0.2 - Thursday 16th January, 2020

-   Added Queue.release(job) to support putting a job back on the queue when it is in the stage of processing.

### 1.0.1 - Thursday 9th January, 2020

-   Added hooks for triggering functions during the job lifecycle

### 1.0.0 - Thursday 9th January, 2020

-   Initial version of the library
