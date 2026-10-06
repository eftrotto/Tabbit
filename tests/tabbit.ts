// Testes do programa. Rodam num validador local via `anchor test`.
import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddressSync,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import { Tabbit } from "../target/types/tabbit";

const USDC = (n: number) => new BN(Math.round(n * 1_000_000));
const TZ_BRASILIA = -180;

describe("tabbit", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Tabbit as Program<Tabbit>;
  const connection = provider.connection;
  const platform = provider.wallet as anchor.Wallet;

  const treasury = Keypair.generate();
  const employerOwner = Keypair.generate();
  const joao = Keypair.generate();
  const maria = Keypair.generate();
  const outsider = Keypair.generate();
  const restaurant = Keypair.generate();
  const cafe = Keypair.generate();

  let mint: PublicKey;
  let ownerToken: PublicKey;
  let restaurantToken: PublicKey;
  let treasuryToken: PublicKey;

  const pda = (...seeds: (Buffer | Uint8Array)[]) =>
    PublicKey.findProgramAddressSync(seeds, program.programId)[0];
  const configPda = pda(Buffer.from("config"));
  const employerPda = pda(Buffer.from("employer"), employerOwner.publicKey.toBuffer());
  const employeePda = (wallet: PublicKey) =>
    pda(Buffer.from("employee"), employerPda.toBuffer(), wallet.toBuffer());
  const merchantPda = (wallet: PublicKey) => pda(Buffer.from("merchant"), wallet.toBuffer());
  let vault: PublicKey;

  async function airdrop(to: PublicKey, sol = 2) {
    const sig = await connection.requestAirdrop(to, sol * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, "confirmed");
  }

  async function balanceOf(ata: PublicKey) {
    return Number((await getAccount(connection, ata)).amount);
  }

  /** Espera que a promessa falhe com o erro Anchor informado. */
  async function expectError(p: Promise<unknown>, code: string) {
    try {
      await p;
    } catch (e: any) {
      const got = e?.error?.errorCode?.code ?? String(e);
      expect(got).to.contain(code);
      return;
    }
    expect.fail(`esperava erro ${code}`);
  }

  function pay(employeeKp: Keypair, merchantWallet: PublicKey, merchantToken: PublicKey, amount: BN) {
    return program.methods
      .pay(amount)
      .accountsPartial({
        payer: employeeKp.publicKey,
        config: configPda,
        employer: employerPda,
        employee: employeePda(employeeKp.publicKey),
        merchant: merchantPda(merchantWallet),
        vault,
        merchantToken,
        treasuryToken,
      })
      .signers([employeeKp])
      .rpc();
  }

  const approvalPda = pda(Buffer.from("approval"), employerPda.toBuffer());

  function deposit(amount: BN) {
    return program.methods
      .deposit(amount)
      .accountsPartial({ owner: employerOwner.publicKey, employer: employerPda, vault, ownerToken })
      .signers([employerOwner])
      .rpc();
  }

  function setApproved(approved: boolean) {
    return program.methods
      .setEmployerApproved(approved)
      .accountsPartial({ authority: platform.publicKey, config: configPda, employer: employerPda })
      .rpc();
  }

  function refund(merchantKp: Keypair, employeeWallet: PublicKey, amount: BN) {
    return program.methods
      .refund(amount, Array.from(Buffer.alloc(64, 7)))
      .accountsPartial({
        merchantWallet: merchantKp.publicKey,
        merchant: merchantPda(merchantKp.publicKey),
        employer: employerPda,
        employee: employeePda(employeeWallet),
        vault,
        merchantToken: getAssociatedTokenAddressSync(mint, merchantKp.publicKey),
      })
      .signers([merchantKp])
      .rpc();
  }

  function upsert(wallet: PublicKey, balance: BN, maxPerMeal: BN, dailyCap: BN, ws = 0, we = 0) {
    return program.methods
      .upsertEmployee(wallet, balance, maxPerMeal, dailyCap, ws, we)
      .accountsPartial({ owner: employerOwner.publicKey, employer: employerPda })
      .signers([employerOwner])
      .rpc();
  }

  before(async () => {
    for (const kp of [employerOwner, joao, maria, outsider]) await airdrop(kp.publicKey);

    // "USDC" de teste com 6 casas
    mint = await createMint(connection, platform.payer, platform.publicKey, null, 6);
    ownerToken = (await getOrCreateAssociatedTokenAccount(connection, platform.payer, mint, employerOwner.publicKey)).address;
    restaurantToken = (await getOrCreateAssociatedTokenAccount(connection, platform.payer, mint, restaurant.publicKey)).address;
    treasuryToken = (await getOrCreateAssociatedTokenAccount(connection, platform.payer, mint, treasury.publicKey)).address;
    await mintTo(connection, platform.payer, mint, ownerToken, platform.publicKey, 10_000 * 1_000_000);
    vault = getAssociatedTokenAddressSync(mint, employerPda, true);
  });

  it("initialize cria a Config com taxa de 0,8% e o token oficial", async () => {
    await program.methods.initialize(80, treasury.publicKey).accountsPartial({ mint }).rpc();
    const config = await program.account.config.fetch(configPda);
    expect(config.feeBps).to.equal(80);
    expect(config.mint.toBase58()).to.equal(mint.toBase58());
    expect(config.treasury.toBase58()).to.equal(treasury.publicKey.toBase58());
    expect(config.paused).to.equal(false);
  });

  it("registra empresa com cofre e fuso de Brasília", async () => {
    await program.methods
      .registerEmployer("Acme Ltda", TZ_BRASILIA)
      .accountsPartial({ owner: employerOwner.publicKey, employer: employerPda, mint, vault })
      .signers([employerOwner])
      .rpc();
    const e = await program.account.employer.fetch(employerPda);
    expect(e.name).to.equal("Acme Ltda");
    expect(e.vault.toBase58()).to.equal(vault.toBase58());
    expect(e.tzOffsetMinutes).to.equal(TZ_BRASILIA);
  });

  it("empresa com token próprio não consegue se cadastrar", async () => {
    const fakeOwner = Keypair.generate();
    await airdrop(fakeOwner.publicKey);
    const fakeMint = await createMint(connection, fakeOwner, fakeOwner.publicKey, null, 6);
    const fakeEmployer = pda(Buffer.from("employer"), fakeOwner.publicKey.toBuffer());
    await expectError(
      program.methods
        .registerEmployer("Golpe Ltda", TZ_BRASILIA)
        .accountsPartial({
          owner: fakeOwner.publicKey,
          employer: fakeEmployer,
          mint: fakeMint,
          vault: getAssociatedTokenAddressSync(fakeMint, fakeEmployer, true),
        })
        .signers([fakeOwner])
        .rpc(),
      "InvalidMint"
    );
  });

  it("empresa pendente não deposita; só a plataforma aprova", async () => {
    try {
      await deposit(USDC(1));
      expect.fail("deveria falhar");
    } catch (e: any) {
      // sem aprovação a conta ["approval", empresa] nem existe
      expect(String(e)).to.match(/AccountNotInitialized|not initialized|EmployerNotApproved/i);
    }
    await expectError(
      program.methods
        .setEmployerApproved(true)
        .accountsPartial({ authority: outsider.publicKey, config: configPda, employer: employerPda })
        .signers([outsider])
        .rpc(),
      "Unauthorized"
    );
    await setApproved(true);
    const approval = await program.account.employerApproval.fetch(approvalPda);
    expect(approval.approved).to.equal(true);
  });

  it("set_mint é só da plataforma e mantém a Config legível", async () => {
    await expectError(
      program.methods.setMint().accountsPartial({ authority: outsider.publicKey, mint }).signers([outsider]).rpc(),
      "Unauthorized"
    );
    await program.methods.setMint().accountsPartial({ authority: platform.publicKey, mint }).rpc();
    const config = await program.account.config.fetch(configPda);
    expect(config.mint.toBase58()).to.equal(mint.toBase58());
    expect(config.feeBps).to.equal(80);
  });

  it("deposita 1.000 USDC no cofre", async () => {
    await deposit(USDC(1000));
    expect(await balanceOf(vault)).to.equal(1000 * 1_000_000);
    const e = await program.account.employer.fetch(employerPda);
    expect(e.totalDeposited.toNumber()).to.equal(1000 * 1_000_000);
  });

  it("credencia restaurante e só a plataforma pode fazer isso", async () => {
    await program.methods
      .registerMerchant(restaurant.publicKey, "Cantina da Vila", 0)
      .accountsPartial({ authority: platform.publicKey, config: configPda, merchant: merchantPda(restaurant.publicKey) })
      .rpc();
    const m = await program.account.merchant.fetch(merchantPda(restaurant.publicKey));
    expect(m.active).to.equal(true);

    await expectError(
      program.methods
        .registerMerchant(cafe.publicKey, "Cafe Fake", 1)
        .accountsPartial({ authority: outsider.publicKey, config: configPda, merchant: merchantPda(cafe.publicKey) })
        .signers([outsider])
        .rpc(),
      "Unauthorized"
    );
  });

  it("não deixa alocar mais do que foi depositado", async () => {
    await expectError(upsert(joao.publicKey, USDC(1001), USDC(50), USDC(100)), "OverAllocated");
  });

  it("rejeita janela de horário inválida", async () => {
    await expectError(upsert(joao.publicKey, USDC(10), USDC(50), USDC(100), 900, 660), "InvalidWindow");
  });

  it("configura João com R$ 250, 40 por refeição e 60 por dia", async () => {
    await upsert(joao.publicKey, USDC(250), USDC(40), USDC(60));
    const emp = await program.account.employee.fetch(employeePda(joao.publicKey));
    expect(emp.balance.toNumber()).to.equal(250 * 1_000_000);
    expect(emp.active).to.equal(true);
    const e = await program.account.employer.fetch(employerPda);
    expect(e.totalAllocated.toNumber()).to.equal(250 * 1_000_000);
  });

  it("João paga 32: restaurante recebe 31,744 e a tesouraria 0,256 na hora", async () => {
    await pay(joao, restaurant.publicKey, restaurantToken, USDC(32));
    expect(await balanceOf(restaurantToken)).to.equal(31_744_000);
    expect(await balanceOf(treasuryToken)).to.equal(256_000);
    const emp = await program.account.employee.fetch(employeePda(joao.publicKey));
    expect(emp.balance.toNumber()).to.equal(218 * 1_000_000);
    expect(emp.spentToday.toNumber()).to.equal(32 * 1_000_000);
    const e = await program.account.employer.fetch(employerPda);
    expect(e.totalAllocated.toNumber()).to.equal(218 * 1_000_000);
    expect(e.totalDeposited.toNumber()).to.equal(968 * 1_000_000);
  });

  it("bloqueia pagamento acima do limite por refeição", async () => {
    await expectError(pay(joao, restaurant.publicKey, restaurantToken, USDC(41)), "ExceedsMaxPerMeal");
  });

  it("bloqueia quando passa do teto diário", async () => {
    // já gastou 32 hoje; 32 + 30 = 62 > 60
    await expectError(pay(joao, restaurant.publicKey, restaurantToken, USDC(30)), "ExceedsDailyCap");
  });

  it("bloqueia restaurante não credenciado", async () => {
    // cafe não está registrado: a conta Merchant não existe
    const cafeToken = (await getOrCreateAssociatedTokenAccount(connection, platform.payer, mint, cafe.publicKey)).address;
    try {
      await pay(joao, cafe.publicKey, cafeToken, USDC(5));
      expect.fail("deveria falhar");
    } catch (e: any) {
      expect(String(e)).to.match(/AccountNotInitialized|not initialized|does not exist/i);
    }
  });

  it("bloqueia restaurante descredenciado", async () => {
    await program.methods
      .setMerchantActive(false)
      .accountsPartial({ authority: platform.publicKey, config: configPda, merchant: merchantPda(restaurant.publicKey) })
      .rpc();
    await expectError(pay(joao, restaurant.publicKey, restaurantToken, USDC(5)), "MerchantInactive");
    await program.methods
      .setMerchantActive(true)
      .accountsPartial({ authority: platform.publicKey, config: configPda, merchant: merchantPda(restaurant.publicKey) })
      .rpc();
  });

  it("bloqueia fora da janela de horário", async () => {
    // janela de 1 minuto que com certeza não é agora (hora local de Brasília)
    const nowLocalMin = Math.floor((((Date.now() / 1000 + TZ_BRASILIA * 60) % 86400) + 86400) % 86400 / 60);
    const [ws, we] = nowLocalMin > 10 ? [1, 2] : [1000, 1001];
    await upsert(maria.publicKey, USDC(100), USDC(40), USDC(60), ws, we);
    await expectError(pay(maria, restaurant.publicKey, restaurantToken, USDC(10)), "OutsideTimeWindow");
  });

  it("paga dentro da janela quando ela cobre o horário atual", async () => {
    await upsert(maria.publicKey, USDC(100), USDC(40), USDC(60), 0, 1440);
    await pay(maria, restaurant.publicKey, restaurantToken, USDC(10));
  });

  it("empresa suspensa pela plataforma não paga", async () => {
    await setApproved(false);
    await expectError(pay(maria, restaurant.publicKey, restaurantToken, USDC(1)), "EmployerNotApproved");
    await setApproved(true);
  });

  it("pausa trava todos os pagamentos", async () => {
    await program.methods.setPaused(true).accountsPartial({ authority: platform.publicKey, config: configPda }).rpc();
    await expectError(pay(maria, restaurant.publicKey, restaurantToken, USDC(1)), "Paused");
    await program.methods.setPaused(false).accountsPartial({ authority: platform.publicKey, config: configPda }).rpc();
  });

  it("um funcionário não consegue gastar o saldo de outro", async () => {
    // outsider tenta usar a conta do João: o PDA é derivado da carteira que assina, então não bate
    try {
      await program.methods
        .pay(USDC(5))
        .accountsPartial({
          payer: outsider.publicKey,
          config: configPda,
          employer: employerPda,
          employee: employeePda(joao.publicKey),
          merchant: merchantPda(restaurant.publicKey),
          vault,
          merchantToken: restaurantToken,
          treasuryToken,
        })
        .signers([outsider])
        .rpc();
      expect.fail("deveria falhar");
    } catch (e: any) {
      expect(String(e)).to.match(/ConstraintSeeds|seeds constraint/i);
    }
  });

  it("restaurante estorna 10 de João: volta ao cofre, ao saldo e ao gasto do dia", async () => {
    await airdrop(restaurant.publicKey, 1);
    const before = {
      restaurant: await balanceOf(restaurantToken),
      vault: await balanceOf(vault),
      emp: await program.account.employee.fetch(employeePda(joao.publicKey)),
      employer: await program.account.employer.fetch(employerPda),
    };
    await refund(restaurant, joao.publicKey, USDC(10));
    expect(await balanceOf(restaurantToken)).to.equal(before.restaurant - 10_000_000);
    expect(await balanceOf(vault)).to.equal(before.vault + 10_000_000);
    const emp = await program.account.employee.fetch(employeePda(joao.publicKey));
    expect(emp.balance.toNumber()).to.equal(before.emp.balance.toNumber() + 10_000_000);
    expect(emp.spentToday.toNumber()).to.equal(before.emp.spentToday.toNumber() - 10_000_000);
    const e = await program.account.employer.fetch(employerPda);
    expect(e.totalDeposited.toNumber()).to.equal(before.employer.totalDeposited.toNumber() + 10_000_000);
    expect(e.totalAllocated.toNumber()).to.equal(before.employer.totalAllocated.toNumber() + 10_000_000);
  });

  it("só o próprio restaurante estorna, com o dinheiro dele", async () => {
    // outsider assina como se fosse o restaurante: a conta Merchant não bate com quem assina
    try {
      await program.methods
        .refund(USDC(1), Array.from(Buffer.alloc(64)))
        .accountsPartial({
          merchantWallet: outsider.publicKey,
          merchant: merchantPda(restaurant.publicKey),
          employer: employerPda,
          employee: employeePda(joao.publicKey),
          vault,
          merchantToken: restaurantToken,
        })
        .signers([outsider])
        .rpc();
      expect.fail("deveria falhar");
    } catch (e: any) {
      expect(String(e)).to.match(/ConstraintSeeds|Unauthorized|ConstraintTokenOwner|seeds/i);
    }
  });

  it("revoga João e devolve o saldo ao cofre", async () => {
    await program.methods
      .revokeEmployee()
      .accountsPartial({ owner: employerOwner.publicKey, employer: employerPda, employee: employeePda(joao.publicKey) })
      .signers([employerOwner])
      .rpc();
    const emp = await program.account.employee.fetch(employeePda(joao.publicKey));
    expect(emp.balance.toNumber()).to.equal(0);
    expect(emp.active).to.equal(false);
    await expectError(pay(joao, restaurant.publicKey, restaurantToken, USDC(5)), "EmployeeInactive");
    // funcionário revogado não recebe estorno: o saldo dele já voltou para a empresa
    await expectError(refund(restaurant, joao.publicKey, USDC(1)), "EmployeeInactive");
  });

  it("empresa saca só o que não está alocado", async () => {
    const e = await program.account.employer.fetch(employerPda);
    const free = e.totalDeposited.sub(e.totalAllocated);
    await expectError(
      program.methods
        .withdrawUnallocated(free.addn(1))
        .accountsPartial({ owner: employerOwner.publicKey, employer: employerPda, vault, ownerToken })
        .signers([employerOwner])
        .rpc(),
      "InsufficientBalance"
    );
    const before = await balanceOf(ownerToken);
    await program.methods
      .withdrawUnallocated(free)
      .accountsPartial({ owner: employerOwner.publicKey, employer: employerPda, vault, ownerToken })
      .signers([employerOwner])
      .rpc();
    expect(await balanceOf(ownerToken)).to.equal(before + free.toNumber());
  });

  it("outra carteira não mexe na empresa", async () => {
    try {
      await program.methods
        .deposit(USDC(1))
        .accountsPartial({ owner: outsider.publicKey, employer: employerPda, vault, ownerToken })
        .signers([outsider])
        .rpc();
      expect.fail("deveria falhar");
    } catch (e: any) {
      expect(String(e)).to.match(/ConstraintSeeds|Unauthorized|ConstraintTokenOwner|seeds/i);
    }
  });
});


