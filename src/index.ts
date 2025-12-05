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
// import { apiKeyRouter } from './routes/apiKey';
import { swaggerSpec } from './config/swagger';

// Load environment variables
dotenv.config();

const app: express.Application = express();

// Security middleware
app.use(helmet());

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
const serverPort = process.env.PORT || '8080';
const serverOrigin = `http://localhost:${serverPort}`;

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow requests from the server itself (for Swagger UI)
    if (origin === serverOrigin || origin.startsWith(`http://localhost:${serverPort}`)) {
      return callback(null, true);
    }
    
    // Allow requests from allowed origins
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    
    // In development mode, allow all localhost origins
    if (process.env.NODE_ENV === 'development' && origin.includes('localhost')) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'X-API-Key'
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
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 CORS enabled for: ${allowedOrigins.join(', ')}, ${serverOrigin}`);
  console.log(`📍 Health check: http://localhost:${serverPort}/health`);
  console.log(`📚 API Documentation: http://localhost:${serverPort}`);
});

export default app;

