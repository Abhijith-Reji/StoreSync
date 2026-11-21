import { pool } from '../../config/database';
import bcrypt from 'bcryptjs';
import { UserRole } from '../../types';

export class UsersService {
  async getAllUsers() {
    const res = await pool.query(
      `SELECT id, username, full_name as "fullName", role, is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
       FROM users ORDER BY created_at ASC`
    );
    return res.rows;
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
    return res.rows[0];
  }
}

export const usersService = new UsersService();
