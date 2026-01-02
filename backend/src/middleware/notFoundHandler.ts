import { Request, Response } from 'express';

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'The requested endpoint does not exist. Check the API documentation.',
  });
};

