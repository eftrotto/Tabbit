// Testa o SDK (@tabbit/sdk) de ponta a ponta contra o validador local.
// Roda depois de tests/tabbit.ts (que inicializa a Config).
import * as anchor from "@coral-xyz/anchor";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo, getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { expect } from "chai";
import { createTabbitClient, TabbitError } from "../sdk/src";
import type { AnchorWallet } from "../sdk/src";

function walletOf(kp: Keypair): AnchorWallet {
  const sign = <T extends Transaction | VersionedTransaction>(tx: T): T => {
    if (tx instanceof VersionedTransaction) tx.sign([kp]);
    else tx.partialSign(kp);
    return tx;
  };
  return {
    publicKey: kp.publicKey,
    signTransaction: async (tx) => sign(tx),
    signAllTransactions: async (txs) => txs.map(sign),
  };
}

describe("sdk", () => {
  const provider = anchor.AnchorProvider.env();
  const connection = provider.connection;
  const platform = provider.wallet as anchor.Wallet;

  const boss = Keypair.generate();
  const ana = Keypair.generate();
  const bistro = Keypair.generate();
  let mint: PublicKey;

  const U = (n: number) => BigInt(Math.round(n * 1_000_000));

  before(async () => {
    for (const kp of [boss, ana]) {
      const sig = await connection.requestAirdrop(kp.publicKey, 2 * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig, "confirmed");
    }
    mint = await createMint(connection, platform.payer, platform.publicKey, null, 6);
    const bossToken = await getOrCreateAssociatedTokenAccount(connection, platform.payer, mint, boss.publicKey);
    await mintTo(connection, platform.payer, mint, bossToken.address, platform.publicKey, Number(U(500)));
  });

  it("fluxo completo pelo SDK: empresa, restaurante, funcionário, pagamento e histórico", async () => {
    const asPlatform = createTabbitClient({ connection, wallet: walletOf(platform.payer) });
    const asBoss = createTabbitClient({ connection, wallet: walletOf(boss) });
    const asAna = createTabbitClient({ connection, wallet: walletOf(ana) });
    const readOnly = createTabbitClient({ connection });

    await asBoss.registerEmployer({ name: "Globex", mint, tzOffsetMinutes: -180 });
    await asBoss.deposit(U(200));
    await asPlatform.registerMerchant({ wallet: bistro.publicKey, name: "Bistro 22", category: "restaurant" });
    await asBoss.upsertEmployee({ wallet: ana.publicKey, balance: U(100), maxPerMeal: U(50), dailyCap: U(80) });

    const employer = await readOnly.getEmployer(boss.publicKey);
    expect(employer!.totalDeposited).to.equal(U(200));
    expect(employer!.totalAllocated).to.equal(U(100));
    expect((await readOnly.listEmployees(boss.publicKey)).length).to.equal(1);
    expect((await readOnly.listMerchants()).some((m) => m.wallet.equals(bistro.publicKey))).to.equal(true);

    // pagamento: cria a conta de token do restaurante automaticamente
    const received: bigint[] = [];
    const stop = readOnly.onPayment((p) => received.push(p.amount));
    const sig = await asAna.pay({ merchant: bistro.publicKey, amount: U(30) });
    expect(sig).to.be.a("string");

    const bistroToken = getAssociatedTokenAddressSync(mint, bistro.publicKey);
    expect((await getAccount(connection, bistroToken)).amount).to.equal(U(30) - U(0.24));

    const ana2 = await readOnly.getEmployeeByWallet(ana.publicKey);
    expect(ana2!.balance).to.equal(U(70));
    expect(ana2!.spentToday).to.equal(U(30));

    const history = await readOnly.listPayments({ merchant: bistro.publicKey });
    expect(history.length).to.equal(1);
    expect(history[0].amount).to.equal(U(30));
    expect(history[0].fee).to.equal(U(0.24));

    await new Promise((r) => setTimeout(r, 1500));
    stop();
    expect(received).to.include(U(30));

    // erro vira TabbitError com código tipado
    try {
      await asAna.pay({ merchant: bistro.publicKey, amount: U(51) });
      expect.fail("deveria falhar");
    } catch (e) {
      expect(e).to.be.instanceOf(TabbitError);
      expect((e as TabbitError).code).to.equal("ExceedsMaxPerMeal");
    }
  });
});
