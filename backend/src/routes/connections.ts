import { Router, Request, Response, NextFunction } from "express";
import * as connectionService from "../services/connectionService";
import { betterAuthMiddleware } from "../middleware/betterAuth";
import { AppError } from "../middleware/errorHandler";
import { UserConnectionType } from "@prisma/client";

export const connectionRouter: Router = Router();

// Apply Better Auth middleware to all connection routes
connectionRouter.use(betterAuthMiddleware);

/**
 * @swagger
 * /connections:
 *   get:
 *     summary: Get connections for the authenticated user with pagination
 *     tags: [Connections]
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
 *           enum: [MCP_SERVER, DATABASE, DOCUMENTATION, API_ENDPOINT]
 *         description: Optional filter by connection type
 *       - in: query
 *         name: activeOnly
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Only return active connections
 *     responses:
 *       200:
 *         description: Paginated list of connections
 */
connectionRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const type = req.query.type as UserConnectionType | undefined;
    const activeOnly = req.query.activeOnly === "true";

    const result = await connectionService.getConnections(user.id, page, limit, type, activeOnly);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /connections:
 *   post:
 *     summary: Create a new connection
 *     tags: [Connections]
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
 *               - type
 *               - config
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [MCP_SERVER, DATABASE, DOCUMENTATION, API_ENDPOINT]
 *               config:
 *                 type: object
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Connection created successfully
 */
connectionRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { name, description, type, config, metadata } = req.body;

    if (!name || !type || !config) {
      throw new AppError("Name, type, and config are required", 400);
    }

    // Validate type
    const validTypes: UserConnectionType[] = [
      "MCP_SERVER",
      "DATABASE",
      "DOCUMENTATION",
      "API_ENDPOINT",
    ];
    if (!validTypes.includes(type)) {
      throw new AppError(`Invalid type. Must be one of: ${validTypes.join(", ")}`, 400);
    }

    const connection = await connectionService.createConnection({
      name,
      description,
      type,
      config,
      metadata,
      userId: user.id,
    });

    res.status(201).json(connection);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /connections/{id}:
 *   get:
 *     summary: Get a single connection by ID
 *     tags: [Connections]
 *     security:
 *       - BetterAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Connection details
 */
connectionRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const connection = await connectionService.getConnection(id, user.id);
    res.json(connection);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /connections/{id}:
 *   put:
 *     summary: Update a connection
 *     tags: [Connections]
 *     security:
 *       - BetterAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [MCP_SERVER, DATABASE, DOCUMENTATION, API_ENDPOINT]
 *               config:
 *                 type: object
 *               metadata:
 *                 type: object
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Connection updated successfully
 */
connectionRouter.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { name, description, type, config, metadata, isActive } = req.body;

    // Validate type if provided
    if (type) {
      const validTypes: UserConnectionType[] = [
        "MCP_SERVER",
        "DATABASE",
        "DOCUMENTATION",
        "API_ENDPOINT",
      ];
      if (!validTypes.includes(type)) {
        throw new AppError(`Invalid type. Must be one of: ${validTypes.join(", ")}`, 400);
      }
    }

    const connection = await connectionService.updateConnection(id, user.id, {
      name,
      description,
      type,
      config,
      metadata,
      isActive,
    });

    res.json(connection);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /connections/{id}:
 *   delete:
 *     summary: Delete a connection
 *     tags: [Connections]
 *     security:
 *       - BetterAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Connection deleted successfully
 */
connectionRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    await connectionService.deleteConnection(id, user.id);
    res.json({ message: "Connection deleted successfully" });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /connections/{id}/test:
 *   post:
 *     summary: Test a connection
 *     tags: [Connections]
 *     security:
 *       - BetterAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Connection test result
 */
connectionRouter.post("/:id/test", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const result = await connectionService.testConnection(id, user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /connections/{id}/toggle:
 *   post:
 *     summary: Toggle connection active status
 *     tags: [Connections]
 *     security:
 *       - BetterAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Connection status toggled
 */
connectionRouter.post("/:id/toggle", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    // Get current connection
    const connection = await connectionService.getConnection(id, user.id);

    // Toggle active status
    const updated = await connectionService.updateConnection(id, user.id, {
      isActive: !connection.isActive,
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /connections/mcp/active:
 *   get:
 *     summary: Get all active MCP server connections for the user
 *     tags: [Connections]
 *     security:
 *       - BetterAuth: []
 *     responses:
 *       200:
 *         description: List of active MCP server connections
 */
connectionRouter.get("/mcp/active", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const connections = await connectionService.getActiveMcpConnections(user.id);
    res.json({ connections });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /connections/database/active:
 *   get:
 *     summary: Get all active database connections for the user
 *     tags: [Connections]
 *     security:
 *       - BetterAuth: []
 *     responses:
 *       200:
 *         description: List of active database connections
 */
connectionRouter.get(
  "/database/active",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const connections = await connectionService.getActiveDatabaseConnections(user.id);
      res.json({ connections });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /connections/documentation/search:
 *   post:
 *     summary: Search documentation connections
 *     tags: [Connections]
 *     security:
 *       - BetterAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *               connectionIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Search results
 */
connectionRouter.post(
  "/documentation/search",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { query, connectionIds } = req.body;

      if (!query) {
        throw new AppError("Query is required", 400);
      }

      const results = await connectionService.searchDocumentation(user.id, query, connectionIds);
      res.json({ results });
    } catch (error) {
      next(error);
    }
  }
);
