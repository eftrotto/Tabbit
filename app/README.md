# Tabbit web app

Next.js (App Router) + Tailwind + Solana Wallet Adapter. Routes: `/` (landing), `/employer`, `/employee`, `/pay`, `/merchant`.

```bash
npm install          # at the repo root
cp app/.env.example app/.env.local
npm run dev          # builds @tabbit/sdk, then starts Next on :3000
npm test -w app      # mock client business rules
```

`NEXT_PUBLIC_USE_MOCK=true` (default) runs the whole demo in the browser with a simulated chain shared across tabs (employer, employee and restaurant personas; no wallet needed). Set it to `false` to use the real `@tabbit/sdk` against devnet.
