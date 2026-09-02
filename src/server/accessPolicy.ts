export type AppRole = "super_admin" | "teacher" | "student";

const VALID_ROLES = new Set<AppRole>(["super_admin", "teacher", "student"]);

export function normalizeAccessEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function parseBootstrapSuperAdminEmails(value: unknown) {
  return new Set(
    String(value || "")
      .split(",")
      .map(normalizeAccessEmail)
      .filter(Boolean)
  );
}

export function getDefaultRoleForEmail(email: unknown, bootstrapEmails: ReadonlySet<string>): AppRole {
  return bootstrapEmails.has(normalizeAccessEmail(email)) ? "super_admin" : "student";
}

export function resolveTrustedRole(
  decodedToken: Record<string, unknown>,
  storedProfile: Record<string, unknown> = {},
  bootstrapEmails: ReadonlySet<string>
): AppRole {
  const claimRole = String(decodedToken.role || "").trim() as AppRole;
  if (VALID_ROLES.has(claimRole)) return claimRole;

  const email = normalizeAccessEmail(decodedToken.email || storedProfile.email);
  if (bootstrapEmails.has(email)) return "super_admin";

  // Profile writes are backend-only. Trusting a stored role keeps existing
  // administrators available after removing source-code email allowlists.
  const storedRole = String(storedProfile.role || "").trim() as AppRole;
  return VALID_ROLES.has(storedRole) ? storedRole : "student";
}
