import { pool } from '../../config/database';
import { config } from '../../config/env';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRole } from '../../types';
import { AuthUserPayload } from '../../middleware/auth.middleware';

export class AuthService {
  async login(username: string, passwordPlain: string, counterId?: string) {
    const res = await pool.query(
      `SELECT id, username, password_hash, full_name, role, is_active FROM users WHERE username = $1`,
      [username.trim()]
    );

    if (res.rowCount === 0) {
      throw { statusCode: 401, message: 'Invalid username or credentials' };
    }

    const user = res.rows[0];

    if (!user.is_active) {
      throw { statusCode: 403, message: 'User account is deactivated. Contact store owner/manager.' };
    }

    const passwordMatch = await bcrypt.compare(passwordPlain, user.password_hash);
    if (!passwordMatch) {
      throw { statusCode: 401, message: 'Invalid username or credentials' };
    }

    const payload: AuthUserPayload = {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role as UserRole,
      counterId: counterId || config.pos.counterId,
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as any,
    });

    const refreshToken = jwt.sign(
      { id: user.id, username: user.username },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn as any }
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        counterId: payload.counterId,
      },
    };
  }

  async refreshToken(token: string) {
    try {
      const decoded = jwt.verify(token, config.jwt.refreshSecret) as { id: string; username: string };
      const res = await pool.query(
        `SELECT id, username, full_name, role, is_active FROM users WHERE id = $1`,
        [decoded.id]
      );

      if (res.rowCount === 0 || !res.rows[0].is_active) {
        throw { statusCode: 403, message: 'Invalid session or user inactive' };
      }

      const user = res.rows[0];
      const payload: AuthUserPayload = {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role as UserRole,
      };

      const newAccessToken = jwt.sign(payload, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn as any,
      });

      return { accessToken: newAccessToken };
    } catch (err: any) {
      throw { statusCode: 403, message: 'Refresh token expired or invalid' };
    }
  }
}

export const authService = new AuthService();
