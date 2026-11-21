import { Request, Response, NextFunction } from 'express';

export type ValidationRule = {
  field: string;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  min?: number;
  max?: number;
  enum?: any[];
  custom?: (val: any) => boolean | string;
};

export function validateBody(rules: ValidationRule[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    for (const rule of rules) {
      const val = req.body[rule.field];

      if (rule.required && (val === undefined || val === null || val === '')) {
        errors.push(`Field '${rule.field}' is required`);
        continue;
      }

      if (val !== undefined && val !== null) {
        if (rule.type === 'number') {
          const num = Number(val);
          if (isNaN(num)) {
            errors.push(`Field '${rule.field}' must be a valid number`);
          } else {
            if (rule.min !== undefined && num < rule.min) {
              errors.push(`Field '${rule.field}' must be at least ${rule.min}`);
            }
            if (rule.max !== undefined && num > rule.max) {
              errors.push(`Field '${rule.field}' must be at most ${rule.max}`);
            }
          }
        } else if (rule.type === 'string') {
          if (typeof val !== 'string') {
            errors.push(`Field '${rule.field}' must be a string`);
          } else {
            if (rule.min !== undefined && val.length < rule.min) {
              errors.push(`Field '${rule.field}' must be at least ${rule.min} characters`);
            }
          }
        } else if (rule.type === 'array') {
          if (!Array.isArray(val)) {
            errors.push(`Field '${rule.field}' must be an array`);
          } else if (rule.min !== undefined && val.length < rule.min) {
            errors.push(`Field '${rule.field}' must contain at least ${rule.min} items`);
          }
        }

        if (rule.enum && !rule.enum.includes(val)) {
          errors.push(`Field '${rule.field}' must be one of: ${rule.enum.join(', ')}`);
        }

        if (rule.custom) {
          const customRes = rule.custom(val);
          if (typeof customRes === 'string') {
            errors.push(customRes);
          } else if (!customRes) {
            errors.push(`Field '${rule.field}' failed validation check`);
          }
        }
      }
    }

    if (errors.length > 0) {
      res.status(400).json({ error: 'Validation failed', details: errors });
      return;
    }

    next();
  };
}
