import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID, SEEDS } from "./constants";

export function findConfigPda(programId = PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from(SEEDS.config)], programId)[0];
}

export function findEmployerPda(owner: PublicKey, programId = PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from(SEEDS.employer), owner.toBuffer()], programId)[0];
}

export function findEmployeePda(employer: PublicKey, wallet: PublicKey, programId = PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.employee), employer.toBuffer(), wallet.toBuffer()],
    programId
  )[0];
}

export function findMerchantPda(wallet: PublicKey, programId = PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from(SEEDS.merchant), wallet.toBuffer()], programId)[0];
}

export function findApprovalPda(employer: PublicKey, programId = PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from(SEEDS.approval), employer.toBuffer()], programId)[0];
}
