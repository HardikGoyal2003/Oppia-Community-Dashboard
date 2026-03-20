export function isMaintenanceModeEnabled(): boolean {
  return process.env.MAINTENANCE_MODE_ENABLED === "true";
}
