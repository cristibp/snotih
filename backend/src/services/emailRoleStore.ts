import fs from 'fs';
import path from 'path';

export type UserRole = 'admin' | 'user';

/**
 * Stores the email → role CSV allowlist in memory.
 * - Reloads automatically via fs.watch (immediate) + 10-second poll fallback.
 * - Emails are normalised (trim + toLowerCase). Roles default to 'user'.
 * - Used to resolve the CURRENT role on every authenticated request,
 *   so changes to the CSV take effect without a server restart.
 */
export class EmailRoleStore {
  private readonly filePath: string;
  private usersMap: Map<string, UserRole> = new Map();
  private lastMtimeMs: number = 0;
  private watcher: fs.FSWatcher | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor(filePath?: string) {
    this.filePath =
      filePath ||
      process.env.ALLOWED_EMAILS_PATH ||
      path.join(__dirname, '..', '..', 'data', 'allowed_emails.csv');

    this.ensureDir();
    this.reload();
    this.startWatcher();
  }

  private ensureDir(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Create empty CSV skeleton if the file doesn't exist yet
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, 'email,role\n', 'utf-8');
      console.log(`[EmailRoleStore] Created empty allowlist at ${this.filePath}`);
    }
  }

  public reload(): void {
    try {
      if (!fs.existsSync(this.filePath)) {
        this.usersMap.clear();
        this.lastMtimeMs = 0;
        return;
      }

      const stats = fs.statSync(this.filePath);
      if (stats.mtimeMs === this.lastMtimeMs) return; // unchanged

      const content = fs.readFileSync(this.filePath, 'utf-8');
      const lines = content.split(/\r?\n/);
      const newMap = new Map<string, UserRole>();

      let headerFound = false;
      let emailIdx = 0;
      let roleIdx = 1;

      for (const rawLine of lines) {
        const trimmed = rawLine.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;

        const cols = trimmed.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));

        if (!headerFound && cols.some((c) => c.toLowerCase() === 'email')) {
          headerFound = true;
          emailIdx = cols.findIndex((c) => c.toLowerCase() === 'email');
          const ri = cols.findIndex((c) => c.toLowerCase() === 'role');
          if (ri >= 0) roleIdx = ri;
          continue;
        }

        const rawEmail = cols[emailIdx];
        if (!rawEmail) continue;

        const email = rawEmail.trim().toLowerCase();
        const rawRole = (cols[roleIdx] || '').trim().toLowerCase();
        const role: UserRole = rawRole === 'admin' ? 'admin' : 'user';
        newMap.set(email, role);
      }

      this.usersMap = newMap;
      this.lastMtimeMs = stats.mtimeMs;
      console.log(`[EmailRoleStore] Loaded ${this.usersMap.size} allowed email(s) from ${this.filePath}`);
    } catch (err) {
      console.error('[EmailRoleStore] Failed to reload CSV:', err);
    }
  }

  private startWatcher(): void {
    // 1. Filesystem event (fires immediately on change)
    try {
      this.watcher = fs.watch(path.dirname(this.filePath), (_event, filename) => {
        if (!filename || filename === path.basename(this.filePath)) {
          this.reload();
        }
      });
    } catch {
      console.warn('[EmailRoleStore] fs.watch unavailable – relying on poll.');
    }

    // 2. Poll fallback every 10 s
    this.pollInterval = setInterval(() => this.reload(), 10_000);
    this.pollInterval.unref();
  }

  public getRole(email: string): UserRole | null {
    return this.usersMap.get(email.trim().toLowerCase()) ?? null;
  }

  public isAllowed(email: string): boolean {
    return this.getRole(email) !== null;
  }

  public destroy(): void {
    this.watcher?.close();
    if (this.pollInterval) clearInterval(this.pollInterval);
  }
}

/** Singleton used throughout the backend. */
export const emailRoleStore = new EmailRoleStore();
