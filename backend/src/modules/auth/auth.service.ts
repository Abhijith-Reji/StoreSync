import { pool } from '../../config/database';
import { config } from '../../config/env';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { UserRole } from '../../types';
import { AuthUserPayload } from '../../middleware/auth.middleware';

export class AuthService {
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async login(username: string, passwordPlain: string, counterId?: string, ipAddress?: string, userAgent?: string) {
    const res = await pool.query(
      `SELECT id, username, password_hash, full_name, role, is_active FROM users WHERE username = $1`,
      [username.trim().toLowerCase()]
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

    // Update last_login_at timestamp
    await pool.query(`UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1`, [user.id]);

    const activeCounter = counterId || config.pos.counterId;

    // 1. Create a database-backed session with 30-day sliding window expiration
    // Temporary token seed to generate unique session ID
    const sessionRes = await pool.query(
      `INSERT INTO user_sessions (user_id, counter_id, refresh_token_hash, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '30 days')
       RETURNING id, expires_at`,
      [user.id, activeCounter, `pending_${crypto.randomUUID()}`, ipAddress || null, userAgent || null]
    );

    const sessionId = sessionRes.rows[0].id;
    const sessionExpiresAt = sessionRes.rows[0].expires_at;

    // 2. Issue JWT tokens with sessionId
    const payload: AuthUserPayload = {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role as UserRole,
      counterId: activeCounter,
      sessionId,
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as any,
    });

    const refreshToken = jwt.sign(
      { id: user.id, username: user.username, sessionId, jti: crypto.randomUUID() },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn as any } // 30-day sliding window
    );

    // 3. Store SHA-256 hash of refresh token in user_sessions
    const tokenHash = this.hashToken(refreshToken);
    await pool.query(
      `UPDATE user_sessions SET refresh_token_hash = $1 WHERE id = $2`,
      [tokenHash, sessionId]
    );

    return {
      accessToken,
      refreshToken,
      session: {
        id: sessionId,
        counterId: activeCounter,
        expiresAt: sessionExpiresAt,
      },
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        counterId: activeCounter,
      },
    };
  }

  async refreshToken(token: string, ipAddress?: string, userAgent?: string) {
    let decoded: any;
    try {
      decoded = jwt.verify(token, config.jwt.refreshSecret);
    } catch (err: any) {
      throw { statusCode: 401, message: 'Refresh token expired or invalid signature' };
    }

    const tokenHash = this.hashToken(token);

    // Check session in database
    const sessionRes = await pool.query(
      `SELECT s.id, s.user_id, s.counter_id, s.is_revoked, s.expires_at,
              u.username, u.full_name, u.role, u.is_active
       FROM user_sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.refresh_token_hash = $1`,
      [tokenHash]
    );

    if (sessionRes.rowCount === 0) {
      // Possible token reuse / replay attack. If we have a sessionId from decoded token, revoke all sessions for this user!
      if (decoded.sessionId) {
        await pool.query(`UPDATE user_sessions SET is_revoked = TRUE WHERE user_id = $1`, [decoded.id]);
      }
      throw { statusCode: 403, message: 'Invalid session or token reuse detected. All sessions terminated.' };
    }

    const session = sessionRes.rows[0];

    if (session.is_revoked) {
      // Replay attack on revoked token -> revoke all sessions for this user
      await pool.query(`UPDATE user_sessions SET is_revoked = TRUE WHERE user_id = $1`, [session.user_id]);
      throw { statusCode: 403, message: 'Session is revoked. Re-authentication required.' };
    }

    if (!session.is_active) {
      throw { statusCode: 403, message: 'User account is deactivated' };
    }

    if (new Date(session.expires_at) < new Date()) {
      throw { statusCode: 401, message: 'Session has expired. Please log in again.' };
    }

    // Sliding Window Refresh Token Rotation:
    // Generate new refresh token and extend session by another 30 days
    const newRefreshToken = jwt.sign(
      { id: session.user_id, username: session.username, sessionId: session.id, jti: crypto.randomUUID() },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn as any } // 30-day sliding window
    );

    const newTokenHash = this.hashToken(newRefreshToken);

    const updateRes = await pool.query(
      `UPDATE user_sessions 
       SET refresh_token_hash = $1,
           last_active_at = NOW(),
           expires_at = NOW() + INTERVAL '30 days',
           ip_address = COALESCE($2, ip_address),
           user_agent = COALESCE($3, user_agent)
       WHERE id = $4
       RETURNING expires_at`,
      [newTokenHash, ipAddress || null, userAgent || null, session.id]
    );

    const payload: AuthUserPayload = {
      id: session.user_id,
      username: session.username,
      fullName: session.full_name,
      role: session.role as UserRole,
      counterId: session.counter_id,
      sessionId: session.id,
    };

    const newAccessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as any,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresAt: updateRes.rows[0].expires_at,
    };
  }

  async logout(sessionId: string) {
    await pool.query(`UPDATE user_sessions SET is_revoked = TRUE WHERE id = $1`, [sessionId]);
    return { success: true, message: 'Logged out successfully' };
  }

  async logoutAll(userId: string) {
    await pool.query(`UPDATE user_sessions SET is_revoked = TRUE WHERE user_id = $1`, [userId]);
    return { success: true, message: 'All active sessions terminated' };
  }

  async getActiveSessions(userId: string, currentSessionId?: string) {
    const res = await pool.query(
      `SELECT id, user_id as "userId", counter_id as "counterId",
              ip_address as "ipAddress", user_agent as "userAgent",
              last_active_at as "lastActiveAt", expires_at as "expiresAt",
              created_at as "createdAt"
       FROM user_sessions
       WHERE user_id = $1 AND is_revoked = FALSE AND expires_at > NOW()
       ORDER BY last_active_at DESC`,
      [userId]
    );

    return res.rows.map((row) => ({
      ...row,
      isCurrent: row.id === currentSessionId,
    }));
  }

  async revokeSession(sessionId: string, requestingUserId: string, requestingRole: UserRole) {
    const sessionRes = await pool.query(`SELECT user_id FROM user_sessions WHERE id = $1`, [sessionId]);
    if (sessionRes.rowCount === 0) {
      throw { statusCode: 404, message: 'Session not found' };
    }

    const sessionUserId = sessionRes.rows[0].user_id;

    // Authorization: Owner and Manager can revoke any session, standard users can only revoke own
    if (
      requestingRole !== UserRole.OWNER &&
      requestingRole !== UserRole.MANAGER &&
      requestingUserId !== sessionUserId
    ) {
      throw { statusCode: 403, message: 'You do not have permission to revoke this session' };
    }

    await pool.query(`UPDATE user_sessions SET is_revoked = TRUE WHERE id = $1`, [sessionId]);
    return { success: true, message: `Session ${sessionId} revoked successfully` };
  }

  async changePassword(userId: string, oldPasswordPlain: string, newPasswordPlain: string, currentSessionId?: string) {
    if (!newPasswordPlain || newPasswordPlain.length < 6) {
      throw { statusCode: 400, message: 'New password must be at least 6 characters long' };
    }

    const userRes = await pool.query(`SELECT password_hash FROM users WHERE id = $1`, [userId]);
    if (userRes.rowCount === 0) {
      throw { statusCode: 404, message: 'User not found' };
    }

    const match = await bcrypt.compare(oldPasswordPlain, userRes.rows[0].password_hash);
    if (!match) {
      throw { statusCode: 400, message: 'Current password does not match' };
    }

    const newHash = await bcrypt.hash(newPasswordPlain, 10);

    await pool.query(
      `UPDATE users 
       SET password_hash = $1, password_changed_at = NOW(), updated_at = NOW() 
       WHERE id = $2`,
      [newHash, userId]
    );

    // Revoke other active sessions for security
    if (currentSessionId) {
      await pool.query(
        `UPDATE user_sessions SET is_revoked = TRUE WHERE user_id = $1 AND id != $2`,
        [userId, currentSessionId]
      );
    } else {
      await pool.query(`UPDATE user_sessions SET is_revoked = TRUE WHERE user_id = $1`, [userId]);
    }

    return { success: true, message: 'Password updated successfully. Other active sessions were revoked.' };
  }
}

export const authService = new AuthService();
