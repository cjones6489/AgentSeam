export class SupabaseEnvError extends Error {
  constructor(variableName: string) {
    super(`${variableName} is not set.`);
    this.name = "SupabaseEnvError";
  }
}

export class AuthenticationRequiredError extends Error {
  constructor(message = "Authentication is required for this action.") {
    super(message);
    this.name = "AuthenticationRequiredError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "ForbiddenError";
  }
}
