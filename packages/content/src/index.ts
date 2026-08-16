import type { ServiceBoundary } from "@nexus/contracts";
export * from "./facilities";
export * from "./organizations";
export * from "./contracts";

export type ContentOwner = Extract<ServiceBoundary, "api">;
