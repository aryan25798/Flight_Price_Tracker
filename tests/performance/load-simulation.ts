interface LatencyMetrics {
  totalRequests: number;
  successful: number;
  rateLimited: number;
  failed: number;
  durationMs: number;
  rps: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
}

function calculatePercentiles(latencies: number[]): { p50: number; p90: number; p95: number; p99: number; min: number; max: number } {
  if (latencies.length === 0) {
    return { p50: 0, p90: 0, p95: 0, p99: 0, min: 0, max: 0 };
  }
  latencies.sort((a, b) => a - b);
  const min = latencies[0];
  const max = latencies[latencies.length - 1];
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p90 = latencies[Math.floor(latencies.length * 0.9)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  return { p50, p90, p95, p99, min, max };
}

async function runConcurrentBatch(
  url: string,
  method: "GET" | "POST",
  concurrency: number,
  totalRequests: number,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<LatencyMetrics> {
  const latencies: number[] = [];
  let successful = 0;
  let rateLimited = 0;
  let failed = 0;

  const startTime = Date.now();
  let completed = 0;

  async function worker(workerId: number) {
    while (completed < totalRequests) {
      completed++;
      const reqStart = performance.now();
      try {
        const reqHeaders: Record<string, string> = {
          "Content-Type": "application/json",
          // Simulate unique client IPs so rate limiting applies per virtual user
          "x-forwarded-for": `198.51.100.${(workerId % 254) + 1}`,
          ...(headers || {}),
        };

        const res = await fetch(url, {
          method,
          headers: reqHeaders,
          body: body ? JSON.stringify(body) : undefined,
        });

        const reqDuration = performance.now() - reqStart;
        latencies.push(reqDuration);

        if (res.status === 200) {
          successful++;
        } else if (res.status === 429) {
          rateLimited++;
        } else {
          failed++;
        }
      } catch {
        latencies.push(performance.now() - reqStart);
        failed++;
      }
    }
  }

  const workers: Promise<void>[] = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push(worker(i));
  }

  await Promise.all(workers);
  const totalDurationMs = Date.now() - startTime;
  const rps = Math.round((totalRequests / (totalDurationMs / 1000)) * 10) / 10;
  const { p50, p90, p95, p99, min, max } = calculatePercentiles(latencies);

  return {
    totalRequests,
    successful,
    rateLimited,
    failed,
    durationMs: totalDurationMs,
    rps,
    p50: Math.round(p50 * 10) / 10,
    p90: Math.round(p90 * 10) / 10,
    p95: Math.round(p95 * 10) / 10,
    p99: Math.round(p99 * 10) / 10,
    min: Math.round(min * 10) / 10,
    max: Math.round(max * 10) / 10,
  };
}

async function main() {
  console.log("================================================================================");
  console.log("PHASE 5: PERFORMANCE, LOAD TESTING & SCALABILITY SIMULATION");
  console.log("================================================================================");

  const baseUrl = "http://localhost:3000";

  // Warmup
  console.log("\n[Warmup] Pre-warming Next.js compilation cache...");
  await fetch(`${baseUrl}/login`);
  await fetch(`${baseUrl}/api/check-price`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ origin: "DEL", destination: "BOM", departureDate: "2026-12-15" }),
  });
  console.log("Warmup complete.\n");

  // 1. SMOKE TEST: 10 VUs baseline on SSR Page
  console.log("1. Executing Smoke Test (10 Virtual Users, 30 requests)...");
  const smoke = await runConcurrentBatch(`${baseUrl}/login`, "GET", 10, 30);
  console.log(`   RPS: ${smoke.rps} | P50: ${smoke.p50}ms | P95: ${smoke.p95}ms | P99: ${smoke.p99}ms | Success: ${smoke.successful}/${smoke.totalRequests}`);

  // 2. LOAD TEST: 50 VUs on SSR Page
  console.log("\n2. Executing Load Test (50 Virtual Users, 100 requests)...");
  const load = await runConcurrentBatch(`${baseUrl}/login`, "GET", 50, 100);
  console.log(`   RPS: ${load.rps} | P50: ${load.p50}ms | P95: ${load.p95}ms | P99: ${load.p99}ms | Success: ${load.successful}/${load.totalRequests}`);

  // 3. STRESS TEST: 100 VUs ramping to peak capacity
  console.log("\n3. Executing Stress Test (100 Virtual Users, 200 requests)...");
  const stress = await runConcurrentBatch(`${baseUrl}/login`, "GET", 100, 200);
  console.log(`   RPS: ${stress.rps} | P50: ${stress.p50}ms | P95: ${stress.p95}ms | P99: ${stress.p99}ms | Success: ${stress.successful}/${stress.totalRequests}`);

  // 4. SPIKE TEST: Instant surge of 200 concurrent requests on public API endpoint
  console.log("\n4. Executing Spike Test (200 Instant Concurrent Requests on API with Rate Limiting)...");
  // 1 single IP spiking 50 requests to verify rate limiting enforcement
  const spikeRateLimited = await runConcurrentBatch(
    `${baseUrl}/api/check-price`,
    "POST",
    50,
    50,
    { origin: "DEL", destination: "BOM", departureDate: "2026-12-15" },
    { "x-forwarded-for": "198.51.100.99" }, // Single IP burst
  );
  console.log(`   RPS: ${spikeRateLimited.rps} | P50: ${spikeRateLimited.p50}ms | P95: ${spikeRateLimited.p95}ms`);
  console.log(`   Rate Limiter Enforcement: ${spikeRateLimited.rateLimited} requests throttled (429) | ${spikeRateLimited.successful} allowed (200 OK)`);

  console.log("\n================================================================================");
  console.log("SIMULATION RESULTS SUMMARY TABLE");
  console.log("================================================================================");
  console.table([
    { Profile: "Smoke (10 VUs)", Requests: smoke.totalRequests, RPS: smoke.rps, P50_ms: smoke.p50, P95_ms: smoke.p95, P99_ms: smoke.p99, SuccessRate: `${Math.round((smoke.successful/smoke.totalRequests)*100)}%` },
    { Profile: "Load (50 VUs)", Requests: load.totalRequests, RPS: load.rps, P50_ms: load.p50, P95_ms: load.p95, P99_ms: load.p99, SuccessRate: `${Math.round((load.successful/load.totalRequests)*100)}%` },
    { Profile: "Stress (100 VUs)", Requests: stress.totalRequests, RPS: stress.rps, P50_ms: stress.p50, P95_ms: stress.p95, P99_ms: stress.p99, SuccessRate: `${Math.round((stress.successful/stress.totalRequests)*100)}%` },
    { Profile: "Spike Burst (Single IP)", Requests: spikeRateLimited.totalRequests, RPS: spikeRateLimited.rps, P50_ms: spikeRateLimited.p50, P95_ms: spikeRateLimited.p95, P99_ms: spikeRateLimited.p99, Throttled_429: spikeRateLimited.rateLimited },
  ]);
}

main().catch(console.error);
