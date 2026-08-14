import type { ServiceBoundary } from "@nexus/contracts";
export * from "./facilities";

export type ContentOwner = Extract<ServiceBoundary, "api">;
