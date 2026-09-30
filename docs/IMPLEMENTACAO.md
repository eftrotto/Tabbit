# Tabbit — Guia de Implementação (divisão entre 2 devs)

> Cole este arquivo inteiro no Claude Code (ou leia com calma) antes de começar. Ele tem o contexto do projeto, a divisão de trabalho e o **contrato de interface** que as duas metades precisam respeitar para juntar sem conflito.

## Status (30/09)

- [x] Repositório com a estrutura de pastas, `.gitignore`, `CODEOWNERS`, workspaces npm
- [x] **Contrato `sdk/src/types.ts` pronto** (seção 4.6). Não precisa mais criar no dia 1
- [x] SDK com `constants.ts`, `pda.ts`, `wallet.ts` e `client.ts` (este ainda é stub, lança erro)
- [x] Programa Anchor compilando: contas (`state.rs`), erros, evento e a instrução `initialize` como exemplo; IDL já copiada para `sdk/src/idl/tabbit.json`
- [x] Teste de exemplo em `tests/tabbit.ts`
- [ ] Dev A: as outras 9 instruções, testes, deploy, SDK real (seção 5)
- [ ] Dev B: criar o app em `app/` e as 3 visões (seção 6)

## Setup (os dois)

```bash
git clone https://github.com/eftrotto/tabbit.git
cd tabbit
npm install
```

Só o Dev A precisa do toolchain Solana: Rust estável, Solana CLI 2.3.x (`sh -c "$(curl -sSfL https://release.anza.xyz/v2.3.13/install)"`), Anchor 0.31.1 (`cargo install --git https://github.com/solana-foundation/anchor avm --force && avm install 0.31.1 && avm use 0.31.1`). No Windows, use WSL2 (Ubuntu); Anchor não roda bem no Windows nativo.

- `anchor build` deve compilar de primeira. **Não rode `cargo update`**: o `Cargo.lock` fixa `blake3 1.8.2` e `zeroize 1.8.x` porque as versões novas exigem Rust 1.85+ e o compilador da Solana 2.3 é 1.84.
- O `PROGRAM_ID` atual (`2Mh4bbby1Fu7zhdygoK634QgGaemQGsTg5vx8JHFjemF`) é provisório. No primeiro deploy o Dev A roda `anchor keys sync` (gera a chave dele e atualiza `lib.rs` e `Anchor.toml`) e atualiza `sdk/src/constants.ts`. A chave do programa (`target/deploy/tabbit-keypair.json`) **não vai para o git**; guardem com cuidado.

---

## 1. Contexto em 1 minuto

**Tabbit** ("Smart spending, verified.") é um vale-refeição em stablecoin na **Solana**. A empresa deposita o benefício num cofre on-chain, define regras por funcionário (limite por refeição, teto diário, janela de horário opcional) e o funcionário paga restaurantes credenciados por QR. O restaurante recebe **na hora**, pagando **0,8%** de taxa (as operadoras tradicionais cobram até 3,6% e pagam em até 15 dias). O funcionário nunca consegue mandar dinheiro para uma carteira qualquer: o único destino possível é restaurante credenciado.

- **Hackathon:** Colosseum, edição Brasil (Superteam Brasil). Trilha Solana.
- **Prazo final:** 12/10/2026 23h59 horário da Califórnia (= 03h59 de 13/10 em Brasília). **Nossa meta interna: tudo submetido em 11/10.**
- **Entrega:** produto funcionando + vídeo de 3 min + repositório na plataforma Colosseum.
- **Jurados avaliam:** produto, tração e plano de distribuição.
- **Rede:** Solana **devnet**. Custo zero (SOL de teste por faucet, USDC de teste da Circle).
- **Moeda na demo:** **USDC de teste** (6 casas decimais). O app mostra o valor convertido em moeda local (R$ por padrão). Produto é global; Brasil é o primeiro mercado.
- **Idioma:** código, nomes, README e UI em **inglês** (hackathon internacional). Comentários no código podem ser em português.
- **Identidade visual:** verde `#1EE88A` (ações), verde-petróleo escuro `#0B2B2B` (texto), fundo off-white `#FAF8F3`. Logo "Tabbit" com mascote verde.

Documento mestre completo (problema, mercado, pitch): https://claude.ai/code/artifact/928059a2-b33b-4dbd-ab78-eb1903fb9631

---

## 2. A divisão

A regra é simples: **cada dev é dono de pastas diferentes**. Ninguém edita pasta do outro. O único ponto de contato é o arquivo de contrato (`sdk/src/types.ts`), que **já está no repositório** e só muda por PR aprovado pelos dois.

| | **Dev A — On-chain + SDK** | **Dev B — App web** |
| --- | --- | --- |
| Entrega | Programa Anchor `tabbit`, testes, deploy na devnet, SDK TypeScript que o app usa | App Next.js com as 3 visões (empresa, funcionário, restaurante), QR, landing com lista de espera |
| Pastas donas | `programs/`, `tests/`, `sdk/`, `scripts/`, `Anchor.toml`, `Cargo.toml`, `Cargo.lock` | `app/` |
| Linguagem | Rust (Anchor) + TypeScript | TypeScript (React/Next.js) |
| Não depende do outro porque… | Testa tudo com testes automatizados, sem UI | Desenvolve contra um **cliente mock** que implementa a mesma interface do SDK; troca pelo real quando o A publicar |

**Pastas compartilhadas** (mudança só por PR revisado pelo outro): `sdk/src/types.ts`, `README.md`, `docs/`, `package.json` da raiz, `.github/`.

---

## 3. Estrutura do repositório

```
tabbit/
├── Anchor.toml                 (A)
├── Cargo.toml                  (A)  workspace Rust
├── package.json                (compartilhado) workspaces: ["sdk", "app"]
├── README.md                   (compartilhado) em inglês, para os jurados
├── .github/CODEOWNERS          (compartilhado)
├── docs/                       (compartilhado) roteiro do vídeo, arquitetura, prints
├── programs/tabbit/src/        (A) programa Anchor
│   ├── lib.rs
│   ├── state.rs                contas
│   ├── errors.rs
│   ├── events.rs
│   └── instructions/           um arquivo por instrução
├── tests/                      (A) testes do programa (anchor test / LiteSVM)
├── scripts/                    (A) deploy, seed da devnet, criar dados de demo
├── sdk/                        (A) pacote @tabbit/sdk
│   └── src/
│       ├── types.ts            *** CONTRATO *** (compartilhado)
│       ├── constants.ts        PROGRAM_ID, seeds, USDC_DEVNET_MINT
│       ├── pda.ts              funções find*Pda
│       ├── client.ts           TabbitClient real (implementa types.ts)
│       ├── idl/tabbit.json     IDL gerada pelo anchor build (copiada pelo script)
│       └── index.ts
└── app/                        (B) Next.js (App Router) + Tailwind
    └── src/
        ├── app/                rotas: /, /employer, /employee, /merchant, /pay
        ├── components/
        ├── lib/
        │   ├── tabbit.ts       escolhe cliente mock ou real (env NEXT_PUBLIC_USE_MOCK)
        │   ├── mock-client.ts  (B) implementa a interface de types.ts em memória
        │   └── currency.ts     conversão USDC → moeda local
        └── styles/
```

`.github/CODEOWNERS`:
```
/programs/  @DEV_A
/tests/     @DEV_A
/scripts/   @DEV_A
/sdk/       @DEV_A
/app/       @DEV_B
/sdk/src/types.ts  @DEV_A @DEV_B
```

---

## 4. O contrato de interface

Isto é a "fronteira" entre os dois. Se os dois respeitarem esta seção, o merge é só trocar o mock pelo cliente real.

### 4.1 Unidades e convenções

- Todo valor on-chain é **inteiro em unidades base do token** (USDC tem 6 casas: `1_000_000` = 1 USDC). No TypeScript, `bigint`.
- Tempo on-chain vem do `Clock` (UTC). Cada empresa guarda `tzOffsetMinutes` (Brasília = `-180`). Dia local = `floor((unix + tzOffset*60) / 86400)`. Minuto do dia = `((unix + tzOffset*60) % 86400) / 60`.
- Janela de horário: `windowStartMin` e `windowEndMin` em minutos do dia (0–1440). **Ambos 0 = sem janela.**
- Taxa em pontos-base: `feeBps = 80` = 0,8%. `fee = amount * feeBps / 10_000` (arredonda para baixo). Restaurante recebe `amount - fee`, tesouraria recebe `fee`.

### 4.2 Contas (PDAs)

| Conta | Seeds | Campos |
| --- | --- | --- |
| `Config` | `["config"]` | `authority: Pubkey`, `treasury: Pubkey`, `feeBps: u16`, `paused: bool`, `bump: u8` |
| `Employer` | `["employer", owner]` | `owner: Pubkey`, `name: String (≤32)`, `mint: Pubkey`, `vault: Pubkey`, `tzOffsetMinutes: i16`, `totalDeposited: u64`, `totalAllocated: u64`, `bump: u8` |
| `Employee` | `["employee", employer, wallet]` | `employer: Pubkey`, `wallet: Pubkey`, `balance: u64`, `maxPerMeal: u64`, `dailyCap: u64`, `spentToday: u64`, `lastSpendDay: i64`, `windowStartMin: u16`, `windowEndMin: u16`, `active: bool`, `bump: u8` |
| `Merchant` | `["merchant", wallet]` | `wallet: Pubkey`, `name: String (≤32)`, `category: u8`, `active: bool`, `bump: u8` |

- `vault` = token account associado (ATA) do mint, cujo dono é o PDA `Employer`.
- `category`: `0 = restaurant`, `1 = cafe`, `2 = grocery`, `3 = other`.

### 4.3 Instruções

| Instrução | Quem assina | Argumentos | Regras |
| --- | --- | --- | --- |
| `initialize` | plataforma | `feeBps: u16`, `treasury: Pubkey` | cria `Config`; só uma vez |
| `setPaused` | `config.authority` | `paused: bool` | |
| `registerEmployer` | empresa | `name: string`, `tzOffsetMinutes: i16` | conta `mint` passada nos accounts; cria `Employer` + `vault` |
| `deposit` | `employer.owner` | `amount: u64` | transfere do token account da empresa para o `vault`; `totalDeposited += amount` |
| `upsertEmployee` | `employer.owner` | `wallet: Pubkey`, `balance: u64`, `maxPerMeal: u64`, `dailyCap: u64`, `windowStartMin: u16`, `windowEndMin: u16` | cria ou atualiza; ajusta `totalAllocated`; falha se `totalAllocated > totalDeposited`; `active = true` |
| `revokeEmployee` | `employer.owner` | — | `totalAllocated -= balance`; `balance = 0`; `active = false` |
| `withdrawUnallocated` | `employer.owner` | `amount: u64` | só até `totalDeposited - totalAllocated`; `totalDeposited -= amount` |
| `registerMerchant` | `config.authority` | `wallet: Pubkey`, `name: string`, `category: u8` | cria `Merchant`, `active = true` |
| `setMerchantActive` | `config.authority` | `active: bool` | |
| `pay` | funcionário (`employee.wallet`) | `amount: u64` | checa: não pausado, funcionário ativo, merchant ativo, `amount ≤ maxPerMeal`, `amount ≤ balance`, reseta `spentToday` se mudou o dia, `spentToday + amount ≤ dailyCap`, dentro da janela (se houver). Transfere do `vault` para o ATA do merchant e a taxa para o ATA da tesouraria. `balance -= amount`, `totalAllocated -= amount`, `totalDeposited -= amount`. Emite `PaymentMade`. |

### 4.4 Erros (código Anchor, na ordem)

`Paused`, `Unauthorized`, `EmployeeInactive`, `MerchantInactive`, `ExceedsMaxPerMeal`, `ExceedsDailyCap`, `InsufficientBalance`, `OutsideTimeWindow`, `OverAllocated`, `InvalidAmount`, `NameTooLong`, `InvalidWindow`.

O app mostra mensagens amigáveis para cada um (ex.: `ExceedsDailyCap` → "Daily limit reached").

### 4.5 Evento

```
PaymentMade { employer: Pubkey, employee: Pubkey, merchant: Pubkey, amount: u64, fee: u64, timestamp: i64 }
```

### 4.6 `sdk/src/types.ts` (já criado; resumo abaixo, o arquivo é a fonte da verdade)

```ts
import type { PublicKey, TransactionSignature } from "@solana/web3.js";

export type Category = "restaurant" | "cafe" | "grocery" | "other";

export interface ConfigAccount {
  authority: PublicKey;
  treasury: PublicKey;
  feeBps: number;
  paused: boolean;
}

export interface EmployerAccount {
  address: PublicKey;          // PDA
  owner: PublicKey;
  name: string;
  mint: PublicKey;
  vault: PublicKey;
  tzOffsetMinutes: number;
  totalDeposited: bigint;
  totalAllocated: bigint;
}

export interface EmployeeAccount {
  address: PublicKey;          // PDA
  employer: PublicKey;         // PDA do Employer
  wallet: PublicKey;
  balance: bigint;
  maxPerMeal: bigint;
  dailyCap: bigint;
  spentToday: bigint;          // já "resetado" pelo SDK se o dia mudou
  windowStartMin: number;
  windowEndMin: number;
  active: boolean;
}

export interface MerchantAccount {
  address: PublicKey;          // PDA
  wallet: PublicKey;
  name: string;
  category: Category;
  active: boolean;
}

export interface Payment {
  signature: TransactionSignature;
  employer: PublicKey;
  employee: PublicKey;         // wallet do funcionário
  merchant: PublicKey;         // wallet do restaurante
  amount: bigint;
  fee: bigint;
  timestamp: number;           // unix seconds
}

export interface UpsertEmployeeInput {
  wallet: PublicKey;
  balance: bigint;
  maxPerMeal: bigint;
  dailyCap: bigint;
  windowStartMin?: number;     // default 0
  windowEndMin?: number;       // default 0 (sem janela)
}

export type TabbitErrorCode =
  | "Paused" | "Unauthorized" | "EmployeeInactive" | "MerchantInactive"
  | "ExceedsMaxPerMeal" | "ExceedsDailyCap" | "InsufficientBalance"
  | "OutsideTimeWindow" | "OverAllocated" | "InvalidAmount"
  | "NameTooLong" | "InvalidWindow";

export class TabbitError extends Error {
  constructor(public code: TabbitErrorCode, message?: string) { super(message ?? code); }
}

/** Interface que o app usa. O Dev A implementa de verdade; o Dev B implementa um mock. */
export interface TabbitClient {
  // leitura
  getConfig(): Promise<ConfigAccount>;
  getEmployer(owner: PublicKey): Promise<EmployerAccount | null>;
  listEmployees(employerOwner: PublicKey): Promise<EmployeeAccount[]>;
  getEmployeeByWallet(wallet: PublicKey): Promise<EmployeeAccount | null>; // MVP: 1 empresa por funcionário
  listMerchants(): Promise<MerchantAccount[]>;
  getMerchant(wallet: PublicKey): Promise<MerchantAccount | null>;
  listPayments(filter: { merchant?: PublicKey; employee?: PublicKey; employer?: PublicKey; limit?: number }): Promise<Payment[]>;
  onPayment(cb: (p: Payment) => void): () => void; // retorna função para cancelar

  // escrita (a carteira conectada assina)
  registerEmployer(input: { name: string; mint: PublicKey; tzOffsetMinutes: number }): Promise<TransactionSignature>;
  deposit(amount: bigint): Promise<TransactionSignature>;
  upsertEmployee(input: UpsertEmployeeInput): Promise<TransactionSignature>;
  revokeEmployee(wallet: PublicKey): Promise<TransactionSignature>;
  withdrawUnallocated(amount: bigint): Promise<TransactionSignature>;
  registerMerchant(input: { wallet: PublicKey; name: string; category: Category }): Promise<TransactionSignature>;
  setMerchantActive(wallet: PublicKey, active: boolean): Promise<TransactionSignature>;
  pay(input: { merchant: PublicKey; amount: bigint }): Promise<TransactionSignature>;
}
```

O SDK real é criado assim (o app só usa isto):

```ts
import { createTabbitClient } from "@tabbit/sdk";
const client = createTabbitClient({ connection, wallet }); // wallet do @solana/wallet-adapter
```

### 4.7 QR de pagamento (dono: Dev B, lido por A só na documentação)

Conteúdo do QR do restaurante: `https://<app>/pay?merchant=<walletBase58>&amount=<opcional, em USDC decimal>`. Abre a tela `/pay` do funcionário já com o restaurante preenchido.

---

## 5. Tarefas do Dev A — On-chain + SDK

Ambiente: Rust, Solana CLI (Agave 2.x), Anchor 0.31+, Node 20+. Carteira de dev com SOL de devnet (`solana airdrop 2` ou https://faucet.solana.com). Se a instalação local travar, dá para compilar e publicar pelo **Solana Playground** (https://beta.solpg.io), no navegador.

1. ~~Criar o repositório, workspaces, `CODEOWNERS` e `types.ts`~~ **feito**.
2. Programa: `state.rs`, `errors.rs`, `events.rs` e `initialize` já existem. Faltam as outras 9 instruções da seção 4.3, cada uma em `programs/tabbit/src/instructions/<nome>.rs`.
3. Testes cobrindo: fluxo feliz; `pay` acima de `maxPerMeal`; acima de `dailyCap`; reset do teto no dia seguinte; fora da janela (com fuso -180); merchant inativo; funcionário revogado; pausa; `upsertEmployee` que passa do depositado; taxa indo para a tesouraria.
4. Deploy na devnet. Anotar `PROGRAM_ID` em `sdk/src/constants.ts` e no README.
5. `scripts/seed-devnet.ts`: cria Config (feeBps 80), 1 empresa demo, 3 restaurantes demo, 2 funcionários com saldo. Salvar as chaves de demo **fora do git**.
6. SDK real: `pda.ts`, `client.ts` implementando `TabbitClient`, conversão dos erros Anchor para `TabbitError`, `listPayments` lendo eventos `PaymentMade` das transações, `onPayment` via `connection.onLogs`.
7. Extra se sobrar tempo: fee payer do app (funcionário sem SOL).

**Pronto quando:** `anchor test` verde, programa na devnet, `seed-devnet` roda do zero, e o B troca `NEXT_PUBLIC_USE_MOCK=false` e tudo funciona.

---

## 6. Tarefas do Dev B — App web

Stack: Next.js (App Router) + TypeScript + Tailwind, `@solana/wallet-adapter-react` (Phantom), `@solana/web3.js`, `qrcode.react` para gerar QR e `@yudiel/react-qr-scanner` (ou similar) para ler. Deploy na Vercel (grátis).

1. **Dia 1:** criar o app **dentro de `app/`** (na raiz do repo: `npx create-next-app@latest app --ts --tailwind --app --src-dir --eslint --no-import-alias`), no `app/package.json` adicionar a dependência `"@tabbit/sdk": "*"` (vem do workspace) e rodar `npm install` na raiz. Layout com a identidade visual, conexão com Phantom (devnet). O app importa os tipos com `import type { TabbitClient } from "@tabbit/sdk"`.
2. `lib/mock-client.ts`: implementa `TabbitClient` em memória, com dados de exemplo e as mesmas regras de negócio (para a UI mostrar os erros certos). `lib/tabbit.ts` escolhe mock ou real pela env `NEXT_PUBLIC_USE_MOCK`.
3. **Visão Empresa (`/employer`):** registrar empresa, depositar USDC, tabela de funcionários, adicionar/editar (saldo, limite por refeição, teto diário, janela), revogar, saldo do cofre (depositado vs. alocado).
4. **Visão Funcionário (`/employee` e `/pay`), mobile first:** saldo, quanto ainda pode gastar hoje, botão "Scan to pay", lista de restaurantes, tela de confirmação, recibo com link para o Solana Explorer (`https://explorer.solana.com/tx/<sig>?cluster=devnet`).
5. **Visão Restaurante (`/merchant`):** QR fixo do restaurante, vendas do dia em tempo real (`onPayment`), total recebido e taxa paga.
6. **Landing (`/`):** o que é o Tabbit, botão para as 3 visões, formulário de lista de espera (pode ser Tally ou Google Forms embutido, grátis).
7. Seletor de moeda de exibição (R$, €, US$) em `lib/currency.ts`, com cotação fixa configurável para a demo.
8. Mensagens amigáveis para cada `TabbitErrorCode`.

**Pronto quando:** o fluxo da demo roda de ponta a ponta no mock, e depois no real: empresa deposita e configura João, João escaneia o QR e paga, a tela do restaurante atualiza na hora, o recibo abre no Explorer, e uma tentativa acima do limite aparece bloqueada.

---

## 7. Git sem conflito

- `main` protegida: só entra por PR. Cada um revisa o PR do outro (rápido, é só olhar se não mexeu em pasta alheia).
- Branches: `a/<assunto>` para o Dev A, `b/<assunto>` para o Dev B. Ex.: `a/pay-instruction`, `b/employer-view`.
- PRs pequenos e frequentes; **merge na `main` pelo menos uma vez por dia**, e `git pull origin main` antes de começar o dia.
- Commits no formato `feat(app): employer table`, `fix(program): daily cap reset`.
- Mudou `types.ts`? PR só com essa mudança, avisa o outro, os dois aprovam. O B atualiza o mock no mesmo dia.
- `package-lock.json`: só um de nós roda `npm install` na raiz por vez; se der conflito nele, apague e rode `npm install` de novo, nunca resolva na mão.
- Nunca commitar chaves (`*.json` de keypair, `.env`). `.gitignore` já no dia 1.

---

## 8. Cronograma

| Datas | Dev A | Dev B | Juntos |
| --- | --- | --- | --- |
| 30/09–01/10 | ~~repo, `types.ts`, esqueleto~~ (feito); setup local, instruções `register_employer`, `deposit`, `upsert_employee` | app base, Phantom, mock | marcar entrevistas com restaurantes |
| 02–03/10 | programa completo + testes | visão Empresa | |
| 04/10 | deploy devnet + seed | visão Funcionário + `/pay` | |
| 05–06/10 | SDK real | visão Restaurante + QR | **integração**: trocar mock pelo real |
| 07/10 | correções da integração | landing + lista de espera; deploy Vercel | piloto com 5–10 pessoas conhecidas |
| 08–09/10 | fee payer (extra), README técnico | polimento visual, recibo, erro bloqueado | cartas de intenção de restaurantes |
| 10/10 | | | roteiro e gravação do vídeo |
| 11/10 | | | **submissão completa** |
| 12/10 | | | reserva (prazo 23h59 PT = 03h59 de 13/10 em Brasília) |

Tração é dos dois: meta de 15 restaurantes entrevistados, 3 cartas de intenção, 1 grupo piloto e 50 inscritos na lista de espera até 11/10.

---

## 9. Checklist da submissão

- [ ] Repositório público com README em inglês (o que é, arquitetura, `PROGRAM_ID`, como rodar, link do app)
- [ ] App publicado na Vercel apontando para a devnet
- [ ] Programa na devnet com transações reais do piloto
- [ ] Vídeo de 3 min (problema, por que agora, demo, tração, distribuição)
- [ ] Números de tração reais
- [ ] Submissão na plataforma Colosseum
