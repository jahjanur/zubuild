import { Request, Response, NextFunction } from 'express';
import { runWithOrg } from '../lib/tenantContext';

export interface SessionUser {
  id: string;
  email: string;
  role: string;
  organizationId: string | null;
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
 * Require ADMIN role. Use after requireAuth. Responds 403 if not admin.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  if (req.user.role !== 'ADMIN') {
    res.status(403).json({ success: false, error: 'Admin access required' });
    return;
  }
  next();
}
