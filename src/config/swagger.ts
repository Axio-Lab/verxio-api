import swaggerJsdoc from 'swagger-jsdoc';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Verxio Loyalty API',
    version: '1.0.0',
    description: `API documentation for Verxio's loyalty backend infrastructure.

## Authentication

Only the **Issue Verxio Credits** endpoint requires authentication using an API key. Include your API key in the request header:

\`\`\`
X-API-Key: your-api-key-here
\`\`\`

**Protected Endpoint** (authentication required):
- \`POST /user/issue-verxio\` - Issue Verxio credits to a user (requires admin API key from environment variables)
`,
    contact: {
      name: 'Verxio Protocol',
    },
  },
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: `Admin API Key for authentication.
        
Only required for POST /user/issue-verxio endpoint.`,
      },
      BetterAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-User-Email',
        description: `Better Auth authentication via user email header.
        
Required for all workflow endpoints. This header should contain the authenticated user's email address from Better Auth session.`,
      },
    },
    schemas: {
      Node: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Node ID',
          },
          workflowId: {
            type: 'string',
            description: 'Workflow ID this node belongs to',
          },
          name: {
            type: 'string',
            description: 'Node name',
            example: 'Initial Node',
          },
          type: {
            type: 'string',
            enum: ['INITIAL'],
            description: 'Node type',
          },
          position: {
            type: 'object',
            properties: {
              x: {
                type: 'number',
                description: 'X coordinate',
              },
              y: {
                type: 'number',
                description: 'Y coordinate',
              },
            },
            description: 'Node position coordinates',
          },
          data: {
            type: 'object',
            description: 'Additional node data',
            additionalProperties: true,
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp',
          },
        },
      },
      Connection: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Connection ID',
          },
          workflowId: {
            type: 'string',
            description: 'Workflow ID this connection belongs to',
          },
          source: {
            type: 'string',
            description: 'Source node ID',
          },
          target: {
            type: 'string',
            description: 'Target node ID',
          },
          sourceHandle: {
            type: 'string',
            description: 'Output port name on source node',
            example: 'main',
            default: 'main',
          },
          targetHandle: {
            type: 'string',
            description: 'Input port name on target node',
            example: 'main',
            default: 'main',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp',
          },
        },
      },
      Workflow: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Workflow ID',
          },
          name: {
            type: 'string',
            description: 'Workflow name',
            example: 'Email Marketing Campaign',
          },
          userId: {
            type: 'string',
            description: 'User ID who owns the workflow',
          },
          nodes: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Node',
            },
            description: 'Nodes in the workflow',
          },
          connections: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Connection',
            },
            description: 'Connections between nodes in the workflow',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp',
          },
        },
      },
    },
  },
  tags: [
    // {
    //   name: 'Health',
    //   description: 'Health check endpoints',
    // },
    {
      name: 'User',
      description: 'User management and Verxio credit operations',
    },
    // {
    //   name: 'API Key',
    //   description: 'API key generation and management. Generate API keys to authenticate your requests.',
    // },
    {
      name: 'Loyalty Programs',
      description: 'create, update, and manage loyalty programs, issue loyalty passes, and award/revoke points',
    },
    {
      name: 'Loyalty Cards and Vouchers',
      description: 'create, mint, validate, redeem, cancel, and extend expiry of loyalty card and vouchers',
    },
    {
      name: 'Deals',
      description: 'create and manage deals (voucher collections with batch claim links)',
    },
    {
      name: 'Workflows',
      description: 'create, update, and manage workflows',
    },
  ],
};

const options: swaggerJsdoc.Options = {
  definition: swaggerDefinition,
  apis: ['./src/routes/*.ts', './src/index.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);

