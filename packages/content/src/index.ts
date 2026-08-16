import type { ServiceBoundary } from "@nexus/contracts";
export * from "./facilities";
export * from "./organizations";

export type ContentOwner = Extract<ServiceBoundary, "api">;
