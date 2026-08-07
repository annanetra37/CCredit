/**
 * E-signature integration (S2-3). Provider-agnostic: the portal sends a
 * rendered agreement out for signature and a webhook confirms completion
 * with signatory name, timestamp and IP. The signed PDF is then pulled into
 * OUR vault — never left with the provider.
 */

export interface SignatureRequest {
  contractId: string;
  signerName: string;
  signerEmail: string;
  documentPdf: Buffer;
}

export interface SignatureCompletion {
  contractId: string;
  signatoryName: string;
  signedAt: Date;
  signatoryIp: string;
  signedPdf: Buffer;
}

export interface ESignProvider {
  requestSignature(req: SignatureRequest): Promise<{ envelopeId: string }>;
  /** Verify + parse the provider webhook. Throws on bad signature. */
  parseWebhook(rawBody: string, signatureHeader: string): SignatureCompletion;
}

export class MockESignProvider implements ESignProvider {
  async requestSignature(req: SignatureRequest): Promise<{ envelopeId: string }> {
    return { envelopeId: `mock-env-${req.contractId}` };
  }

  parseWebhook(rawBody: string): SignatureCompletion {
    const parsed = JSON.parse(rawBody) as {
      contractId: string;
      signatoryName: string;
      signedAt: string;
      signatoryIp: string;
      signedPdfBase64: string;
    };
    return {
      contractId: parsed.contractId,
      signatoryName: parsed.signatoryName,
      signedAt: new Date(parsed.signedAt),
      signatoryIp: parsed.signatoryIp,
      signedPdf: Buffer.from(parsed.signedPdfBase64, "base64"),
    };
  }
}

export function getESignProvider(): ESignProvider {
  // Real provider adapters slot in here keyed by ESIGN_PROVIDER.
  return new MockESignProvider();
}
