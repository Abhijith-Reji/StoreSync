import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { ROLE_PERMISSIONS } from '../../types';

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password, counterId } = req.body;
      if (!username || !password) {
        res.status(400).json({ error: 'Username and password are required' });
        return;
      }

      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const data = await authService.login(username, password, counterId, ipAddress, userAgent);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        res.status(400).json({ error: 'Refresh token is required' });
        return;
      }

      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const data = await authService.refreshToken(refreshToken, ipAddress, userAgent);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user || !req.user.sessionId) {
        res.status(400).json({ error: 'No active session found in request' });
        return;
      }

      const result = await authService.logout(req.user.sessionId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async logoutAll(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const result = await authService.logoutAll(req.user.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getSessions(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const sessions = await authService.getActiveSessions(req.user.id, req.user.sessionId);
      res.json({ sessions });
    } catch (err) {
      next(err);
    }
  }

  async revokeSession(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const sessionId = req.params.sessionId;
      if (!sessionId) {
        res.status(400).json({ error: 'Session ID parameter is required' });
        return;
      }

      const result = await authService.revokeSession(sessionId, req.user.id, req.user.role);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { oldPassword, newPassword } = req.body;
      if (!oldPassword || !newPassword) {
        res.status(400).json({ error: 'Both oldPassword and newPassword are required' });
        return;
      }

      const result = await authService.changePassword(
        req.user.id,
        oldPassword,
        newPassword,
        req.user.sessionId
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async me(req: Request, res: Response) {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const permissions = ROLE_PERMISSIONS[req.user.role] || [];
    res.json({
      user: {
        id: req.user.id,
        username: req.user.username,
        fullName: req.user.fullName,
        role: req.user.role,
        counterId: req.user.counterId,
        sessionId: req.user.sessionId,
        permissions,
      },
    });
  }
}

export const authController = new AuthController();
