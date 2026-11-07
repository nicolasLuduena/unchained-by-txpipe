import "server-only";
import { Redis } from "@upstash/redis";

/** The few Redis operations the venue store needs. Values are opaque strings: store.ts owns the encoding. */
export type Kv = {
  hget(key: string, field: string): Promise<string | null>;
  hgetall(key: string): Promise<Record<string, string>>;
  hset(key: string, field: string, value: string): Promise<void>;
  incr(key: string): Promise<number>;
  /** Puts the value at the head of the list and keeps the newest `max`. */
  pushCapped(key: string, value: string, max: number): Promise<void>;
  list(key: string): Promise<string[]>;
  /** True for the one caller that took the key. It frees itself after `ttlMs`, so a dead holder cannot block anyone. */
  acquire(key: string, token: string, ttlMs: number): Promise<boolean>;
  /** Frees the key only if `token` still holds it, so a holder that outlived its ttl cannot free the next one's. */
  release(key: string, token: string): Promise<void>;
};

const RELEASE_SCRIPT = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;

function upstashKv(url: string, token: string): Kv {
  // Raw strings: left on, the client turns a stored "123" into a number and bigints lose precision.
  const redis = new Redis({ url, token, automaticDeserialization: false });
  return {
    hget: (key, field) => redis.hget<string>(key, field),
    async hgetall(key) {
      // With deserialization off the reply is the flat [field, value, ...] array, whatever the types claim.
      const flat = ((await redis.hgetall(key)) ?? []) as unknown as string[];
      const record: Record<string, string> = {};
      for (let i = 0; i < flat.length; i += 2) record[flat[i]] = flat[i + 1];
      return record;
    },
    async hset(key, field, value) {
      await redis.hset(key, { [field]: value });
    },
    incr: (key) => redis.incr(key),
    async pushCapped(key, value, max) {
      await redis.multi().lpush(key, value).ltrim(key, 0, max - 1).exec();
    },
    list: (key) => redis.lrange<string>(key, 0, -1),
    acquire: async (key, holder, ttlMs) => (await redis.set(key, holder, { nx: true, px: ttlMs })) !== null,
    async release(key, holder) {
      await redis.eval(RELEASE_SCRIPT, [key], [holder]);
    },
  };
}

type Memory = {
  hashes: Map<string, Map<string, string>>;
  counters: Map<string, number>;
  lists: Map<string, string[]>;
  locks: Map<string, { token: string; expires: number }>;
};

// On globalThis so the in-memory store survives Next dev reloads of this module.
const holder = globalThis as typeof globalThis & { __handoffVenue?: Memory };

function memoryKv(): Kv {
  const memory = (holder.__handoffVenue ??= { hashes: new Map(), counters: new Map(), lists: new Map(), locks: new Map() });
  const hash = (key: string) => memory.hashes.get(key) ?? memory.hashes.set(key, new Map()).get(key)!;
  return {
    hget: async (key, field) => hash(key).get(field) ?? null,
    hgetall: async (key) => Object.fromEntries(hash(key)),
    async hset(key, field, value) {
      hash(key).set(field, value);
    },
    async incr(key) {
      const next = (memory.counters.get(key) ?? 0) + 1;
      memory.counters.set(key, next);
      return next;
    },
    async pushCapped(key, value, max) {
      memory.lists.set(key, [value, ...(memory.lists.get(key) ?? [])].slice(0, max));
    },
    list: async (key) => memory.lists.get(key) ?? [],
    async acquire(key, token, ttlMs) {
      const held = memory.locks.get(key);
      if (held && held.expires > Date.now()) return false;
      memory.locks.set(key, { token, expires: Date.now() + ttlMs });
      return true;
    },
    async release(key, token) {
      if (memory.locks.get(key)?.token === token) memory.locks.delete(key);
    },
  };
}

let kv: Kv | undefined;

/** Upstash when the Vercel integration injected it, process memory otherwise. Serverless instances share only the former. */
export function venueKv(): Kv {
  if (kv) return kv;
  const { KV_REST_API_URL: url, KV_REST_API_TOKEN: token } = process.env;
  if (url && !token) throw new Error("KV_REST_API_TOKEN is required with KV_REST_API_URL");
  kv = url && token ? upstashKv(url, token) : memoryKv();
  return kv;
}
