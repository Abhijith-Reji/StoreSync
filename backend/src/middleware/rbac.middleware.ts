import { Request, Response, NextFunction } from 'express';
import { UserRole, Permission, ROLE_PERMISSIONS } from '../types';

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Role Hierarchy: OWNER always has access
    if (req.user.role === UserRole.OWNER) {
      next();
      return;
    }

    // MANAGER has access if MANAGER or SALESPERSON is allowed
    if (req.user.role === UserRole.MANAGER && (allowedRoles.includes(UserRole.MANAGER) || allowedRoles.includes(UserRole.SALESPERSON))) {
      next();
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Forbidden: Insufficient role permissions',
        requiredRoles: allowedRoles,
        userRole: req.user.role,
      });
      return;
    }

    next();
  };
}

export function requirePermission(...requiredPermissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const userPermissions = ROLE_PERMISSIONS[req.user.role] || [];
    const hasAll = requiredPermissions.every((perm) => userPermissions.includes(perm));

    if (!hasAll) {
      res.status(403).json({
        error: 'Forbidden: Missing required action permission',
        requiredPermissions,
        userRole: req.user.role,
      });
      return;
    }

    next();
  };
}
