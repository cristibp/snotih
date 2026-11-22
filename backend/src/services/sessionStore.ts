import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

export interface DeviceSession {
  id: string;
  email: string;
  token_hash: string;
  device_label: string | null;
  ip_address: string | null;
  last_active_at: number;
  expires_at: number;
  max_expires_at: number;
  created_at: number;
}

export interface ActiveSessionView {
  id: string;
  email: string;
  device_label: string | null;
  ip_address: string | null;
  last_active_at: number;
  expires_at: number;
  created_at: number;
}

const SLIDING_DAYS = 90;
const HARD_CAP_DAYS = 365;
const TOUCH_THROTTLE_SEC = 24 * 60 * 60; // extend at most once per 24 h

/**
 * SQLite-backed device session store.
 * Uses WAL mode + busy_timeout for concurrency-safe reads/writes.
 * Only SHA-256 hashes of tokens are persisted – raw secrets never touch disk.
 */
export class SessionStore {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const targetPath =
      dbPath ||
      process.env.SESSIONS_DB_PATH ||
      path.join(__dirname, '..', '..', 'data', 'sessions.db');

    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    this.db = new Database(targetPath);
    this.init();
  }

  private init(): void {
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.db.pragma('synchronous = NORMAL');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS device_sessions (
        id            TEXT PRIMARY KEY,
        email         TEXT NOT NULL,
        token_hash    TEXT NOT NULL UNIQUE,
        device_label  TEXT,
        ip_address    TEXT,
        last_active_at INTEGER NOT NULL,
        expires_at     INTEGER NOT NULL,
        max_expires_at INTEGER NOT NULL,
        created_at     INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_ds_token ON device_sessions(token_hash);
      CREATE INDEX IF NOT EXISTS idx_ds_email ON device_sessions(email);
      CREATE INDEX IF NOT EXISTS idx_ds_expires ON device_sessions(expires_at);
    `);
  }

  public hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /** Create a new session, returning the raw (unhashed) cookie token. */
  public createSession(params: {
    email: string;
    deviceLabel?: string | null;
    ipAddress?: string | null;
  }): { rawToken: string; session: DeviceSession } {
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(rawToken);
    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + SLIDING_DAYS * 86400;
    const maxExpiresAt = now + HARD_CAP_DAYS * 86400;

    this.db
      .prepare(
        `INSERT INTO device_sessions
         (id, email, token_hash, device_label, ip_address, last_active_at, expires_at, max_expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        params.email.toLowerCase(),
        tokenHash,
        params.deviceLabel ?? null,
        params.ipAddress ?? null,
        now,
        expiresAt,
        maxExpiresAt,
        now
      );

    return {
      rawToken,
      session: {
        id,
        email: params.email.toLowerCase(),
        token_hash: tokenHash,
        device_label: params.deviceLabel ?? null,
        ip_address: params.ipAddress ?? null,
        last_active_at: now,
        expires_at: expiresAt,
        max_expires_at: maxExpiresAt,
        created_at: now,
      },
    };
  }

  /**
   * Validate a raw cookie token.
   * Returns the session or null if missing / expired.
   * Slides expires_at at most once every 24 h to minimise disk writes.
   */
  public validateSession(rawToken: string): DeviceSession | null {
    const tokenHash = this.hashToken(rawToken);
    const now = Math.floor(Date.now() / 1000);

    const session = this.db
      .prepare('SELECT * FROM device_sessions WHERE token_hash = ?')
      .get(tokenHash) as DeviceSession | undefined;

    if (!session) return null;

    if (now >= session.expires_at || now >= session.max_expires_at) {
      this.deleteById(session.id);
      return null;
    }

    // Slide expiration at most once per 24 h
    if (now - session.last_active_at >= TOUCH_THROTTLE_SEC) {
      const newExpires = Math.min(now + SLIDING_DAYS * 86400, session.max_expires_at);
      this.db
        .prepare('UPDATE device_sessions SET last_active_at = ?, expires_at = ? WHERE id = ?')
        .run(now, newExpires, session.id);
      session.last_active_at = now;
      session.expires_at = newExpires;
    }

    return session;
  }

  public deleteById(id: string): boolean {
    const { changes } = this.db.prepare('DELETE FROM device_sessions WHERE id = ?').run(id);
    return changes > 0;
  }

  public getAllActive(): ActiveSessionView[] {
    const now = Math.floor(Date.now() / 1000);
    return this.db
      .prepare(
        `SELECT id, email, device_label, ip_address, last_active_at, expires_at, created_at
         FROM device_sessions
         WHERE expires_at > ? AND max_expires_at > ?
         ORDER BY last_active_at DESC`
      )
      .all(now, now) as ActiveSessionView[];
  }
}

/** Singleton used throughout the backend. */
export const sessionStore = new SessionStore();
