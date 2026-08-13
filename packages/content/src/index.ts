import type { ServiceBoundary } from "@nexus/contracts";

export type ContentOwner = Extract<ServiceBoundary, "api">;
