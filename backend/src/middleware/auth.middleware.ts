import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { UserRole } from '../types';
import { pool } from '../config/database';

export interface AuthUserPayload {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  counterId?: string;
  sessionId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}

export async function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as AuthUserPayload;
    
    // If sessionId is present in payload, verify database session validity
    if (decoded.sessionId) {
      const sessionRes = await pool.query(
        `SELECT s.is_revoked, s.expires_at, u.is_active 
         FROM user_sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.id = $1`,
        [decoded.sessionId]
      );

      if (sessionRes.rowCount === 0) {
        res.status(401).json({ error: 'Session not found or expired' });
        return;
      }

      const session = sessionRes.rows[0];
      if (session.is_revoked) {
        res.status(401).json({ error: 'Session has been revoked. Please log in again.' });
        return;
      }

      if (!session.is_active) {
        res.status(403).json({ error: 'User account is deactivated. Contact store administrator.' });
        return;
      }

      if (new Date(session.expires_at) < new Date()) {
        res.status(401).json({ error: 'Session has expired' });
        return;
      }

      // Touch last_active_at in the background (fire and forget to not block request)
      pool.query(`UPDATE user_sessions SET last_active_at = NOW() WHERE id = $1`, [decoded.sessionId]).catch(() => {});
    }

    req.user = decoded;
    next();
  } catch (err: any) {
    res.status(403).json({ error: 'Invalid or expired access token' });
    return;
  }
}
