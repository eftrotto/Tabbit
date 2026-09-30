// Testes do programa. Dono: Dev A. Lista de casos a cobrir: IMPLEMENTACAO.md, seção 5.
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import { Tabbit } from "../target/types/tabbit";

describe("tabbit", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Tabbit as Program<Tabbit>;

  const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  it("initialize cria a Config", async () => {
    const treasury = anchor.web3.Keypair.generate().publicKey;
    await program.methods.initialize(80, treasury).rpc();

    const config = await program.account.config.fetch(configPda);
    expect(config.feeBps).to.equal(80);
    expect(config.treasury.toBase58()).to.equal(treasury.toBase58());
    expect(config.paused).to.equal(false);
  });
});
