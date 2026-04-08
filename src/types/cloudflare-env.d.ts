/**
 * Minimal Cloudflare Workers global type stubs.
 * Avoids loading the full @cloudflare/workers-types which causes OOM in tsc.
 * Only declares globals actually referenced in source code.
 */

declare interface R2Bucket {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | ReadableStream | string | null,
    options?: { httpMetadata?: { contentType?: string } }
  ): Promise<R2Object>;
  get(key: string): Promise<R2Object | null>;
  delete(keys: string | string[]): Promise<void>;
  list(options?: { prefix?: string; limit?: number }): Promise<{ objects: R2Object[] }>;
}

declare interface R2Object {
  key: string;
  size: number;
  etag: string;
  httpEtag: string;
  uploaded: Date;
  httpMetadata?: { contentType?: string };
}

declare interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: Record<string, unknown>;
}

declare interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run(): Promise<D1Result<never>>;
  all<T = unknown>(): Promise<D1Result<T>>;
  raw<T extends unknown[] = unknown[]>(): Promise<T[]>;
}

declare interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1Result<never>>;
}
