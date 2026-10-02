# Carteira embutida para o funcionário (Privy) + checkout gasless

> Guia para quem for implementar. Escrito em 02/10 sobre o `main` no commit `9bc508f`. Nada disto está implementado ainda.

## Objetivo

O **funcionário** entra com e-mail, Google ou celular, ganha uma carteira Solana criada automaticamente e paga por QR **sem ter SOL e sem ver "conecte sua carteira"**.

**Empresa e restaurante continuam exatamente como hoje, pela Phantom.** Nada muda em `/employer` e `/merchant`.

Limite de tempo: **2 dias**. Se o Privy travar até lá, a demo segue com Phantom + fee payer (parte 1 abaixo), que já entrega o "gasless".

## O que já sabemos do código

- **O programa não muda.** Em `programs/tabbit/src/instructions/pay.rs`, o `payer` (funcionário) é `Signer` sem `mut`: só assina e não paga nada. Outra conta pode pagar a taxa da transação sem redeploy.
- **Hoje o checkout NÃO é gasless.** Em `sdk/src/client.ts`, `send()` faz `tx.feePayer = me()` e `pay()` cria as contas de token do restaurante e da tesouraria com o funcionário pagando o aluguel. Uma carteira embutida nasce com 0 SOL, então **sem a parte 1 o pagamento falha**.
- **`sdk/src/types.ts` (o contrato) não muda.** A opção nova entra em `CreateTabbitClientOptions`, em `client.ts`.

## Parte 1: fee payer (feito em 02/10, branch `a/fee-payer`)

> Implementado: `sdk/src/sponsor.ts` (`validateSponsoredPay`), opção `sponsor` em `createTabbitClient`, rota `app/src/app/api/sponsor/route.ts` e `app/src/lib/sponsor.ts`. O app só usa o patrocinador na visão do funcionário e só se `GET /api/sponsor` responder (sem `SPONSOR_SECRET_KEY`, tudo segue como antes). Rate limit: 5 pagamentos por minuto por funcionário, em memória (vale por instância do servidor).

Vale até com Phantom e cumpre a promessa "gasless" do pitch.

### 1.1 SDK (`sdk/src/client.ts`)

Nova opção:

```ts
export interface CreateTabbitClientOptions {
  connection: Connection;
  wallet?: AnchorWallet;
  /** Quando definido, o patrocinador paga taxa e aluguel em `pay`. */
  sponsor?: {
    publicKey: PublicKey;
    /** Recebe a transação já assinada pelo funcionário, co-assina, envia e devolve a assinatura. */
    signAndSend(tx: Transaction): Promise<TransactionSignature>;
  };
}
```

Em `pay()`:

- `createAssociatedTokenAccountIdempotentInstruction(sponsor.publicKey, ...)` para as duas contas de token (o patrocinador paga o aluguel).
- `tx.feePayer = sponsor.publicKey`, `recentBlockhash` buscado na hora.
- Simular como hoje (mantém os erros tipados do `TabbitError`).
- `wallet.signTransaction(tx)` (assinatura parcial do funcionário) e depois `sponsor.signAndSend(tx)`.

Sem `sponsor`, tudo continua como está. Só `pay` usa o patrocinador; as outras instruções são da empresa e da plataforma, que têm SOL.

Teste: um caso novo em `tests/` com um funcionário de 0 SOL pagando via patrocinador.

### 1.2 Rota do patrocinador (`app/src/app/api/sponsor/route.ts`)

- Chave de devnet em env da Vercel: `SPONSOR_SECRET_KEY` (nunca no git, nunca `NEXT_PUBLIC_`). Abastecer com `solana airdrop` / faucet.
- Recebe a transação serializada (base64), e **antes de assinar confere**:
  - `feePayer` é o patrocinador;
  - as instruções são só `createAssociatedTokenAccountIdempotent` + `pay` do `PROGRAM_ID` do Tabbit;
  - o patrocinador não aparece em nenhuma outra instrução como pagador/origem de fundos (só como funder das contas de token).
- Assina, envia, confirma e devolve `{ signature }`.

Essa conferência impede que alguém use a chave para outra coisa. Em devnet o prejuízo seria só SOL de teste, mas é a primeira pergunta de um jurado técnico.

`GET /api/sponsor` pode devolver a chave pública do patrocinador para o app montar o cliente.

> Alternativa: o Privy anuncia patrocínio de taxa nativo para Solana. Não foi verificado se funciona na devnet nem no plano grátis, então o plano não depende disso.

## Parte 2: Privy só para o funcionário (feito em 02/10, branch `b/privy-employee`)

> Implementado em `app/src/lib/employee-wallet.tsx` (provider, adaptador Privy → `AnchorWallet` e contexto `useEmployeeLogin`), `EmployeeSignIn` em `employee/shared.tsx`, botão de conta no `header.tsx` e cartão "Your wallet" (endereço, Explorer, exportar chave) no `/employee`. Envs: `NEXT_PUBLIC_PRIVY_APP_ID` (público). Testado na devnet: login com Google, carteira criada com 0 SOL, pagamento assinado pela carteira Privy e taxa paga pelo patrocinador.

### 2.1 Setup

- Criar app em https://dashboard.privy.io, habilitar login por **e-mail, Google e SMS**, carteiras embutidas **só Solana**, criadas automaticamente no login (`createOnLogin: "users-without-wallets"`).
- Domínios permitidos: `tabbit-sol.vercel.app`, `localhost:3000` e os previews da Vercel. Sem isso o login falha fora de produção.
- Env: `NEXT_PUBLIC_PRIVY_APP_ID`.
- `npm install @privy-io/react-auth` no workspace `app` (só uma pessoa por vez mexe no `package-lock.json`, ver `IMPLEMENTACAO.md` seção 7). O Privy v3 pede peers `@solana/kit` e `@solana-program/*`; instalar os que o npm reclamar.

### 2.2 Onde mexer

| O quê | Arquivo |
| --- | --- |
| `PrivyProvider` em volta do app (só Solana), por dentro do `ConnectionProvider` atual | `app/src/components/providers.tsx` |
| Adaptador: carteira Privy → `AnchorWallet` (`publicKey`, `signTransaction`, `signAllTransactions`) | novo `app/src/lib/privy-wallet.ts` |
| `useTabbit("employee")`: se houver usuário Privy logado, usa a carteira Privy + `sponsor`; senão, Phantom como hoje. `employer` e `merchant` **sempre** Phantom | `app/src/lib/tabbit.ts` |
| Botão "Sign in with email or Google" no lugar do `WalletMultiButton`, só nas telas do funcionário (com link pequeno "Use a wallet instead" para Phantom) | `app/src/app/(app)/employee/shared.tsx`, `app/src/components/header.tsx` |
| Mostrar o endereço da carteira com botão de copiar no `/employee` (a empresa precisa dele para cadastrar) | `app/src/app/(app)/employee/page.tsx` |

### 2.3 Ponto de atenção: web3.js v1 × `@solana/kit`

O app e o SDK usam `@solana/web3.js` v1; o Privy v3 trabalha com bytes / `@solana/kit`. O adaptador faz:

```
Transaction (v1) → tx.serialize({ requireAllSignatures: false }) → bytes
  → assinatura pelo Privy (useSignTransaction / wallet.signTransaction)
  → Transaction.from(bytesAssinados)
```

É o ponto mais provável de travar meio dia. Testar cedo com uma transação simples.

### 2.4 Modo mock

Nada muda: com `NEXT_PUBLIC_USE_MOCK` diferente de `false` ou sem `NEXT_PUBLIC_PRIVY_APP_ID`, o app funciona como hoje (personas da demo).

### 2.5 Peso

O Privy é grande. Carregar o provider só no grupo `(app)` (ou com `dynamic`) para não deixar a landing lenta.

## Fluxo final do funcionário

1. Abre `/employee`, entra com Google. O Privy cria a carteira.
2. Copia o endereço e manda para a empresa (na demo: o João entra antes da gravação e a empresa já cadastrou).
3. Escaneia o QR do restaurante com a câmera do celular. O link abre no Safari/Chrome normal, **onde a Phantom não funcionaria**, e o `/pay` funciona.
4. Confirma. A carteira Privy assina, o patrocinador paga a taxa, o restaurante recebe na hora.

## Fora do escopo agora

- **Cadastro por e-mail** (empresa digita `joao@empresa.com` e o Privy pré-gera a carteira). Melhor UX, mas exige chave secreta do Privy no servidor. +0,5 dia; só se sobrar tempo.
- Carteira embutida para empresa ou restaurante.

## Pronto quando

- [x] Funcionário com 0 SOL paga com Phantom via patrocinador (parte 1) — testado na devnet em 02/10
- [x] Rota recusa transação que não seja `pay` do Tabbit
- [x] Funcionário entra com Google e paga com 0 SOL (testado no navegador do computador; falta testar no celular pelo QR)
- [x] `/employer` e `/merchant` continuam só com Phantom
- [x] Mock continua funcionando sem Privy
- [ ] `anchor test`, `npm run build`, `lint` e `typecheck` do app verdes
