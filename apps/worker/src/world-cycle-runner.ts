import { WORLD_CYCLE_MS } from "@nexus/simulation";
import type { WorldCycleService } from "./world-cycle-service";

export interface WorldCycleRunner {
  stop(): void;
}

/** Starts immediately and then checks each six hours; the service itself serializes and deduplicates completed cycles. */
export function startWorldCycleRunner(service: WorldCycleService): WorldCycleRunner {
  let stopped = false;
  const run = async (): Promise<void> => {
    try {
      const outcome = await service.advanceNow();
      console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: "info", service: "worker", event: "world_cycle_checked", advancedCycles: outcome.advancedCycles.toString(), completedCycles: outcome.state.completedCycles.toString(), stateRevision: outcome.state.stateRevision.toString() }));
    } catch {
      console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: "error", service: "worker", event: "world_cycle_check_failed" }));
    }
  };
  void run();
  const timer = setInterval(() => { if (!stopped) void run(); }, Number(WORLD_CYCLE_MS));
  return { stop: () => { stopped = true; clearInterval(timer); } };
}
