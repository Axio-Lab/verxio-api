#!/bin/bash
set -e

echo "=== Verxio Strapi - Railway Deployment ==="
echo ""

# Check Railway CLI
if ! command -v railway &> /dev/null; then
  echo "Railway CLI not found. Install: npm i -g @railway/cli"
  exit 1
fi

# Check auth
if ! railway whoami &> /dev/null; then
  echo "Not logged in. Running: railway login"
  railway login
fi

echo ""
echo "Step 1: Link to your Railway project"
echo "Select your Verxio project when prompted."
echo ""
railway link

echo ""
echo "Step 2: Generate secrets"
APP_KEY1=$(openssl rand -base64 32)
APP_KEY2=$(openssl rand -base64 32)
APP_KEY3=$(openssl rand -base64 32)
APP_KEY4=$(openssl rand -base64 32)
API_TOKEN_SALT=$(openssl rand -base64 32)
ADMIN_JWT_SECRET=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 32)
TRANSFER_TOKEN_SALT=$(openssl rand -base64 32)

echo "Secrets generated."
echo ""

echo "Step 3: Create Strapi service"
echo ""
echo "IMPORTANT: Before continuing, you need to manually do these steps in the Railway dashboard:"
echo ""
echo "  1. Go to your Railway project: https://railway.com/dashboard"
echo "  2. Click '+ New' > 'GitHub Repo' and select your repo"
echo "     OR click '+ New' > 'Empty Service'"
echo "  3. Set the Root Directory to: strapi"
echo "  4. Set Start Command to: npm run build && npm run start"
echo "  5. Add a new PostgreSQL database ('+' > 'Database' > 'PostgreSQL')"
echo "  6. Link the PostgreSQL to the Strapi service (reference variable: \${{Postgres.DATABASE_URL}})"
echo ""
echo "  7. Add these environment variables to the Strapi service:"
echo ""
echo "     HOST=0.0.0.0"
echo "     PORT=1337"
echo "     NODE_ENV=production"
echo "     APP_KEYS=${APP_KEY1},${APP_KEY2},${APP_KEY3},${APP_KEY4}"
echo "     API_TOKEN_SALT=${API_TOKEN_SALT}"
echo "     ADMIN_JWT_SECRET=${ADMIN_JWT_SECRET}"
echo "     JWT_SECRET=${JWT_SECRET}"
echo "     TRANSFER_TOKEN_SALT=${TRANSFER_TOKEN_SALT}"
echo "     DATABASE_URL=\${{Postgres.DATABASE_URL}}"
echo ""
echo "  8. Deploy the Strapi service"
echo "  9. Once deployed, note the public URL (e.g., https://strapi-production-xxxx.up.railway.app)"
echo ""
echo "After Strapi is deployed and running:"
echo "  10. Visit the Strapi admin panel at: <STRAPI_URL>/admin"
echo "  11. Create an admin account"
echo "  12. Go to Settings > API Tokens > Create new token:"
echo "      - Name: verxio-backend"
echo "      - Type: Full access"
echo "      - Copy the token"
echo ""
echo "  13. Add these env vars to your Verxio BACKEND service:"
echo "      - STRAPI_URL=<your-strapi-railway-url>"
echo "      - STRAPI_API_TOKEN=<the-full-access-token>"
echo ""
echo "  14. Add these env vars to your Next.js CLIENT service:"
echo "      - NEXT_PUBLIC_STRAPI_URL=<your-strapi-railway-url>"
echo "      - STRAPI_API_TOKEN=<the-full-access-token>"
echo "      - STRAPI_PAGES_URL=<your-client-url>/pages"
echo ""
echo "  15. Run prisma db push on the backend to add the STRAPI enum:"
echo "      cd backend && npx prisma db push"
echo ""
echo "  16. Add 'strapi-node' to your Pro plan features in Polar dashboard"
echo ""
echo "=== Done! ==="
