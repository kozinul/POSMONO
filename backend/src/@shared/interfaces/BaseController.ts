import { Response } from 'express';

export abstract class BaseController {
  protected ok<T>(res: Response, data: T, meta?: Record<string, unknown>): void {
    res.status(200).json({
      success: true,
      data,
      ...(meta && { meta }),
    });
  }

  protected created<T>(res: Response, data: T): void {
    res.status(201).json({ success: true, data });
  }

  protected noContent(res: Response): void {
    res.status(204).send();
  }
}
