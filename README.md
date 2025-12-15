# Verxio Deals API  
*On-chain loyalty infrastructure powering tokenized deals on Solana*

Build, sell, trade, and redeem loyalty vouchers — globally, instantly, and on-chain.

---

## What Is Verxio?

Verxio is the loyalty infrastructure layer for the internet.

- API-first protocol to mint tokenized loyalty cards and vouchers
- Pre-sell value to unlock instant cashflow (secured on Solana)
- Global marketplace where users discover, trade, and redeem the best loyalty deals

Think: Stripe for loyalty × Shopify for vouchers × a cashflow engine — powered by Solana.

---

## The Problem

Loyalty programs are broken:
- Consumers juggle fragmented apps and unused vouchers
- Billions in value expire unused every year
- Merchants wait months to realize revenue
- Small businesses face high tooling costs and zero liquidity
- No secondary markets = wasted value

---

## The Verxio Solution

### Loyalty, rebuilt as infrastructure
Verxio turns loyalty into a programmable, liquid, global asset class.

### Tokenized Loyalty Vouchers (NFTs)
- Verifiable ownership
- Immutable redemption history
- Fraud-proof by design
- Instant settlement with near-zero fees
- Transferable, giftable, tradable
- Built on Solana for speed and scale

### Yield-Bearing Loyalty Cards — a cashflow engine
- Customers preload value onto loyalty cards/vouchers
- Idle balances can earn yield
- Merchants receive pre-revenue cashflow instantly
- Funds arrive before redemption, not after
- Transparent on-chain accounting for audits and partners
- Users earn. Merchants get paid early. Everyone wins.

### Two-Sided Global Marketplace
**For Consumers**
- Discover loyalty deals worldwide
- Claim, redeem, trade, or gift vouchers
- Never lose value to expiry again

**For Merchants**
- Launch voucher collections in minutes
- Pre-sell loyalty cards to fund operations
- Track redemptions, balances, and performance in real time
- Reach a global audience instantly

### Secondary Markets (No More Waste)
- Peer-to-peer voucher trading
- Transfer or resell unused value
- Increased liquidity and utility
- Reduced expiration waste
- Loyalty becomes liquid, not locked.

### Merchant Toolkit
- Collection creation with IPFS image storage
- Batch voucher minting
- Inventory and expiry management
- Pre-sales for immediate liquidity
- Real-time analytics and dashboards
- API-first, platform-agnostic

---

## Market Impact

**Consumers**
- Global access to deals
- Trade unused value
- More transparency and trust

**Merchants**
- Instant cashflow
- Lower operational costs
- New revenue streams

**Ecosystem**
- Reduced waste
- Increased liquidity
- Open, interoperable loyalty economy

---

## Competitive Advantages
- First tokenized loyalty infrastructure on Solana
- Full lifecycle support: mint → sell → redeem → trade
- API-first and developer-friendly
- No blockchain knowledge required for end users
- High throughput, low fees
- Transparent, auditable, immutable

---

## What Is the Verxio Deals API?

Backend infrastructure powering the Verxio ecosystem. It enables:
- Tokenized voucher issuance
- On-chain redemption tracking
- Merchant & consumer flows
- Secure, API-key–protected access
- Express + Prisma–powered services

Links:
- Playground (devnet): https://playground.verxio.xyz
- Production: https://api.verxio.xyz
- GitHub (SDK): https://github.com/verxioprotocol

---

## Verxio Deals Client (Frontend)

The `client/` directory contains the Next.js 14 application that brings the Verxio experience to life.

**Features**
- **Marketplace / Explore**: Real collections (no mocks); filter by country, merchant, category, deal type; expiring-soon and global search
- **Deal Pages**: Live on-chain data; claim/disable logic; explorer links; redemption history
- **User Profile**: Wallet & balance; paginated vouchers; redeem/trade flows
- **Merchant Dashboard**: Create collections (Pinata uploads); manage supply & expiry; inventory and analytics
- **Auth & Data**: Privy authentication; Solana default chain; TanStack Query for instant refetches
- **UX Polish**: Responsive layouts; Verxio loaders; toasts, pagination, formatting everywhere

**Run Locally**
```bash
cd client
npm install
npm run dev   # or npm run build && npm start
```

---

## Final Thought

Verxio isn’t just a loyalty platform. It’s the loyalty infrastructure layer — a programmable cashflow engine that lets businesses sell the future, unlock liquidity today, and give users ownership of their loyalty.

Welcome to the future of deals. 💚
