import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password, counterId } = req.body;
      if (!username || !password) {
        res.status(400).json({ error: 'Username and password are required' });
        return;
      }
      const data = await authService.login(username, password, counterId);
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
      const data = await authService.refreshToken(refreshToken);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async me(req: Request, res: Response) {
    res.json({ user: req.user });
  }
}

export const authController = new AuthController();
