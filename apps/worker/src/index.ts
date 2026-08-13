import { Controller, Get, Module } from "@nestjs/common";
import type { ServiceBoundary } from "@nexus/contracts";

@Controller()
export class WorkerHealthController {
  @Get("health")
  health() { return { status: "ok" as const, service: "worker" as const, time: new Date().toISOString() }; }
}

@Module({ controllers: [WorkerHealthController] })
export class WorkerModule {}

export const workerBoundary: ServiceBoundary = "worker";
