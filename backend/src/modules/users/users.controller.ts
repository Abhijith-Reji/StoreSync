import { Request, Response, NextFunction } from 'express';
import { usersService } from './users.service';
import { UserRole } from '../../types';

export class UsersController {
  async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const users = await usersService.getAllUsers();
      res.json({ users });
    } catch (err) {
      next(err);
    }
  }

  async getUser(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await usersService.getUserById(req.params.id);
      res.json({ user });
    } catch (err) {
      next(err);
    }
  }

  async createUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password, fullName, role } = req.body;
      if (!username || !password || !fullName || !role) {
        res.status(400).json({ error: 'Username, password, fullName, and role are required' });
        return;
      }
      if (!Object.values(UserRole).includes(role)) {
        res.status(400).json({ error: 'Invalid user role' });
        return;
      }
      const newUser = await usersService.createUser({ username, password, fullName, role });
      res.status(201).json({ user: newUser });
    } catch (err: any) {
      if (err.code === '23505') {
        res.status(409).json({ error: 'Username already exists' });
        return;
      }
      next(err);
    }
  }

  async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { fullName, role, password } = req.body;
      if (role && !Object.values(UserRole).includes(role)) {
        res.status(400).json({ error: 'Invalid user role' });
        return;
      }
      const updated = await usersService.updateUser(req.params.id, { fullName, role, password });
      res.json({ user: updated });
    } catch (err) {
      next(err);
    }
  }

  async toggleStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      if (typeof isActive !== 'boolean') {
        res.status(400).json({ error: 'isActive must be a boolean' });
        return;
      }
      const updated = await usersService.toggleActiveStatus(id, isActive);
      res.json({ user: updated });
    } catch (err) {
      next(err);
    }
  }
}

export const usersController = new UsersController();
