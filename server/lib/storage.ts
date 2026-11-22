export interface StoredAsset {
  key: string;
  jobId: string;
  filename: string;
  buffer: Buffer;
  mimeType: string;
  createdAt: number;
  expiresAt: number;
}

const MAX_STORED_ASSETS = 180;
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // Every 10 minutes

class TemporaryAssetStore {
  private readonly store = new Map<string, StoredAsset>();

  constructor() {
    const timer = setInterval(() => {
      this.purgeExpired();
    }, CLEANUP_INTERVAL_MS);
    timer.unref();
  }

  private buildKey(jobId: string, filename: string): string {
    return `outputs/${jobId}/${filename}`;
  }

  put(
    jobId: string,
    filename: string,
    buffer: Buffer,
    mimeType: string,
    retentionHours: number
  ): StoredAsset {
    this.purgeExpired();

    // Evict oldest assets if memory cap is reached
    while (this.store.size >= MAX_STORED_ASSETS) {
      const oldestKey = this.store.keys().next().value;
      if (!oldestKey) break;
      this.store.delete(oldestKey);
    }

    const now = Date.now();
    const ttlMs = Math.max(1, retentionHours) * 60 * 60 * 1000;
    const key = this.buildKey(jobId, filename);
    const asset: StoredAsset = {
      key,
      jobId,
      filename,
      buffer,
      mimeType,
      createdAt: now,
      expiresAt: now + ttlMs,
    };
    this.store.set(key, asset);
    return asset;
  }

  get(jobId: string, filename: string): StoredAsset | null {
    const key = this.buildKey(jobId, filename);
    const asset = this.store.get(key);
    if (!asset) return null;

    if (Date.now() > asset.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return asset;
  }

  purgeExpired(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, asset] of this.store.entries()) {
      if (now > asset.expiresAt) {
        this.store.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  count(): number {
    this.purgeExpired();
    return this.store.size;
  }
}

export const tempAssetStore = new TemporaryAssetStore();
