const { performance } = require('node:perf_hooks');

function readOptions(args) {
  const options = {
    url: 'http://127.0.0.1:3001',
    duration: 10,
    concurrency: 20,
    maxP95: 2000,
  };

  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    const value = args[index + 1];
    if (!value || !key.startsWith('--')) throw new Error(`Invalid option: ${key}`);
    if (key === '--url') options.url = value;
    else if (key === '--duration') options.duration = Number(value);
    else if (key === '--concurrency') options.concurrency = Number(value);
    else if (key === '--max-p95-ms') options.maxP95 = Number(value);
    else throw new Error(`Unknown option: ${key}`);
    index += 1;
  }

  const url = new URL(options.url);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('--url must use HTTP or HTTPS');
  if (!Number.isInteger(options.duration) || options.duration < 1 || options.duration > 3600) {
    throw new Error('--duration must be an integer between 1 and 3600 seconds');
  }
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 500) {
    throw new Error('--concurrency must be an integer between 1 and 500');
  }
  if (!Number.isFinite(options.maxP95) || options.maxP95 <= 0) {
    throw new Error('--max-p95-ms must be a positive number');
  }

  return { ...options, baseUrl: url };
}

async function run() {
  const options = readOptions(process.argv.slice(2));
  const requests = [];
  const failureSamples = [];
  const deadline = performance.now() + options.duration * 1000;
  let completed = 0;
  let failureCount = 0;
  const started = performance.now();

  function recordFailure(message) {
    failureCount += 1;
    if (failureSamples.length < 5) failureSamples.push(message);
  }

  async function worker(workerId) {
    while (performance.now() < deadline) {
      const target = workerId % 2 === 0 ? '/healthz' : '/';
      const requestStarted = performance.now();
      try {
        const response = await fetch(new URL(target, options.baseUrl), {
          signal: AbortSignal.timeout(10_000),
        });
        await response.arrayBuffer();
        const elapsed = performance.now() - requestStarted;
        if (!response.ok) {
          recordFailure(`${target} returned HTTP ${response.status}`);
        } else {
          requests.push(elapsed);
        }
      } catch (error) {
        recordFailure(`${target}: ${error.message}`);
      }
      completed += 1;
    }
  }

  await Promise.all(Array.from({ length: options.concurrency }, (_, workerId) => worker(workerId)));
  const elapsedSeconds = (performance.now() - started) / 1000;
  requests.sort((left, right) => left - right);
  const percentile = (fraction) => requests.length
    ? requests[Math.min(Math.ceil(requests.length * fraction) - 1, requests.length - 1)]
    : Number.NaN;
  const p95 = percentile(0.95);

  console.log(`Target: ${options.baseUrl.origin}`);
  console.log(`Duration: ${elapsedSeconds.toFixed(1)}s | concurrency: ${options.concurrency}`);
  console.log(`Requests: ${completed} | successful: ${requests.length} | failed: ${failureCount}`);
  console.log(`Throughput: ${(completed / elapsedSeconds).toFixed(1)} requests/s`);
  if (requests.length) {
    console.log(
      `Latency: p50 ${percentile(0.50).toFixed(1)}ms | p95 ${p95.toFixed(1)}ms | p99 ${percentile(0.99).toFixed(1)}ms`,
    );
  }
  if (failureSamples.length) {
    console.error(`Sample failures: ${failureSamples.join('; ')}`);
  }
  if (failureCount || !requests.length || p95 > options.maxP95) {
    console.error(`Stress test failed (p95 limit: ${options.maxP95}ms).`);
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
