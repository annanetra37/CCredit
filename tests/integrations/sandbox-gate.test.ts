import { describe, expect, it } from "vitest";
import {
  MockRegistryClient,
  SandboxIssuanceBlockedError,
  assertNoSandboxAttributes,
} from "@/lib/integrations/registry-client";

/**
 * The gate that keeps a typed-in number from ever becoming a real
 * certificate. If this suite fails, stop the line.
 */
describe("sandbox never reaches a registry (§1.2)", () => {
  it("a batch containing one sandbox attribute is rejected entirely", () => {
    expect(() =>
      assertNoSandboxAttributes([
        { id: "a", mwh: 1, isSandbox: false },
        { id: "b", mwh: 1, isSandbox: true },
        { id: "c", mwh: 1, isSandbox: false },
      ]),
    ).toThrow(SandboxIssuanceBlockedError);
  });

  it("the error names the offending attributes", () => {
    try {
      assertNoSandboxAttributes([{ id: "bad-1", mwh: 1, isSandbox: true }]);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(SandboxIssuanceBlockedError);
      expect((e as SandboxIssuanceBlockedError).offendingAttributeIds).toEqual(["bad-1"]);
    }
  });

  it("the mock client enforces the gate exactly like a real one", async () => {
    const client = new MockRegistryClient();
    await expect(
      client.submitIssueRequest({
        siteRegistryCode: "AM-DEV-XYZ",
        periodLabel: "2026-01",
        attributes: [{ id: "a", mwh: 1.5, isSandbox: true }],
        evidenceDocumentKeys: [],
      }),
    ).rejects.toThrow(SandboxIssuanceBlockedError);
  });

  it("a clean production batch passes and receives serials", async () => {
    const client = new MockRegistryClient();
    const result = await client.submitIssueRequest({
      siteRegistryCode: "AM-DEV-XYZ",
      periodLabel: "2026-01",
      attributes: [
        { id: "a", mwh: 1.5, isSandbox: false },
        { id: "b", mwh: 2.0, isSandbox: false },
      ],
      evidenceDocumentKeys: ["vault/evidence-1.pdf"],
    });
    expect(result.serials).toHaveLength(2);
    expect(result.serials[0]!.serialNo).toMatch(/^AM-IREC-/);
  });
});
