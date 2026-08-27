import { describe, expect, it } from "vitest";
import { validateAltanaProofCall } from "../src/domain/altana-proof.js";

describe("Altana proof call validation", () => {
  it("accepts calldata matching the granted selector", () => {
    expect(validateAltanaProofCall("deposit()", "0xd0e30db0", 10n, 10n)).toBe("0xd0e30db0");
  });

  it("rejects calldata for a different function", () => {
    expect(() => validateAltanaProofCall("deposit()", "0x12345678", 0n, 10n)).toThrow(
      "does not match",
    );
  });

  it("rejects a call value above the onchain spend cap", () => {
    expect(() => validateAltanaProofCall("deposit()", "0xd0e30db0", 11n, 10n)).toThrow(
      "exceeds",
    );
  });
});
