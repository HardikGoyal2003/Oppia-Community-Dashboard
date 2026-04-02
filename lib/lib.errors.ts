/**
 * Base error for domain-aware lib-layer failures.
 */
export class LibError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LibError";
  }
}

/**
 * Error raised when required configuration is missing or invalid.
 */
export class LibConfigError extends LibError {
  field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "LibConfigError";
    this.field = field;
  }
}

/**
 * Error raised when a lib-layer mapping step receives an invalid shape.
 */
export class LibMappingError extends LibError {
  resource: string;

  constructor(resource: string, message: string) {
    super(message);
    this.name = "LibMappingError";
    this.resource = resource;
  }
}

/**
 * Error raised when a lib-layer workflow reaches an invalid state.
 */
export class LibInvalidStateError extends LibError {
  resource: string;

  constructor(resource: string, message: string) {
    super(message);
    this.name = "LibInvalidStateError";
    this.resource = resource;
  }
}
