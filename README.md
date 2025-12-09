# Verxio API - Loyalty Backend Server

Express-based API server for Verxio Loyalty Program infrastructure.

## Quick Start

1. **Install dependencies:**
```bash
pnpm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Generate Prisma client:**
```bash
pnpm db:generate
```

4. **Run in development:**
```bash
pnpm dev
```

5. **Build for production:**
```bash
pnpm build
pnpm start
```

## 📁 Project Structure

```
verxio-api/
├── src/
│   ├── index.ts              # Main server entry point
│   ├── middleware/          # Express middleware
│   │   ├── errorHandler.ts
│   │   ├── notFoundHandler.ts
│   │   └── rateLimiter.ts
│   ├── routes/              # API route handlers
│   │   └── health.ts
│   └── lib/                 # Shared utilities
│       ├── prisma.ts
│       └── config.ts
├── prisma/                  # Prisma schema (symlinked)
├── package.json
├── tsconfig.json
└── README.md
```

## 🔧 Available Scripts

- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm type-check` - Type check without building
- `pnpm db:generate` - Generate Prisma client
- `pnpm db:push` - Push schema to database
- `pnpm db:migrate` - Run database migrations
- `pnpm db:studio` - Open Prisma Studio


## 🛠️ Tech Stack

- **Runtime:** Node.js 20+
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** PostgreSQL (via Prisma)
- **Blockchain:** Solana
- **Authentication:** API Key
- **IPFS:** Pinata

