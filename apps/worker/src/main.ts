import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { NestFactory } from "@nestjs/core";
import { WorkerModule } from "./index";
import { PublicErrorFilter } from "./http";

const app = await NestFactory.create(WorkerModule, { logger: false });
app.useGlobalFilters(new PublicErrorFilter());
app.use((request: { method: string; url: string }, response: { setHeader(name: string, value: string): void; on(event: string, listener: () => void): void; statusCode: number }, next: () => void) => {
  const requestId = randomUUID();
  const started = Date.now();
  response.setHeader("X-Request-Id", requestId);
  response.setHeader("Cache-Control", "no-store");
  response.on("finish", () => console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: "info", service: "worker", event: "http_request", requestId, method: request.method, route: request.url.split("?")[0], statusCode: response.statusCode, durationMs: Date.now() - started })));
  next();
});
await app.listen(Number(process.env.WORKER_PORT ?? 3001));
