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
  ],
};

const options: swaggerJsdoc.Options = {
  definition: swaggerDefinition,
  apis: ['./src/routes/*.ts', './src/index.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);

