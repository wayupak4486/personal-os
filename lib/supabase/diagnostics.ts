type DiagnosticError = {
  name: string | null;
  message: string | null;
  details: string | null;
  hint: string | null;
  code: string | null;
  status: string | null;
  stack: string | null;
  cause: string | null;
};

function readProperty(value: object, key: string): unknown {
  try {
    const ownKeys = Reflect.ownKeys(value);
    const matchingKey = ownKeys.find((ownKey) => String(ownKey) === key);
    if (matchingKey !== undefined) return Reflect.get(value, matchingKey);
    return key in value ? Reflect.get(value, key) : undefined;
  } catch {
    return undefined;
  }
}

function toText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

export function serializeSupabaseError(error: unknown): string {
  if (error === null || error === undefined) {
    return JSON.stringify({ name: null, message: null, details: null, hint: null, code: null, status: null, stack: null, cause: null });
  }

  if (typeof error !== "object" && typeof error !== "function") {
    return JSON.stringify({ name: null, message: String(error), details: null, hint: null, code: null, status: null, stack: null, cause: null });
  }

  const source = error as object;
  const diagnostic: DiagnosticError = {
    name: toText(readProperty(source, "name")),
    message: toText(readProperty(source, "message")),
    details: toText(readProperty(source, "details")),
    hint: toText(readProperty(source, "hint")),
    code: toText(readProperty(source, "code")),
    status: toText(readProperty(source, "status")),
    stack: toText(readProperty(source, "stack")),
    cause: toText(readProperty(source, "cause")),
  };

  if (!diagnostic.message) {
    diagnostic.message = toText(error);
  }

  return JSON.stringify(diagnostic);
}

export function supabaseDiagnosticContext(operation: string, projectRef: string, userId: string | null, userEmail: string | null) {
  return JSON.stringify({
    operation,
    projectRef,
    hasSession: Boolean(userId),
    userId,
    userEmail,
  });
}
