<div align="center">

# Tabbit

**On-chain meal benefits for Brazil.**
Employers fund in USDC, workers pay by QR, restaurants get paid in seconds. Built on Base.

*Built for the [Colosseum Crypto World's Fair](https://colosseum.com/worldsfair) hackathon (Sep 14 – Oct 12, 2026).*

</div>

---

## The problem

Brazil's meal-voucher program (PAT) covers **22M+ workers** at **327k companies**. Money flows through a handful of closed operator networks:

- Restaurants pay up to **3.6%** on every sale (the cap set by the Dec/2025 decree; before it, fees reached 15%).
- Restaurants wait up to **15 days** to receive their money, a heavy cash-flow burden for small businesses.
- Rules like "food only" and "lunch hours" are enforced by opaque, centralized systems nobody can audit.

The same decree mandates **interoperability** (rolling out through Nov/2026) and **worker portability**, opening the market to new payment rails for the first time.

### How it works

```
Employer ──deposit USDC──▶ Tabbit contract ──allocate──▶ Worker balance
                                                            │
                                     scan restaurant QR ────┘
                                                            ▼
                         contract checks PAT rules (restaurant, hours, limits)
                                                            ▼
Restaurant wallet ◀──── instant USDC settlement (−0.5% fee) ─┘
```

1. **Employer** deposits USDC and allocates monthly meal balances to employees.
2. **Worker** opens the app, scans the restaurant's QR code and pays. No wallet setup and no gas, thanks to Coinbase Smart Wallet and a paymaster.
3. **The contract enforces PAT rules**: registered restaurants only, allowed meal hours (Brasília time), per-meal and daily limits.
4. **Restaurant** receives USDC in its wallet in seconds.
5. **Everyone can audit** every transaction on BaseScan.

## Architecture

#preencher 

### Smart contract: `MealVoucher.sol`

| Function | Role | Description |
|---|---|---|
| `deposit(amount)` | Employer | Deposit USDC into the contract |
| `allocate(employee, amount)` | Employer | Credit a worker's meal balance |
| `revoke(employee)` | Employer | Return an unused balance (e.g. termination) |
| `registerRestaurant(addr, name)` | Admin | Add a restaurant to the network |
| `pay(restaurant, amount)` | Worker | Pay a meal; enforces all PAT rules |

Every state change emits an event, so the frontend builds full history straight from the chain.

## App screens

- **Employer dashboard**: fund the account, allocate balances, manage limits and restaurants.
- **Worker app** (mobile-first): balance in BRL, scan to pay, payment history.
- **Restaurant view**: generate a payment QR, see payments land in real time.

## Getting started

> ⚠️ Work in progress. Commands will be finalized as the code lands.

```bash
# Contracts
cd contracts
forge install
forge test

# Deploy to Base Sepolia (set PRIVATE_KEY and RPC_URL in .env; never commit it)
forge script script/Deploy.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast --verify

# Frontend
cd ../app
npm install
npm run dev
```

## Deployments

| Network | Contract | Address |
|---|---|---|
| Base Sepolia | MealVoucher | _TBD_ |

## Roadmap

- [x] Concept and architecture
- [ ] `MealVoucher.sol` + full test suite
- [ ] Base Sepolia deployment
- [ ] Employer, worker and restaurant apps
- [ ] Gasless payments with Smart Wallet + paymaster
- [ ] Pilot with real restaurants in São Paulo
- [ ] USDC → Pix off-ramp for restaurants (or BRL stablecoin)
- [ ] Integration with licensed PAT operators and new entrants after interoperability

## Team

Built by a Brazilian team for the Colosseum Crypto World's Fair.

## License

MIT
