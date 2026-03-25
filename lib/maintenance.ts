import { readBooleanEnv } from "@/lib/config/env";

export function isMaintenanceModeEnabled(): boolean {
  return readBooleanEnv("MAINTENANCE_MODE_ENABLED");
}
