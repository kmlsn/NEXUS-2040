import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ApiModule } from "./index";
import { randomUUID } from "node:crypto";
import { PublicErrorFilter } from "./http";

const app = await NestFactory.create(ApiModule, { logger: false });
app.useGlobalFilters(new PublicErrorFilter());
app.use((request: { headers: Record<string, unknown>; method: string; url: string }, response: { setHeader(name: string, value: string): void; on(event: string, listener: () => void): void; statusCode: number }, next: () => void) => {
  const incoming = request.headers["x-request-id"];
  const requestId = typeof incoming === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(incoming) ? incoming : randomUUID();
  const started = Date.now();
  response.setHeader("X-Request-Id", requestId);
  response.setHeader("Cache-Control", "no-store");
  response.on("finish", () => console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: "info", service: "api", event: "http_request", requestId, method: request.method, route: request.url.split("?")[0], statusCode: response.statusCode, durationMs: Date.now() - started })));
  next();
});
await app.listen(Number(process.env.API_PORT ?? 3000), "127.0.0.1");
