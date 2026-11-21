import { pool } from '../../config/database';
import bcrypt from 'bcryptjs';
import { UserRole } from '../../types';

export class UsersService {
  async getAllUsers() {
    const res = await pool.query(
      `SELECT id, username, full_name as "fullName", role, is_active as "isActive",
              last_login_at as "lastLoginAt", password_changed_at as "passwordChangedAt",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM users ORDER BY created_at ASC`
    );
    return res.rows;
  }

  async getUserById(id: string) {
    const res = await pool.query(
      `SELECT id, username, full_name as "fullName", role, is_active as "isActive",
              last_login_at as "lastLoginAt", password_changed_at as "passwordChangedAt",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM users WHERE id = $1`,
      [id]
    );
    if (res.rowCount === 0) {
      throw { statusCode: 404, message: 'User not found' };
    }
    return res.rows[0];
  }

  async createUser(dto: { username: string; password: string; fullName: string; role: UserRole }) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const res = await pool.query(
      `INSERT INTO users (username, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING id, username, full_name as "fullName", role, is_active as "isActive", created_at as "createdAt"`,
      [dto.username.toLowerCase().trim(), passwordHash, dto.fullName.trim(), dto.role]
    );
    return res.rows[0];
  }

  async updateUser(id: string, dto: { fullName?: string; role?: UserRole; password?: string }) {
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (dto.fullName) {
      updates.push(`full_name = $${idx++}`);
      values.push(dto.fullName.trim());
    }

    if (dto.role) {
      updates.push(`role = $${idx++}`);
      values.push(dto.role);
    }

    if (dto.password) {
      const hash = await bcrypt.hash(dto.password, 10);
      updates.push(`password_hash = $${idx++}`);
      values.push(hash);
      updates.push(`password_changed_at = NOW()`);
      // Invalidate sessions on admin password reset
      await pool.query(`UPDATE user_sessions SET is_revoked = TRUE WHERE user_id = $1`, [id]);
    }

    if (updates.length === 0) {
      return await this.getUserById(id);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const res = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}
       RETURNING id, username, full_name as "fullName", role, is_active as "isActive", updated_at as "updatedAt"`,
      values
    );

    if (res.rowCount === 0) {
      throw { statusCode: 404, message: 'User not found' };
    }
    return res.rows[0];
  }

  async toggleActiveStatus(userId: string, isActive: boolean) {
    const res = await pool.query(
      `UPDATE users
       SET is_active = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, username, full_name as "fullName", role, is_active as "isActive", updated_at as "updatedAt"`,
      [isActive, userId]
    );

    if (res.rowCount === 0) {
      throw { statusCode: 404, message: 'User not found' };
    }

    // If deactivated, revoke all active sessions immediately
    if (!isActive) {
      await pool.query(`UPDATE user_sessions SET is_revoked = TRUE WHERE user_id = $1`, [userId]);
    }

    return res.rows[0];
  }
}

export const usersService = new UsersService();
