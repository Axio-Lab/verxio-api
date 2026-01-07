import { Router, Request, Response, NextFunction } from "express";
import * as credentialService from "../services/credentialService";
import { betterAuthMiddleware } from "../middleware/betterAuth";
import { AppError } from "../middleware/errorHandler";
import { CredentialType, isValidCredentialType } from "../services/credentialService";

export const credentialRouter: Router = Router();

// Apply Better Auth middleware to all credential routes
credentialRouter.use(betterAuthMiddleware);

/**
 * @swagger
 * /credential:
 *   get:
 *     summary: Get credentials for the authenticated user with pagination (optionally filtered by type)
 *     tags: [Credentials]
 *     security:
 *       - BetterAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [OPENAI, ANTHROPIC, GEMINI]
 *         description: Optional filter by credential type
 *         required: false
 *     responses:
 *       200:
 *         description: Paginated list of credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 credentials:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       type:
 *                         type: string
 *                         enum: [OPENAI, ANTHROPIC, GEMINI]
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *       400:
 *         description: Bad request (invalid type or pagination parameters)
 *       401:
 *         description: Unauthorized
 */
credentialRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const type = req.query.type as CredentialType | undefined;

    const result = await credentialService.getCredentials(user.id, page, limit, type);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /credential:
 *   post:
 *     summary: Create a new credential
 *     tags: [Credentials]
 *     security:
 *       - BetterAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - value
 *               - type
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name for the credential (e.g., "My OpenAI Key")
 *               value:
 *                 type: string
 *                 description: The actual credential value (API key)
 *               type:
 *                 type: string
 *                 enum: [OPENAI, ANTHROPIC, GEMINI]
 *                 description: Type of credential
 *     responses:
 *       201:
 *         description: Credential created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 type:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Bad request (missing or invalid fields)
 *       401:
 *         description: Unauthorized
 */
credentialRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { name, value, type } = req.body;

    if (!name || !value || !type) {
      throw new AppError("Name, value, and type are required", 400);
    }

    // Validate type (allows known types and custom types)
    if (!isValidCredentialType(type)) {
      throw new AppError(
        `Invalid type. Must be a known type (${Object.values(CredentialType).join(", ")}) or a custom type (uppercase, alphanumeric + underscore, 3-50 chars)`,
        400
      );
    }

    const credential = await credentialService.createCredential({
      name,
      value,
      type,
      userId: user.id,
    });

    res.status(201).json(credential);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /credential/{id}:
 *   get:
 *     summary: Get a single credential by ID
 *     tags: [Credentials]
 *     security:
 *       - BetterAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Credential ID
 *     responses:
 *       200:
 *         description: Credential details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 type:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: Credential not found
 *       401:
 *         description: Unauthorized
 */
credentialRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const credential = await credentialService.getCredential(id, user.id);
    res.json(credential);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /credential/{id}:
 *   put:
 *     summary: Update a credential
 *     tags: [Credentials]
 *     security:
 *       - BetterAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Credential ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name for the credential
 *               value:
 *                 type: string
 *                 description: The actual credential value (API key)
 *               type:
 *                 type: string
 *                 enum: [OPENAI, ANTHROPIC, GEMINI]
 *                 description: Type of credential
 *     responses:
 *       200:
 *         description: Credential updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 type:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Bad request
 *       404:
 *         description: Credential not found
 *       401:
 *         description: Unauthorized
 */
credentialRouter.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { name, value, type } = req.body;

    // Validate type if provided (allows known types and custom types)
    if (type && !isValidCredentialType(type)) {
      throw new AppError(
        `Invalid type. Must be a known type (${Object.values(CredentialType).join(", ")}) or a custom type (uppercase, alphanumeric + underscore, 3-50 chars)`,
        400
      );
    }

    const credential = await credentialService.updateCredential(id, user.id, {
      name,
      value,
      type,
    });

    res.json(credential);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /credential/{id}:
 *   delete:
 *     summary: Delete a credential
 *     tags: [Credentials]
 *     security:
 *       - BetterAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Credential ID
 *     responses:
 *       200:
 *         description: Credential deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Credential deleted successfully
 *       400:
 *         description: Bad request (credential is in use)
 *       404:
 *         description: Credential not found
 *       401:
 *         description: Unauthorized
 */
credentialRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    await credentialService.deleteCredential(id, user.id);
    res.json({ message: "Credential deleted successfully" });
  } catch (error) {
    next(error);
  }
});
