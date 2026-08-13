import { Controller, Get, Module } from "@nestjs/common";
import type { ServiceBoundary } from "@nexus/contracts";

@Controller()
export class HealthController {
  @Get("health")
  health() { return { status: "ok" as const, service: "api" as const, time: new Date().toISOString() }; }
}

@Module({ controllers: [HealthController] })
export class ApiModule {}

export const apiBoundary: ServiceBoundary = "api";
