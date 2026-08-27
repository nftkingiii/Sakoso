import { isHex, toFunctionSelector, type Hex } from "viem";

export function validateAltanaProofCall(
  signature: string,
  callData: Hex,
  callValue: bigint,
  spendLimit: bigint,
): Hex {
  if (!isHex(callData) || callData.length < 10) {
    throw new Error("ALTANA_CALL_DATA must include a 4-byte function selector.");
  }
  if (spendLimit <= 0n) throw new Error("ALTANA_SPEND_LIMIT_WEI must be positive.");
  if (callValue < 0n) throw new Error("ALTANA_CALL_VALUE_WEI cannot be negative.");
  if (callValue > spendLimit) throw new Error("Call value exceeds the declared session spend cap.");

  const allowedSelector = signature.startsWith("0x")
    ? signature.toLowerCase()
    : toFunctionSelector(signature).toLowerCase();
  if (!/^0x[a-f0-9]{8}$/.test(allowedSelector)) {
    throw new Error("ALTANA_ALLOWED_SIGNATURE must be a function signature or 4-byte selector.");
  }
  if (!callData.toLowerCase().startsWith(allowedSelector)) {
    throw new Error("ALTANA_CALL_DATA does not match ALTANA_ALLOWED_SIGNATURE.");
  }

  return allowedSelector as Hex;
}
