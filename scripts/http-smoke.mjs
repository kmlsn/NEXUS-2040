import { execFileSync, spawn } from "node:child_process";

function start(filter, port) {
  const command = `pnpm --filter ${filter} exec tsx src/main.ts`;
  const child = process.platform === "win32" ? spawn("cmd.exe", ["/d", "/s", "/c", command], { cwd: process.cwd(), env: { ...process.env, [filter === "@nexus/api" ? "API_PORT" : "WORKER_PORT"]: String(port) }, stdio: ["ignore", "pipe", "pipe"] }) : spawn("pnpm", ["--filter", filter, "exec", "tsx", "src/main.ts"], { cwd: process.cwd(), env: { ...process.env, [filter === "@nexus/api" ? "API_PORT" : "WORKER_PORT"]: String(port) }, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; }); child.stderr.on("data", (chunk) => { output += chunk; });
  return { child, output: () => output };
}
async function waitFor(url, processOutput) { for (let attempt = 0; attempt < 100; attempt += 1) { try { const response = await fetch(url); if (response.ok) return; } catch { /* retry */ } await new Promise((resolve) => setTimeout(resolve, 200)); } throw new Error(`Timed out: ${url}\n${processOutput()}`); }
const api = start("@nexus/api", 3100); const worker = start("@nexus/worker", 3101);
try {
  await waitFor("http://127.0.0.1:3100/health", api.output); await waitFor("http://127.0.0.1:3101/health", worker.output);
  const health = await fetch("http://127.0.0.1:3100/health", { headers: { "x-request-id": "safe_test_01" } }); const body = await health.json();
  if (health.status !== 200 || body.status !== "ok" || body.service !== "api" || health.headers.get("cache-control") !== "no-store" || health.headers.get("x-request-id") !== "safe_test_01") throw new Error("API health contract failed.");
  const missing = await fetch("http://127.0.0.1:3101/missing"); const error = await missing.json(); const requestId = missing.headers.get("x-request-id");
  const apiMissing = await fetch("http://127.0.0.1:3100/missing"); const apiError = await apiMissing.json();
  const centerWithoutConfiguredProfile = await fetch("http://127.0.0.1:3100/v1/center"); const centerError = await centerWithoutConfiguredProfile.json();
  const workerHealth = await fetch("http://127.0.0.1:3101/health"); const workerBody = await workerHealth.json();
  const malformed = await fetch("http://127.0.0.1:3100/health", { headers: { "x-request-id": "x".repeat(65) } });
  const parallel = await Promise.all([fetch("http://127.0.0.1:3100/health"), fetch("http://127.0.0.1:3100/health")]);
  if (missing.status !== 404 || error.error?.code !== "NOT_FOUND" || error.error?.requestId !== requestId || apiMissing.status !== 404 || apiError.error?.requestId !== apiMissing.headers.get("x-request-id") || centerWithoutConfiguredProfile.status !== 404 || centerError.error?.code !== "NOT_FOUND" || centerError.error?.requestId !== centerWithoutConfiguredProfile.headers.get("x-request-id") || workerHealth.status !== 200 || workerBody.service !== "worker" || workerHealth.headers.get("cache-control") !== "no-store" || malformed.headers.get("x-request-id")?.length !== 36 || parallel[0].headers.get("x-request-id") === parallel[1].headers.get("x-request-id") || /stack|postgres|redis/i.test(JSON.stringify([error, apiError, centerError]))) throw new Error("Public HTTP contract failed.");
  await new Promise((resolve) => setTimeout(resolve, 100)); if (!api.output().includes('"requestId":"safe_test_01"') || !api.output().includes('"service":"api"') || !worker.output().includes('"service":"worker"') || !worker.output().includes(`"requestId":"${requestId}"`)) throw new Error("Structured correlation log missing.");
  console.log("PASS: API/worker health, request correlation, public errors, and structured logs verified.");
} finally { for (const child of [api.child, worker.child]) { if (process.platform === "win32") execFileSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" }); else child.kill(); } }
