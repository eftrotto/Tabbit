<div align="start">

# Tabbit 

**Smart spending, verified.**
On-chain meal benefits. Employers fund in USDC, workers pay by QR, restaurants get paid in seconds. Built on Solana.

**[Live app](https://tabbit-sol.vercel.app)** · **[Live network (transparency)](https://tabbit-sol.vercel.app/transparency)** · **[Program on Solana Explorer](https://explorer.solana.com/address/Gs1shhurWMwnqzzjdxtMkYMcXwXYDbaSd6hP74JvEFBn?cluster=devnet)**

*Built for the [Colosseum Crypto World's Fair](https://colosseum.com/worldsfair) hackathon (Sep 14 – Oct 12, 2026).*

</div>

---

## The problem

Brazil's meal-voucher program (PAT) covers **22M+ workers** at **327k companies** and moves R$150–200B a year. Money flows through a handful of closed operator networks:

- Restaurants pay up to **3.6%** on every sale (the cap set by Decree 12.712/2025; before it, the average was 6–7%).
- Restaurants wait up to **15 days** to receive their money, a heavy cash-flow burden for small businesses.
- Spending rules are enforced by opaque, centralized systems nobody can audit.

The same decree mandates **open, interoperable networks** by Nov/2026, opening the market to new payment rails for the first time. Meal benefits exist in many countries (Italy's *buoni pasto*, France's *tickets-restaurant*, Korea's meal vouchers); Brazil is our first market.

## How it works

```
Employer ──deposit USDC──▶ Company vault (program-owned) ──allocate──▶ Employee balance
                                                                            │
                                                  scan restaurant QR ───────┘
                                                                            ▼
        program checks the rules: approved company, registered restaurant, per-meal and
        daily limits, meal hours in the company's timezone, official token, network not paused
                                                                            ▼
Restaurant wallet ◀──── USDC in the same transaction (0.8% fee to the treasury) ────┘
```

1. **The company** is approved by Tabbit, deposits USDC into its vault and sets each employee's balance and rules (one by one or from a spreadsheet).
2. **The employee** signs in with email or Google, scans the restaurant's QR code and pays. No wallet app, no seed phrase, no SOL: a wallet is created at login and Tabbit pays the network fee.
3. **The program enforces every rule** on-chain. If any rule fails, the whole transaction reverts and nothing is charged.
4. **The restaurant** receives USDC in the same transaction, about a second.
5. **Anyone can audit** the network live on the [transparency page](https://tabbit-sol.vercel.app/transparency) or on Solana Explorer.

Benefit money never sits in the employee's wallet. Their balance is a number in a program account, and the only place the vault can pay is a registered restaurant. A stolen employee login can buy, at most, a meal within the limits.

## What's built

| Who | What they get |
|---|---|
| **Employee** | Sign in with email, Google or SMS ([Privy](https://privy.io) embedded wallet); pay by QR with 0 SOL (gasless); balance, today's limit, history with refunds; **monthly statement**; install Tabbit on the phone's home screen; their wallet address, Explorer link and private-key export |
| **Company (HR)** | Register and wait for approval; vault (deposit / withdraw unallocated); add, edit, revoke employees; **import a spreadsheet** (CSV, Excel `;` and decimal comma) with per-line errors; **monthly top-up** for everyone; search, filters, pagination, CSV export; **monthly statement** per employee with CSV for PAT bookkeeping |
| **Restaurant** | Payment QR (fixed or with a preset amount) and a **printable counter poster**; today's sales updating live; gross, net and fees; **refund** a sale back to the employee |
| **Tabbit (platform)** | `/admin`: approve or suspend companies, register and toggle restaurants, emergency pause, fee-payer balance |
| **Visitors / judges** | "Try it as an employee": sign in and get a devnet demo benefit from a demo company, then pay a demo restaurant |
| **Anyone** | [`/transparency`](https://tabbit-sol.vercel.app/transparency): total paid, what restaurants saved vs the 3.6% market cap, **proof that vault balances cover every allocated benefit**, paid per day, latest payments appearing live |

## Try it

- **As an employee, in one minute:** open [tabbit-sol.vercel.app/employee](https://tabbit-sol.vercel.app/employee), sign in with email or Google and tap **Get my demo benefit**. A demo company gives you a test balance; pay any restaurant on the list. You need no wallet app and no SOL, and your payment shows up live on the transparency page.
- **Live network:** open [tabbit-sol.vercel.app/transparency](https://tabbit-sol.vercel.app/transparency). Every number links back to Solana Explorer.
- **Program on devnet:** [`Gs1shhur…JvEFBn`](https://explorer.solana.com/address/Gs1shhurWMwnqzzjdxtMkYMcXwXYDbaSd6hP74JvEFBn?cluster=devnet). Each payment's logs show a `PaymentMade` event; failed rule checks never land.
- **Every screen without a wallet:** run the app locally in demo mode (below). Each view acts as a demo persona: company, employee, restaurant and platform.

## On-chain vs off-chain

| On Solana (program `tabbit`) | Off-chain (Next.js app on Vercel) |
|---|---|
| Company vaults and their USDC | UI for the four roles |
| Employee balances and rules | `/api/sponsor`: co-signs payments as fee payer after strict validation |
| Restaurant registry, company approvals | `/api/network`: reads the chain once for all visitors of the transparency page |
| Every payment and its rule checks | Privy login (email / Google / SMS → embedded Solana wallet) |
| `PaymentMade` events (the audit trail) | `/api/directory`: employee names, emails and IDs in Postgres, opened only with a signature from the company wallet. Nothing about people goes on-chain (LGPD) |

## Security model

- **Non-custodial vaults.** Each vault is a token account owned by a program-derived address with no private key. Only the program can move it: to a registered restaurant (`pay`) or back to the company (`withdraw_unallocated`, unallocated funds only). Tabbit cannot touch company money; its treasury only receives the 0.8% fee.
- **Approved companies, official token.** Companies start pending; only the platform can approve them (`set_employer_approved`), and only approved companies can deposit or pay. The `Config` stores the official benefit token and `register_employer` rejects any other, so nobody can "pay" a restaurant with a worthless token of their own.
- **Fee payer that can't be drained.** Before co-signing, `/api/sponsor` checks that the transaction is exactly one Tabbit `pay` signed by the employee, plus idempotent creation of *that* payment's token accounts; the sponsor appears nowhere else. Everything else is rejected. It also rate-limits per employee and uses RPC preflight, so a rejected payment costs nothing.
- **Simulate before signing.** The SDK simulates every transaction first, so a broken rule shows a clear message and the wallet never asks to sign something that would fail.
- **Known limits (devnet MVP).** The platform key is a single key (next: a Squads multisig); the program is upgradeable; the fee payer's rate limit lives in server memory.

## Architecture

| Layer | Stack | Folder |
|---|---|---|
| On-chain program | Rust + Anchor 0.31 | `programs/tabbit` |
| Program tests | Anchor + Mocha (29 tests, incl. SDK end-to-end, fee payer and refunds) | `tests/` |
| Client SDK | TypeScript (`@tabbit/sdk`): typed client, PDAs, fee-payer validation, history scan | `sdk/` |
| Web app | Next.js 16 + React 19 + Tailwind 4, Solana Wallet Adapter, Privy | `app/` |
| Scripts | Devnet seed, key export, one-off migrations | `scripts/` |

### Program: `tabbit`

| Instruction | Signer | Description |
|---|---|---|
| `initialize(fee_bps, treasury)` | Platform | Create the global `Config` with the fee, treasury and official token |
| `set_mint()` | Platform | Set the official token (also migrates a `Config` created before that field existed) |
| `set_employer_approved(approved)` | Platform | Approve or suspend a company |
| `set_paused(paused)` | Platform | Emergency pause for every payment |
| `register_merchant(wallet, name, category)` | Platform | Add a restaurant |
| `set_merchant_active(active)` | Platform | Turn a restaurant on or off |
| `register_employer(name, tz_offset_minutes)` | Company | Create the company and its vault (official token only; starts pending) |
| `deposit(amount)` | Company | Fund the vault (approved companies only) |
| `upsert_employee(wallet, balance, max_per_meal, daily_cap, window)` | Company | Create or update an employee's balance and rules |
| `revoke_employee()` | Company | Return an employee's unused balance (e.g. termination) |
| `withdraw_unallocated(amount)` | Company | Withdraw funds not allocated to anyone |
| `pay(amount)` | Employee | Pay a meal: checks every rule, settles to the restaurant and treasury, emits `PaymentMade` |
| `refund(amount, reference)` | Restaurant | Send a payment back: restaurant → company vault, credits the employee's balance and today's spending, emits `RefundMade` with the refunded payment's signature |

Accounts (all PDAs): `Config` `["config"]`, `Employer` `["employer", owner]`, `EmployerApproval` `["approval", employer]`, `Employee` `["employee", employer, wallet]`, `Merchant` `["merchant", wallet]`.

## Run it locally

```bash
git clone https://github.com/eftrotto/tabbit.git && cd tabbit
npm install
npm run dev            # http://localhost:3000, demo mode: no wallet, no chain
```

Demo mode keeps everything in the browser and mirrors the program's rules, so every screen works offline. To use the real program, create `app/.env.local`:

| Variable | Needed for | Notes |
|---|---|---|
| `NEXT_PUBLIC_USE_MOCK=false` | Real devnet | Anything else (or unset) means demo mode |
| `NEXT_PUBLIC_RPC_URL` | Optional | Defaults to the public devnet RPC, which is slow and rate-limited; a Helius devnet URL is much better |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Employee login with email / Google | Public value. Without it, employees use Phantom |
| `DEMO_EMPLOYER_SECRET_KEY` | "Try it as an employee" | **Secret.** JSON array of the demo company owner's keypair (devnet only). Without it, the demo offer is hidden |
| `DATABASE_URL` | Employee names (directory) | **Secret.** Postgres URL (we use Neon). Run `npm run db:migrate -w app` once. Without it, names are hidden and everything else works |
| `SPONSOR_SECRET_KEY` | Gasless payments | **Secret.** JSON array of the fee-payer keypair (fund it with devnet SOL). Without it, employees pay their own fee |
| `NEXT_PUBLIC_WAITLIST_URL` | Optional | Waitlist form embedded on the landing |
| `NEXT_PUBLIC_RATE_BRL` / `NEXT_PUBLIC_RATE_EUR` | Optional | Display rate for local currency (default 5.4 / 0.92) |

### Program and tests

Needs Solana CLI 2.3.x and Anchor 0.31.1 (on Windows, use WSL).

```bash
anchor build && anchor test        # program + SDK end-to-end
npm test -w app                    # app logic: demo client, spreadsheet, transparency numbers
npm run seed                       # devnet demo data (keys go to keys/, never committed)
```

Team docs (Portuguese): [`docs/IMPLEMENTACAO.md`](docs/IMPLEMENTACAO.md) and [`docs/CARTEIRA-EMBUTIDA.md`](docs/CARTEIRA-EMBUTIDA.md).

## Deployments

| What | Where |
|---|---|
| Program `tabbit` (devnet) | [`Gs1shhurWMwnqzzjdxtMkYMcXwXYDbaSd6hP74JvEFBn`](https://explorer.solana.com/address/Gs1shhurWMwnqzzjdxtMkYMcXwXYDbaSd6hP74JvEFBn?cluster=devnet) |
| Benefit token (devnet test token) | [`4ZCy4DfmE9EfoPA1uipY6LxGe3ttVXFR91pta5vQxKJ5`](https://explorer.solana.com/address/4ZCy4DfmE9EfoPA1uipY6LxGe3ttVXFR91pta5vQxKJ5?cluster=devnet) |
| Web app | [tabbit-sol.vercel.app](https://tabbit-sol.vercel.app) |

## Roadmap

- [x] `tabbit` program with on-chain rules and full test suite
- [x] Devnet deployment
- [x] Company, employee and restaurant apps
- [x] Gasless payments (app as fee payer)
- [x] Employee login with email or Google (embedded wallet)
- [x] Company approval, official token, platform admin
- [x] Spreadsheet import and monthly top-up
- [x] Public transparency page with proof of reserves
- [x] "Try it as an employee" demo benefit for visitors
- [x] Refunds from the restaurant
- [x] Monthly statements for employees and companies
- [x] Installable app (PWA), printable counter poster, CI
- [x] Employee names, emails and IDs (off-chain directory, company-wallet signature)
- [ ] Email invites (wallet created before the employee's first login)
- [ ] Platform key in a Squads multisig
- [ ] Pilot with real restaurants in São Paulo
- [ ] Local-currency stablecoins (BRL) and off-ramp for restaurants
- [ ] Integration with licensed PAT operators after interoperability

## Team

- Bernado Nemrovsky
- Enzo Trotto
- Gabriel Firmamento
- Guilherme Firmeza
