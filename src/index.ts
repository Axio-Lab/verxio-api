import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { userRouter } from './routes/user';
import { loyaltyRouter } from './routes/loyalty';
import { voucherRouter } from './routes/voucher';
import { dealRouter } from './routes/deal';
import { workflowRouter } from './routes/workflow';
// import { apiKeyRouter } from './routes/apiKey';
import { swaggerSpec } from './config/swagger';

// Load environment variables
dotenv.config();

const app: express.Application = express();

// Security middleware
app.use(helmet());

// CORS configuration
const defaultOrigins = [
  'http://localhost:3000',
  'https://deals.verxio.xyz',
  'https://playground.verxio.xyz',
  'https://api.verxio.xyz'
];
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || defaultOrigins;
const serverPort = '8080';
const serverOrigin = `http://localhost:${serverPort}`;

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman, etc.)
    if (!origin || origin === 'null') {
      return callback(null, true);
    }
    
    // Allow requests from the server itself (for Swagger UI in development)
    if (origin === serverOrigin || origin.startsWith(`http://localhost:${serverPort}`)) {
      return callback(null, true);
    }
    
    // Allow requests from production API domain (for Swagger UI)
    if (origin === 'https://api.verxio.xyz') {
      return callback(null, true);
    }
    
    // Allow requests from production playground domain
    if (origin === 'https://playground.verxio.xyz') {
      return callback(null, true);
    }
    
    // Allow requests from allowed origins (from environment variable)
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // In development mode, allow all localhost origins
    if (process.env.NODE_ENV === 'development' && origin.includes('localhost')) {
      return callback(null, true);
    }
    
    // Log rejected origin for debugging (only in non-production)
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`CORS: Rejected origin: ${origin}. Allowed origins: ${allowedOrigins.join(', ')}`);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'X-API-Key',
    'X-User-Email', 
    'Accept'
  ]
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate limiting
app.use(rateLimiter);

// API routes
// app.use('/health', healthRouter);
app.use('/user', userRouter);
app.use('/loyalty', loyaltyRouter);
app.use('/voucher', voucherRouter);
app.use('/deal', dealRouter);
app.use('/workflow', workflowRouter);
// app.use('/api-key', apiKeyRouter);

// API Documentation - only for exact root path (must be after other routes)
app.use('/', swaggerUi.serve);
app.get('/', swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Verxio API Documentation',
}));

// 404 handler for non-existent routes (must be before error handler)
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server

app.listen(serverPort, () => {
  console.log(`🚀 Verxio API Server running on port ${serverPort}`);
});

export default app;

