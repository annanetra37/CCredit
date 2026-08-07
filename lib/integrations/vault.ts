/**
 * Document vault (S3-3): versioned immutable storage on S3-compatible object
 * storage with object lock. Signed documents live in OUR storage, never left
 * with the e-signature provider. Every retrieval writes an audit event
 * (done by the calling query layer, which has the actor context).
 *
 * In local development, files land on disk under .vault/ to keep the
 * dependency surface small; the interface is identical.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface StoredObject {
  storageKey: string;
  sha256: string;
  sizeBytes: number;
}

export interface VaultStorage {
  put(key: string, body: Buffer, contentType: string): Promise<StoredObject>;
  get(key: string): Promise<Buffer>;
}

class LocalVault implements VaultStorage {
  private root = path.join(process.cwd(), ".vault");

  async put(key: string, body: Buffer): Promise<StoredObject> {
    const target = path.join(this.root, key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body, { flag: "wx" }); // wx: refuse to overwrite — immutability
    return {
      storageKey: key,
      sha256: createHash("sha256").update(body).digest("hex"),
      sizeBytes: body.length,
    };
  }

  async get(key: string): Promise<Buffer> {
    return readFile(path.join(this.root, key));
  }
}

class S3Vault implements VaultStorage {
  constructor(
    private endpoint: string,
    private bucket: string,
    private accessKeyId: string,
    private secretAccessKey: string,
  ) {}

  // Minimal S3 PUT/GET with object-lock headers. Kept dependency-free; if the
  // estate later standardises on @aws-sdk/client-s3, swap the internals only.
  async put(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
    const sha256 = createHash("sha256").update(body).digest("hex");
    const res = await fetch(`${this.endpoint}/${this.bucket}/${key}`, {
      method: "PUT",
      headers: {
        "content-type": contentType,
        "x-amz-content-sha256": sha256,
        "x-amz-object-lock-mode": "COMPLIANCE",
        ...this.authHeaders(),
      },
      body: new Uint8Array(body),
    });
    if (!res.ok) throw new Error(`Vault PUT failed: ${res.status}`);
    return { storageKey: key, sha256, sizeBytes: body.length };
  }

  async get(key: string): Promise<Buffer> {
    const res = await fetch(`${this.endpoint}/${this.bucket}/${key}`, {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`Vault GET failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  private authHeaders(): Record<string, string> {
    // Deployment uses an instance profile / pre-signed gateway; static keys
    // only for self-hosted MinIO in sandbox.
    return {
      authorization: `AWS ${this.accessKeyId}:${this.secretAccessKey}`,
    };
  }
}

export function getVault(): VaultStorage {
  const endpoint = process.env.S3_ENDPOINT;
  if (!endpoint) return new LocalVault();
  return new S3Vault(
    endpoint,
    process.env.S3_BUCKET ?? "portal-vault",
    process.env.S3_ACCESS_KEY_ID ?? "",
    process.env.S3_SECRET_ACCESS_KEY ?? "",
  );
}
