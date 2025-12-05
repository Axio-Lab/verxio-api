import { Router, Request, Response, NextFunction } from 'express';
import * as apiKeyService from '../services/apiKeyService';

export const apiKeyRouter: Router = Router();

// /**
//  * @swagger
//  * /api/api-key:
//  *   post:
//  *     summary: Generate a new API key for a user (Public endpoint)
//  *     tags: [API Key]
//  *     description: |
//  *       Public endpoint - no authentication required.
//  *       After a user creates an account via POST /api/user, use this endpoint to generate their API key.
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required:
//  *               - email
//  *             properties:
//  *               email:
//  *                 type: string
//  *                 format: email
//  *                 example: user@example.com
//  *               name:
//  *                 type: string
//  *                 example: "My API Key"
//  *                 description: Optional name/description for the API key
//  *     responses:
//  *       201:
//  *         description: API key generated successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                 apiKey:
//  *                   type: object
//  *                   properties:
//  *                     id:
//  *                       type: string
//  *                     key:
//  *                       type: string
//  *                       description: The generated API key (store securely - shown only once)
//  *                     name:
//  *                       type: string
//  *                     isActive:
//  *                       type: boolean
//  *                     createdAt:
//  *                       type: string
//  *                       format: date-time
//  *                 message:
//  *                   type: string
//  *       400:
//  *         description: Invalid input
//  *       404:
//  *         description: User not found
//  */
// apiKeyRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const result = await apiKeyService.generateApiKey(req.body);
//     res.status(201).json(result);
//   } catch (error) {
//     next(error);
//   }
// });

// /**
//  * @swagger
//  * /api/api-key/{email}:
//  *   get:
//  *     summary: List all API keys for a user (Public endpoint)
//  *     tags: [API Key]
//  *     parameters:
//  *       - in: path
//  *         name: email
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: User email address
//  *     responses:
//  *       200:
//  *         description: List of API keys (keys are masked for security)
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 success:
//  *                   type: boolean
//  *                 apiKeys:
//  *                   type: array
//  *                   items:
//  *                     type: object
//  *                     properties:
//  *                       id:
//  *                         type: string
//  *                       key:
//  *                         type: string
//  *                         description: Masked API key (first 8 and last 4 characters)
//  *                       name:
//  *                         type: string
//  *                       isActive:
//  *                         type: boolean
//  *                       lastUsedAt:
//  *                         type: string
//  *                         format: date-time
//  *                       createdAt:
//  *                         type: string
//  *                         format: date-time
//  *       400:
//  *         description: Invalid input
//  *       404:
//  *         description: User not found
//  */
// apiKeyRouter.get('/:email', async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const { email } = req.params;
//     const result = await apiKeyService.listApiKeys(email);
//     res.json(result);
//   } catch (error) {
//     next(error);
//   }
// });

// /**
//  * @swagger
//  * /api/api-key/revoke:
//  *   post:
//  *     summary: Revoke (deactivate) an API key (Public endpoint)
//  *     tags: [API Key]
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required:
//  *               - email
//  *               - apiKeyId
//  *             properties:
//  *               email:
//  *                 type: string
//  *                 format: email
//  *                 example: user@example.com
//  *               apiKeyId:
//  *                 type: string
//  *                 example: "clx1234567890"
//  *                 description: The ID of the API key to revoke
//  *     responses:
//  *       200:
//  *         description: API key revoked successfully
//  *       400:
//  *         description: Invalid input
//  *       404:
//  *         description: User or API key not found
//  */
// apiKeyRouter.post('/revoke', async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const result = await apiKeyService.revokeApiKey(req.body);
//     res.json(result);
//   } catch (error) {
//     next(error);
//   }
// });

