import { readBooleanEnv } from "@/lib/config/env";

/**
 * Determines whether maintenance mode is enabled for the application.
 *
 * @returns True when maintenance mode is enabled.
 */
export function isMaintenanceModeEnabled(): boolean {
  return readBooleanEnv("MAINTENANCE_MODE_ENABLED");
}
