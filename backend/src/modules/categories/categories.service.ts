import { pool } from '../../config/database';
import { CreateCategoryDto, UpdateCategoryDto } from '../../types';

export class CategoriesService {
  async getAllCategories() {
    const res = await pool.query(
      `SELECT c.id, c.name, c.code, c.description, c.is_active as "isActive", c.created_at as "createdAt",
              COUNT(p.id)::int as "productCount"
       FROM categories c
       LEFT JOIN products p ON c.id = p.category_id AND p.is_active = TRUE
       WHERE c.is_active = TRUE
       GROUP BY c.id
       ORDER BY c.name ASC`
    );
    return res.rows;
  }

  async getCategoryById(id: string) {
    const res = await pool.query(
      `SELECT c.id, c.name, c.code, c.description, c.is_active as "isActive", c.created_at as "createdAt",
              COUNT(p.id)::int as "productCount"
       FROM categories c
       LEFT JOIN products p ON c.id = p.category_id AND p.is_active = TRUE
       WHERE c.id = $1 AND c.is_active = TRUE
       GROUP BY c.id`,
      [id]
    );

    if (res.rowCount === 0) {
      throw { statusCode: 404, message: 'Category not found' };
    }
    return res.rows[0];
  }

  async createCategory(dto: CreateCategoryDto) {
    if (!dto.name || !dto.code) {
      throw { statusCode: 400, message: 'Category name and unique code are required' };
    }

    const cleanCode = dto.code.trim().toUpperCase();
    const cleanName = dto.name.trim();

    // Check conflict
    const existCheck = await pool.query(
      `SELECT id FROM categories WHERE (code = $1 OR name = $2) AND is_active = TRUE`,
      [cleanCode, cleanName]
    );

    if (existCheck.rowCount && existCheck.rowCount > 0) {
      throw { statusCode: 409, message: 'A category with this code or name already exists' };
    }

    const res = await pool.query(
      `INSERT INTO categories (name, code, description, is_active)
       VALUES ($1, $2, $3, TRUE)
       RETURNING id, name, code, description, is_active as "isActive", created_at as "createdAt"`,
      [cleanName, cleanCode, dto.description || null]
    );

    return {
      ...res.rows[0],
      productCount: 0,
    };
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (dto.name !== undefined) {
      updates.push(`name = $${idx++}`);
      values.push(dto.name.trim());
    }

    if (dto.description !== undefined) {
      updates.push(`description = $${idx++}`);
      values.push(dto.description ? dto.description.trim() : null);
    }

    if (updates.length === 0) {
      return await this.getCategoryById(id);
    }

    values.push(id);
    const res = await pool.query(
      `UPDATE categories
       SET ${updates.join(', ')}
       WHERE id = $${idx} AND is_active = TRUE
       RETURNING id, name, code, description, is_active as "isActive", created_at as "createdAt"`,
      values
    );

    if (res.rowCount === 0) {
      throw { statusCode: 404, message: 'Category not found' };
    }

    return await this.getCategoryById(id);
  }

  async deleteCategory(id: string) {
    // Check if any active products are assigned to this category
    const countRes = await pool.query(
      `SELECT COUNT(*)::int as count FROM products WHERE category_id = $1 AND is_active = TRUE`,
      [id]
    );

    const productCount = countRes.rows[0]?.count || 0;
    if (productCount > 0) {
      throw {
        statusCode: 400,
        message: `Cannot delete category. ${productCount} active products are currently assigned to it. Reassign products first.`,
      };
    }

    const res = await pool.query(
      `UPDATE categories SET is_active = FALSE WHERE id = $1 AND is_active = TRUE RETURNING id, name`,
      [id]
    );

    if (res.rowCount === 0) {
      throw { statusCode: 404, message: 'Category not found' };
    }

    return { success: true, message: `Category '${res.rows[0].name}' deleted successfully` };
  }
}

export const categoriesService = new CategoriesService();
