import { execFileSync, spawn } from "node:child_process";

const port = 3102;
const args = ["--filter", "@nexus/web", "exec", "vite", "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"];
const child = process.platform === "win32"
  ? spawn("cmd.exe", ["/d", "/s", "/c", `pnpm ${args.join(" ")}`], { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] })
  : spawn("pnpm", args, { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] });
let output = "";
child.stdout.on("data", (chunk) => { output += chunk; });
child.stderr.on("data", (chunk) => { output += chunk; });

async function waitForShell() {
  const url = `http://127.0.0.1:${port}/`;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch { /* retry while preview starts */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for web preview.\n${output}`);
}

try {
  const response = await waitForShell();
  const html = await response.text();
  if (!response.headers.get("content-type")?.includes("text/html") || !html.includes("<title>NEXUS 2040</title>") || !html.includes('<div id="root"></div>') || !/src="\/assets\/.+\.js"/.test(html)) {
    throw new Error("Web production shell contract failed.");
  }
  console.log("PASS: web production shell liveness verified.");
} finally {
  if (process.platform === "win32") { try { execFileSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" }); } catch { /* preview may have already exited after its successful response */ } }
  else child.kill();
}
