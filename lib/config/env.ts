import { LibConfigError } from "@/lib/lib.errors";

/**
 * Returns an environment variable when present.
 *
 * @param name The environment variable name to resolve.
 * @returns The resolved environment variable value, or undefined when unset.
 */
export function readEnv(name: string): string | undefined {
  return process.env[name];
}

/**
 * Returns an environment variable or a fallback when it is unset.
 *
 * @param name The environment variable name to resolve.
 * @param fallback The fallback value to use when the variable is unset.
 * @returns The resolved environment variable value or the fallback.
 */
export function readEnvWithDefault(name: string, fallback: string): string {
  return readEnv(name) ?? fallback;
}

/**
 * Returns a boolean environment variable using `"true"` as the enabled value.
 *
 * @param name The environment variable name to resolve.
 * @param fallback The fallback boolean value when the variable is unset.
 * @returns The parsed boolean environment variable.
 */
export function readBooleanEnv(name: string, fallback = false): boolean {
  const value = readEnv(name);

  if (value === undefined) {
    return fallback;
  }

  return value === "true";
}

/**
 * Returns a numeric environment variable or a fallback when it is invalid.
 *
 * @param name The environment variable name to resolve.
 * @param fallback The fallback numeric value when the variable is unset or invalid.
 * @returns The parsed number or the fallback value.
 */
export function readNumberEnv(name: string, fallback: number): number {
  const value = readEnv(name);

  if (value === undefined) {
    return fallback;
  }

  const parsedValue = Number(value);

  return Number.isNaN(parsedValue) ? fallback : parsedValue;
}

/**
 * Returns a required environment variable or throws with a clear message.
 *
 * @param name The environment variable name to resolve.
 * @returns The non-empty environment variable value.
 */
export function requireEnv(name: string): string {
  const value = readEnv(name);

  if (!value) {
    throw new LibConfigError(
      name,
      `Missing required environment variable: ${name}`,
    );
  }

  return value;
}
