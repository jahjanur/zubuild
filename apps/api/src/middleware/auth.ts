import { Request, Response, NextFunction } from 'express';
import { runWithOrg } from '../lib/tenantContext';

export interface SessionUser {
  id: string;
  email: string;
  role: string;
  organizationId: string | null;
  currency: string;
  locale: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

/**
 * Require authenticated user. Responds 401 if not logged in.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  req.user = req.session.user as SessionUser;
  next();
}

/**
 * Establish the tenant context for the rest of the request from the session
 * user's organizationId, so the Prisma middleware scopes every query. A logged-in
 * user with no organizationId is treated as having no data access (403) rather
 * than silently running unscoped queries. Use after requireAuth.
 */
export function tenantContext(req: Request, res: Response, next: NextFunction): void {
  const orgId = req.user?.organizationId;
  if (!orgId) {
    res.status(403).json({ success: false, error: 'No organization context' });
    return;
  }
  runWithOrg(orgId, () => next());
}

/**
 * Role matrix (enforced server-side — never trust the client's role for authz):
 *   VIEWER    — read-only: may GET every resource, no writes.
 *   INSPECTOR — VIEWER + delivery checks: create reconciliations and mark an
 *               order DELIVERED. No other writes (cannot edit suppliers,
 *               products, orders, inventory) and no org administration.
 *   MANAGER   — VIEWER + operational writes: suppliers, products, orders,
 *               reconciliations, inventory, and CSV export.
 *   ADMIN     — MANAGER + org administration: team members & invitations.
 * MANAGER/ADMIN are a rank ladder (higher includes everything below). INSPECTOR
 * is a side capability, not a rung: it reads like VIEWER and adds only the
 * delivery-check writes via `requireInspector`, so it never gains MANAGER writes.
 */
export const ROLES = ['VIEWER', 'INSPECTOR', 'MANAGER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];
// INSPECTOR ranks with VIEWER so the MANAGER/ADMIN gates reject it; its extra
// powers come from the explicit capability gate below, not from rank.
const ROLE_RANK: Record<string, number> = { VIEWER: 1, INSPECTOR: 1, MANAGER: 2, ADMIN: 3 };

/** Gate a route on a minimum role. Responds 401 if unauthenticated, 403 if under-ranked. */
function requireMinRole(min: Role, label: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }
    if ((ROLE_RANK[req.user.role] ?? 0) < ROLE_RANK[min]) {
      res.status(403).json({ success: false, error: `${label} access required` });
      return;
    }
    next();
  };
}

/** Gate a route on membership in an explicit set of roles (a capability, not a
 * rank). Responds 401 if unauthenticated, 403 if the role is not allowed. */
function requireAnyRole(allowed: readonly string[], label: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }
    if (!allowed.includes(req.user.role)) {
      res.status(403).json({ success: false, error: `${label} access required` });
      return;
    }
    next();
  };
}

/** MANAGER or ADMIN — operational writes. Use after requireAuth. */
export const requireManager = requireMinRole('MANAGER', 'Manager');

/** ADMIN only — org administration. Use after requireAuth. */
export const requireAdmin = requireMinRole('ADMIN', 'Admin');

/** INSPECTOR, MANAGER or ADMIN — delivery checks (reconciliations, mark
 * delivered). Use after requireAuth. */
export const requireInspector = requireAnyRole(['INSPECTOR', 'MANAGER', 'ADMIN'], 'Inspector');
