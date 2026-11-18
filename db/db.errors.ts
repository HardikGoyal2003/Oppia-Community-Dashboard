/**
 * Base error for domain-aware DB failures.
 */
export class DbError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DbError";
  }
}

/**
 * Error raised when a required DB record does not exist.
 */
export class DbNotFoundError extends DbError {
  resource: string;

  constructor(resource: string, message = `${resource} not found.`) {
    super(message);
    this.name = "DbNotFoundError";
    this.resource = resource;
  }
}

/**
 * Error raised when a DB-backed workflow is in an invalid state.
 */
export class DbInvalidStateError extends DbError {
  resource: string;

  constructor(resource: string, message: string) {
    super(message);
    this.name = "DbInvalidStateError";
    this.resource = resource;
  }
}

/**
 * Error raised when DB input violates a domain constraint.
 */
export class DbValidationError extends DbError {
  field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "DbValidationError";
    this.field = field;
  }
}
