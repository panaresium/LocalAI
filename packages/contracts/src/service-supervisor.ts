export const SERVICE_LIFECYCLE_STATES = [
  "stopped",
  "starting",
  "running",
  "stopping",
  "failed",
  "external"
] as const;

export const SERVICE_HEALTH_STATES = ["unknown", "healthy", "degraded", "unhealthy"] as const;

export type ServiceLifecycleState = (typeof SERVICE_LIFECYCLE_STATES)[number];
export type ServiceHealthState = (typeof SERVICE_HEALTH_STATES)[number];

export interface LocalAuthTokenInfo {
  readonly tokenId: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly scopes: readonly string[];
}

export interface ServiceHealth {
  readonly state: ServiceHealthState;
  readonly checkedAt: string;
  readonly detail: string;
  readonly latencyMs?: number;
}

export interface ServiceLogEntry {
  readonly id: number;
  readonly timestamp: string;
  readonly serviceId: string;
  readonly level: "debug" | "info" | "warn" | "error";
  readonly message: string;
}

export interface ServiceStatus {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly lifecycle: ServiceLifecycleState;
  readonly startable: boolean;
  readonly stoppable: boolean;
  readonly pid?: number;
  readonly health: ServiceHealth;
}

export interface ServiceSupervisorSnapshot {
  readonly generatedAt: string;
  readonly auth: LocalAuthTokenInfo;
  readonly services: readonly ServiceStatus[];
  readonly logs: readonly ServiceLogEntry[];
  readonly shuttingDown: boolean;
}
