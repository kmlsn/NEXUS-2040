import { Controller, Get, Module, NotFoundException } from "@nestjs/common";
import type { ServiceBoundary } from "@nexus/contracts";
import { Pool } from "pg";
import { CenterService } from "./economy/center-service";
import { FacilityQueueService } from "./economy/facility-queue-service";

const centerPool = new Pool({ connectionString: process.env.DATABASE_URL ?? "postgresql://nexus_local:nexus_local_password@127.0.0.1:15432/postgres" });

@Controller()
export class HealthController {
  @Get("health")
  health() { return { status: "ok" as const, service: "api" as const, time: new Date().toISOString() }; }
}

@Controller("v1")
export class CenterController {
  @Get("center")
  async center() {
    const profileId = process.env.CENTER_PROFILE_ID;
    if (!profileId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(profileId)) throw new NotFoundException();
    const now = BigInt(Date.now());
    await new FacilityQueueService(centerPool, { nowMs: () => Number(now) }).reconcile(profileId);
    const snapshot = await new CenterService(centerPool).snapshot(profileId, now);
    if (!snapshot) throw new NotFoundException();
    return snapshot;
  }
}

@Module({ controllers: [HealthController, CenterController] })
export class ApiModule {}

export const apiBoundary: ServiceBoundary = "api";
