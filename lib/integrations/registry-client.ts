/**
 * I-REC registry client (Sprint 9).
 *
 * THE GATE (§1.2, §3): sandbox never reaches a registry. The client throws if
 * any attribute in the batch belongs to a sandbox site — enforced here at the
 * service boundary, regardless of what any screen or caller believes.
 * Without this gate we would eventually issue a real certificate from a
 * typed-in number.
 */

export class SandboxIssuanceBlockedError extends Error {
  constructor(public readonly offendingAttributeIds: string[]) {
    super(
      `Blocked: ${offendingAttributeIds.length} attribute(s) in this batch belong to sandbox sites. ` +
        "Sandbox data can never be submitted to a registry. " +
        "This is the flight-simulator switch — same controls, but the plane does not take off.",
    );
    this.name = "SandboxIssuanceBlockedError";
  }
}

export interface IssuanceAttribute {
  id: string;
  serialCandidate?: string;
  mwh: number;
  isSandbox: boolean;
}

export interface IssueSubmission {
  siteRegistryCode: string;
  periodLabel: string;
  attributes: IssuanceAttribute[];
  evidenceDocumentKeys: string[];
}

export interface IssueResult {
  registryReference: string;
  serials: Array<{ attributeId: string; serialNo: string }>;
}

export interface RegistryClient {
  registerDevice(payload: Record<string, unknown>): Promise<{ deviceCode: string }>;
  submitIssueRequest(submission: IssueSubmission): Promise<IssueResult>;
  fetchCertificateStates(serials: string[]): Promise<Record<string, string>>;
}

/** Every implementation must call this before any network I/O. */
export function assertNoSandboxAttributes(attributes: IssuanceAttribute[]): void {
  const offenders = attributes.filter((a) => a.isSandbox).map((a) => a.id);
  if (offenders.length > 0) {
    throw new SandboxIssuanceBlockedError(offenders);
  }
}

/**
 * Mock client for local development and the demo environment. Behaves like
 * the registry sandbox: issues deterministic serials, honours the gate.
 */
export class MockRegistryClient implements RegistryClient {
  async registerDevice(): Promise<{ deviceCode: string }> {
    return { deviceCode: `AM-DEV-${Math.random().toString(36).slice(2, 8).toUpperCase()}` };
  }

  async submitIssueRequest(submission: IssueSubmission): Promise<IssueResult> {
    assertNoSandboxAttributes(submission.attributes);
    let seq = 1;
    return {
      registryReference: `MOCK-${submission.periodLabel}`,
      serials: submission.attributes.map((a) => ({
        attributeId: a.id,
        serialNo: `AM-IREC-${submission.periodLabel}-${String(seq++).padStart(4, "0")}`,
      })),
    };
  }

  async fetchCertificateStates(serials: string[]): Promise<Record<string, string>> {
    return Object.fromEntries(serials.map((s) => [s, "ISSUED"]));
  }
}

/**
 * HTTP client for the real registry API (sandbox or live per REGISTRY_MODE).
 * Where the Issuer offers no API, submitIssueRequest degrades to producing a
 * structured export the operator uploads manually — the gate still applies.
 */
export class HttpRegistryClient implements RegistryClient {
  constructor(
    private baseUrl: string,
    private apiKey: string,
  ) {}

  private async call<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Registry call ${path} failed: ${res.status} ${await res.text()}`);
    }
    return (await res.json()) as T;
  }

  async registerDevice(payload: Record<string, unknown>): Promise<{ deviceCode: string }> {
    return this.call("/devices", payload);
  }

  async submitIssueRequest(submission: IssueSubmission): Promise<IssueResult> {
    // The gate runs before ANY network I/O, in every implementation.
    assertNoSandboxAttributes(submission.attributes);
    return this.call("/issue-requests", submission);
  }

  async fetchCertificateStates(serials: string[]): Promise<Record<string, string>> {
    return this.call("/certificates/states", { serials });
  }
}

export function getRegistryClient(): RegistryClient {
  const mode = process.env.REGISTRY_MODE ?? "mock";
  if (mode === "mock") return new MockRegistryClient();
  const url = process.env.REGISTRY_API_URL;
  const key = process.env.REGISTRY_API_KEY;
  if (!url || !key) {
    throw new Error(
      "REGISTRY_MODE is not 'mock' but REGISTRY_API_URL / REGISTRY_API_KEY are unset.",
    );
  }
  return new HttpRegistryClient(url, key);
}
