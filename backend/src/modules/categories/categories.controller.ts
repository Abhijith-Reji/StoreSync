import { Request, Response, NextFunction } from 'express';
import { categoriesService } from './categories.service';

export class CategoriesController {
  async listCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await categoriesService.getAllCategories();
      res.json({ categories });
    } catch (err) {
      next(err);
    }
  }

  async getCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await categoriesService.getCategoryById(req.params.id);
      res.json({ category });
    } catch (err) {
      next(err);
    }
  }

  async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, code, description } = req.body;
      const category = await categoriesService.createCategory({ name, code, description });
      res.status(201).json({ category });
    } catch (err) {
      next(err);
    }
  }

  async updateCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, description } = req.body;
      const category = await categoriesService.updateCategory(req.params.id, { name, description });
      res.json({ category });
    } catch (err) {
      next(err);
    }
  }

  async deleteCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await categoriesService.deleteCategory(req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const categoriesController = new CategoriesController();
