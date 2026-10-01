<div align="start">

# Tabbit

**Smart spending, verified.**
On-chain meal benefits. Employers fund in USDC, workers pay by QR, restaurants get paid in seconds. Built on Solana.

**Live demo:** [tabbit-sol.vercel.app](https://tabbit-sol.vercel.app)

*Built for the [Colosseum Crypto World's Fair](https://colosseum.com/worldsfair) hackathon (Sep 14 – Oct 12, 2026).*

</div>

---

## The problem

Brazil's meal-voucher program (PAT) covers **22M+ workers** at **327k companies** and moves R$150–200B a year. Money flows through a handful of closed operator networks:

- Restaurants pay up to **3.6%** on every sale (the cap set by Decree 12.712/2025; before it, the average was 6–7%).
- Restaurants wait up to **15 days** to receive their money, a heavy cash-flow burden for small businesses.
- Spending rules are enforced by opaque, centralized systems nobody can audit.

The same decree mandates **open, interoperable networks** by Nov/2026, opening the market to new payment rails for the first time. Meal benefits exist in many countries (Italy's *buoni pasto*, France's *tickets-restaurant*, Korea's meal vouchers); Brazil is our first market.

### How it works

```
Employer ──deposit USDC──▶ Employer vault (PDA) ──allocate──▶ Worker balance
                                                                  │
                                           scan restaurant QR ────┘
                                                                  ▼
                 program checks rules (registered merchant, per-meal & daily limits, time window)
                                                                  ▼
Restaurant wallet ◀──── instant USDC settlement (−0.8% fee) ───────┘
```

1. **Employer** deposits USDC into its on-chain vault and sets each worker's balance and rules.
2. **Worker** opens the app, scans the restaurant's QR code and pays.
3. **The program enforces the rules**: registered merchants only, per-meal and daily limits, optional time window in the employer's timezone.
4. **Restaurant** receives USDC in its wallet in seconds.
5. **Everyone can audit** every transaction on Solana Explorer.

A worker can never send benefit money to an arbitrary wallet: the only possible destination is a registered merchant.

## Architecture

| Layer | Stack | Folder |
|---|---|---|
| On-chain program | Rust + Anchor 0.31 | `programs/tabbit` |
| Tests | Anchor + Mocha | `tests/` |
| Client SDK | TypeScript (`@tabbit/sdk`) | `sdk/` |
| Web app | Next.js + Tailwind + Solana Wallet Adapter | `app/` |

### Program: `tabbit`

| Instruction | Signer | Description |
|---|---|---|
| `initialize(fee_bps, treasury)` | Platform | Create global config |
| `register_employer(name, tz_offset_minutes)` | Employer | Create employer account and USDC vault |
| `deposit(amount)` | Employer | Deposit USDC into the vault |
| `upsert_employee(wallet, balance, max_per_meal, daily_cap, window)` | Employer | Create/update a worker's balance and rules |
| `revoke_employee()` | Employer | Return an unused balance (e.g. termination) |
| `withdraw_unallocated(amount)` | Employer | Withdraw unallocated funds |
| `register_merchant(wallet, name, category)` | Platform | Add a restaurant to the network |
| `set_merchant_active(active)` / `set_paused(paused)` | Platform | Operations and emergency pause |
| `pay(amount)` | Worker | Pay a meal; enforces all rules and emits `PaymentMade` |

## Getting started

> ⚠️ Work in progress.

```bash
git clone https://github.com/eftrotto/tabbit.git && cd tabbit
npm install

# Program (needs Solana CLI 2.3.x + Anchor 0.31.1)
anchor build
anchor test

# Web app
npm run dev
```

Team docs (Portuguese): [`docs/IMPLEMENTACAO.md`](docs/IMPLEMENTACAO.md).

## Deployments

| Network | Program | Address |
|---|---|---|
| Solana devnet | tabbit | [`Gs1shhurWMwnqzzjdxtMkYMcXwXYDbaSd6hP74JvEFBn`](https://explorer.solana.com/address/Gs1shhurWMwnqzzjdxtMkYMcXwXYDbaSd6hP74JvEFBn?cluster=devnet) |

## Roadmap

- [x] Concept and architecture
- [ ] `tabbit` program + full test suite
- [x] Devnet deployment
- [ ] Employer, worker and restaurant apps
- [ ] Gasless payments (app as fee payer)
- [ ] Pilot with real restaurants in São Paulo
- [ ] Local-currency stablecoins (BRL) and off-ramp for restaurants
- [ ] Integration with licensed PAT operators after interoperability

## Team

- Bernado Nemrovsky
- Enzo Trotto
- Gabriel Firmamento
- Guilherme Firmeza
