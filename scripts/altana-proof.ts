import {
  BNB_TESTNET,
  createClient,
  signerFromPrivateKey,
  type GrantSessionResult,
} from "@altananetwork/sdk";
import {
  getAddress,
  keccak256,
  type Address,
  type Hex,
} from "viem";
import { z } from "zod";
import { validateAltanaProofCall } from "../src/domain/altana-proof.js";
import {
  ALTANA_TESTNET_EXPLORER,
  OnchainAltanaAuthoritySource,
  altanaAuthorityLinks,
} from "../src/integrations/altana.js";

const ProofEnvironmentSchema = z.object({
  ALTANA_ADMIN_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  ALTANA_PROOF_MODE: z.enum(["address", "prove"]).default("address"),
  ALTANA_ALLOWED_TARGET: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  ALTANA_ALLOWED_SIGNATURE: z.string().trim().min(3).max(200).optional(),
  ALTANA_CALL_DATA: z.string().regex(/^0x(?:[a-fA-F0-9]{2})*$/).optional(),
  ALTANA_CALL_VALUE_WEI: z.string().regex(/^[0-9]+$/).max(78).default("0"),
  ALTANA_SPEND_LIMIT_WEI: z.string().regex(/^[0-9]+$/).max(78).optional(),
  ALTANA_SESSION_SECONDS: z.coerce.number().int().min(600).max(86_400).default(3_600),
});

function requireProofValue(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required when ALTANA_PROOF_MODE=prove.`);
  return value;
}

function transactionUrl(transactionHash: Hex | undefined) {
  return transactionHash ? `${BNB_TESTNET.explorer}/tx/${transactionHash}` : null;
}

const environment = ProofEnvironmentSchema.parse(process.env);
const adminSigner = signerFromPrivateKey(environment.ALTANA_ADMIN_PRIVATE_KEY as Hex);
const client = createClient({ chains: [BNB_TESTNET] });
const wallet = await client.createWallet({ signer: adminSigner });

if (environment.ALTANA_PROOF_MODE === "address") {
  console.log(
    JSON.stringify(
      {
        walletAddress: wallet.address,
        chainId: BNB_TESTNET.chainId,
        faucet: "https://testnet.bnbchain.org/faucet-smart",
        chainExplorer: `${BNB_TESTNET.explorer}/address/${wallet.address}`,
        altanaExplorer: `${ALTANA_TESTNET_EXPLORER}/account/${wallet.address}`,
        note: "No transaction was submitted and no secret was printed.",
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const target = getAddress(
  requireProofValue(environment.ALTANA_ALLOWED_TARGET, "ALTANA_ALLOWED_TARGET"),
) as Address;
const signature = requireProofValue(
  environment.ALTANA_ALLOWED_SIGNATURE,
  "ALTANA_ALLOWED_SIGNATURE",
);
const callData = requireProofValue(environment.ALTANA_CALL_DATA, "ALTANA_CALL_DATA") as Hex;
const spendLimit = BigInt(
  requireProofValue(environment.ALTANA_SPEND_LIMIT_WEI, "ALTANA_SPEND_LIMIT_WEI"),
);
const callValue = BigInt(environment.ALTANA_CALL_VALUE_WEI);

validateAltanaProofCall(signature, callData, callValue, spendLimit);

const authoritySource = new OnchainAltanaAuthoritySource();
let session: GrantSessionResult | undefined;
let executeResult:
  | { callsId: Hex; transactionHash?: Hex; status: "PENDING" | "CONFIRMED" | "FAILED" }
  | undefined;
let revokeResult:
  | { callsId: Hex; transactionHash?: Hex; status: "PENDING" | "CONFIRMED" | "FAILED" }
  | undefined;
let failure: unknown;
let authorizedAfterGrant: boolean | undefined;
let authorizedAfterRevoke: boolean | undefined;

try {
  session = await client.grantSession({
    wallet,
    signer: adminSigner,
    permissions: {
      calls: [{ to: target, signature }],
      spend: [{ limit: spendLimit, period: "day" }],
    },
    expiry: Math.floor(Date.now() / 1_000) + environment.ALTANA_SESSION_SECONDS,
    register: true,
  });

  const observation = await authoritySource.readAuthority({
    walletAddress: wallet.address,
    publicKey: session.publicKey,
  });
  authorizedAfterGrant = observation.authorized;
  if (!authorizedAfterGrant) throw new Error("KeyStore did not confirm the granted session key.");

  executeResult = await client.execute({
    session,
    calls: [{ to: target, data: callData, value: callValue }],
  });
  if (executeResult.status !== "CONFIRMED") {
    throw new Error(`Session execution ended with status ${executeResult.status}.`);
  }
} catch (error) {
  failure = error;
} finally {
  if (session) {
    try {
      revokeResult = await client.revokeSession({ wallet, signer: adminSigner, session });
      if (revokeResult.status !== "CONFIRMED") {
        failure ??= new Error(`Session revocation ended with status ${revokeResult.status}.`);
      }
    } catch (error) {
      failure ??= error;
    }

    try {
      const observation = await authoritySource.readAuthority({
        walletAddress: wallet.address,
        publicKey: session.publicKey,
      });
      authorizedAfterRevoke = observation.authorized;
      if (authorizedAfterRevoke) {
        failure ??= new Error("KeyStore still reports the session key as authorized after revoke.");
      }
    } catch (error) {
      failure ??= error;
    }
  }
}

const keyId = session ? keccak256(session.publicKey) : undefined;
console.log(
  JSON.stringify(
    {
      walletAddress: wallet.address,
      chainId: BNB_TESTNET.chainId,
      scope: {
        target,
        signature,
        spendLimitWei: spendLimit.toString(),
        period: "day",
        expirySeconds: environment.ALTANA_SESSION_SECONDS,
      },
      session: session
        ? {
            keyId,
            authorizedAfterGrant,
            authorizedAfterRevoke,
            grantTransaction: transactionUrl(session.transactionHash),
            explorer: altanaAuthorityLinks(wallet.address, keyId as Hex),
          }
        : null,
      execution: executeResult
        ? {
            status: executeResult.status,
            callsId: executeResult.callsId,
            transaction: transactionUrl(executeResult.transactionHash),
          }
        : null,
      revocation: revokeResult
        ? {
            status: revokeResult.status,
            callsId: revokeResult.callsId,
            transaction: transactionUrl(revokeResult.transactionHash),
          }
        : null,
      sessionMaterialPersisted: false,
      success:
        !failure &&
        authorizedAfterGrant === true &&
        executeResult?.status === "CONFIRMED" &&
        revokeResult?.status === "CONFIRMED" &&
        authorizedAfterRevoke === false,
      error: failure instanceof Error ? failure.message : failure ? "Unknown proof failure." : null,
    },
    null,
    2,
  ),
);

if (failure || authorizedAfterRevoke !== false || revokeResult?.status !== "CONFIRMED") {
  process.exitCode = 1;
}
