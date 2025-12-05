import { Router, Request, Response, NextFunction } from 'express';
import { apiKeyAuth } from '../middleware/auth';
import * as userService from '../services/userService';

export const userRouter: Router = Router();

/**
 * @swagger
 * /user/create:
 *   post:
 *     summary: Create a new verxio user profile
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Invalid input
 *       409:
 *         description: User already exists
 */
userRouter.post('/create', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await userService.createUser(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /user/{email}:
 *   get:
 *     summary: Get verxio user profile details by email
 *     tags: [User]
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *         description: User email address
 *     responses:
 *       200:
 *         description: User found
 *       404:
 *         description: User not found
 */
userRouter.get('/:email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.params;
    const result = await userService.getUserByEmail(email);
    res.json(result);
  } catch (error) {
    next(error);
  }
});


/**
 * @swagger
 * /user/delete:
 *   delete:
 *     summary: Delete verxio user profile
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       400:
 *         description: Email is required
 *       404:
 *         description: User not found
 */
userRouter.delete('/delete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }
    const result = await userService.deleteUser(email);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /user/issue-verxio:
 *   post:
 *     summary: Issue Verxio credits to a verxio user (Admin only)
 *     tags: [User]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - amount
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *                 example: 1000
 *               description:
 *                 type: string
 *                 example: "Initial credit allocation"
 *     responses:
 *       200:
 *         description: Verxio credits issued successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized (not admin)
 *       404:
 *         description: User not found
 */
userRouter.post('/issue-verxio', apiKeyAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    const result = await userService.issueVerxio(req.body, apiKey);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /user/transfer:
 *   post:
 *     summary: Transfer Verxio credits between verxio users
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fromEmail
 *               - toEmail
 *               - amount
 *             properties:
 *               fromEmail:
 *                 type: string
 *                 format: email
 *                 example: sender@example.com
 *               toEmail:
 *                 type: string
 *                 format: email
 *                 example: recipient@example.com
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *                 example: 50
 *               description:
 *                 type: string
 *                 example: "Payment for services"
 *     responses:
 *       200:
 *         description: Transfer successful
 *       400:
 *         description: Invalid input or insufficient balance
 *       404:
 *         description: User not found
 */
userRouter.post('/transfer', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await userService.transferVerxio(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

