## Verxio Deals (client)

Next.js + Tailwind client for the Verxio deal discovery platform.

### Run locally
1) From repo root:
```bash
cd client
npm install
npm run dev
```
2) Visit http://localhost:3000

### Pages scaffolded
- `/` Landing (hero, features, featured deals)
- `/explore` Marketplace browse + filters
- `/deals/[id]` Deal details with claim/trade CTAs
- `/trade` Peer-to-peer voucher trading
- `/profile` Wallet, vouchers, trades
- `/merchant` Merchant dashboard (create/manage/analytics placeholders)
- `/login` Privy login placeholder

### Theming
- Modern minimal marketplace palette (`primary #3B82F6`, `secondary #10B981`)
- Rounded XL cards, soft shadows, gradients for hero/CTA

### Next steps
- Wire Privy auth (login, wallet connect, session management)
- Replace mock data with Verxio API calls and Prisma-backed data
- Connect CTA buttons to real claim/redeem/trade flows
