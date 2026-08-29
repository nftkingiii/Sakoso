import { BNB } from "@altananetwork/sdk";
import {
  createPublicClient,
  getAddress,
  http,
  keccak256,
  parseAbi,
  type Address,
  type Hex,
} from "viem";

export const ALTANA_EXPLORER = "https://explorer.altana.network";

const KEYSTORE_ABI = parseAbi([
  "function isValidKey(address user, bytes32 keyId) view returns (bool)",
]);

export type AltanaAuthorityRequest = {
  walletAddress: Address;
  publicKey: Hex;
};

export type AltanaAuthorityObservation = {
  walletAddress: Address;
  keyId: Hex;
  authorized: boolean;
  blockNumber: bigint;
};

export interface AltanaAuthoritySource {
  readAuthority(request: AltanaAuthorityRequest): Promise<AltanaAuthorityObservation>;
}

export function altanaAuthorityLinks(walletAddress: Address, keyId: Hex) {
  return {
    account: `${ALTANA_EXPLORER}/account/${walletAddress}`,
    key: `${ALTANA_EXPLORER}/key/${keyId}`,
    keyStore: `${BNB.explorer}/address/${BNB.keyStore}`,
  };
}

export class OnchainAltanaAuthoritySource implements AltanaAuthoritySource {
  private readonly client = createPublicClient({
    chain: BNB.chain,
    transport: http(BNB.publicRpcUrl, { retryCount: 1, timeout: 5_000 }),
  });

  async readAuthority(request: AltanaAuthorityRequest): Promise<AltanaAuthorityObservation> {
    const walletAddress = getAddress(request.walletAddress);
    const keyId = keccak256(request.publicKey);
    const blockNumber = await this.client.getBlockNumber();
    const authorized = await this.client.readContract({
      address: BNB.keyStore,
      abi: KEYSTORE_ABI,
      functionName: "isValidKey",
      args: [walletAddress, keyId],
      blockNumber,
    });

    return { walletAddress, keyId, authorized, blockNumber };
  }
}

export function altanaPublicConfig() {
  return {
    network: {
      name: "BNB Smart Chain Mainnet",
      chainId: BNB.chainId,
      rpcHost: new URL(BNB.publicRpcUrl).host,
    },
    contracts: {
      keyStore: BNB.keyStore,
      keyStoreController: BNB.keyStoreController,
    },
    explorer: {
      altana: ALTANA_EXPLORER,
      chain: BNB.explorer,
    },
  };
}
