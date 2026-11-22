import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { emailRoleStore, UserRole } from '../services/emailRoleStore';
import { sessionStore } from '../services/sessionStore';

export const authRouter = Router();

/* ------------------------------------------------------------------ */
/* Type augmentation                                                    */
/* ------------------------------------------------------------------ */

declare global {
  namespace Express {
    interface Request {
      user?: { email: string; role: UserRole; sessionId: string };
    }
  }
}

/* ------------------------------------------------------------------ */
/* Config                                                               */
/* ------------------------------------------------------------------ */

const COOKIE_NAME = 'snotih_session';
const isProd = process.env.NODE_ENV === 'production';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  (isProd
    ? 'https://snoti.onrender.com/api/auth/google/callback'
    : 'http://localhost:3000/api/auth/google/callback');

const FRONTEND_URL = process.env.FRONTEND_URL || (isProd ? 'https://snoti.onrender.com' : 'http://localhost:3000');

// ── Startup diagnostics ──
console.log('[Auth Config]', {
  NODE_ENV: process.env.NODE_ENV,
  isProd,
  GOOGLE_REDIRECT_URI,
  GOOGLE_REDIRECT_URI_ENV_RAW: process.env.GOOGLE_REDIRECT_URI ?? '(not set)',
  FRONTEND_URL,
  GOOGLE_CLIENT_ID_SET: !!GOOGLE_CLIENT_ID,
});

function clientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  return typeof fwd === 'string' ? fwd.split(',')[0].trim() : req.socket.remoteAddress || '127.0.0.1';
}

function deviceLabel(ua?: string): string {
  if (!ua) return 'Unknown Device';
  if (/iPhone|iPad/i.test(ua)) return 'iOS (Safari/Mobile)';
  if (/Android/i.test(ua)) return 'Android (Chrome/Mobile)';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macOS (Desktop)';
  if (/Windows/i.test(ua)) return 'Windows PC (Desktop)';
  if (/Linux/i.test(ua)) return 'Linux (Desktop)';
  return 'Web Browser';
}

/* ------------------------------------------------------------------ */
/* Middleware                                                            */
/* ------------------------------------------------------------------ */

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const rawToken = req.cookies?.[COOKIE_NAME];
  if (!rawToken) {
    return res.status(401).json({ error: 'Unauthorized: no session cookie' });
  }

  const session = sessionStore.validateSession(rawToken);
  if (!session) {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    return res.status(401).json({ error: 'Unauthorized: session invalid or expired' });
  }

  // Resolve role DYNAMICALLY from the in-memory CSV map every request
  const role = emailRoleStore.getRole(session.email);
  if (!role) {
    // Email removed from CSV → purge session immediately
    sessionStore.deleteById(session.id);
    res.clearCookie(COOKIE_NAME, { path: '/' });
    return res.status(403).json({ error: 'Forbidden: access revoked' });
  }

  req.user = { email: session.email, role, sessionId: session.id };
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: admin access required' });
  }
  next();
}

/* ------------------------------------------------------------------ */
/* OAuth 2.0 / OIDC with PKCE                                          */
/* ------------------------------------------------------------------ */

/** Step 1 – redirect to Google consent screen */
authRouter.get('/api/auth/google', (_req: Request, res: Response) => {
  console.log('[OAuth Step 1] Initiating Google OAuth with redirect_uri:', GOOGLE_REDIRECT_URI);

  const state = crypto.randomBytes(16).toString('hex');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  // Short-lived HttpOnly cookies to carry PKCE state across the redirect
  const cookieOpts = { httpOnly: true, secure: isProd, sameSite: 'lax' as const, maxAge: 10 * 60 * 1000 };
  res.cookie('oauth_state', state, cookieOpts);
  res.cookie('pkce_verifier', codeVerifier, cookieOpts);

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  console.log('[OAuth Step 1] Full auth URL redirect_uri param:', params.get('redirect_uri'));
  res.redirect(authUrl);
});

/** Step 2 – Google redirects back with ?code=&state= */
authRouter.get('/api/auth/google/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query;
  const cookieState = req.cookies?.oauth_state;
  const codeVerifier = req.cookies?.pkce_verifier;

  res.clearCookie('oauth_state');
  res.clearCookie('pkce_verifier');

  if (!code || !state || state !== cookieState || !codeVerifier) {
    return res.status(400).send('OAuth validation failed: bad state or missing PKCE verifier.');
  }

  try {
    // Exchange code for tokens
    console.log('[OAuth Step 2] Exchanging code with redirect_uri:', GOOGLE_REDIRECT_URI);
    const tokenRes = await axios.post<{
      access_token: string;
      id_token: string;
    }>('https://oauth2.googleapis.com/token', {
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: GOOGLE_REDIRECT_URI,
    });

    // Fetch verified user info
    const userinfoRes = await axios.get<{ email: string; email_verified: boolean }>(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      { headers: { Authorization: `Bearer ${tokenRes.data.access_token}` } }
    );

    const googleEmail = (userinfoRes.data.email || '').trim().toLowerCase();
    if (!googleEmail || !userinfoRes.data.email_verified) {
      return res.status(400).send('Google account has no verified email address.');
    }

    // Check CSV allowlist
    if (!emailRoleStore.isAllowed(googleEmail)) {
      return res.status(403).send('Forbidden: your email is not on the access list.');
    }

    // Create SQLite session
    const { rawToken } = sessionStore.createSession({
      email: googleEmail,
      deviceLabel: deviceLabel(req.headers['user-agent']),
      ipAddress: clientIp(req),
    });

    // Issue long-lived HttpOnly cookie (90 days)
    res.cookie(COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 90 * 24 * 60 * 60 * 1000,
    });

    return res.redirect(FRONTEND_URL + '/');
  } catch (err: any) {
    console.error('[Google OAuth error]', err?.response?.data ?? err.message);
    return res.status(500).send('Authentication failed during Google token exchange.');
  }
});

/* ------------------------------------------------------------------ */
/* User endpoints                                                        */
/* ------------------------------------------------------------------ */

/** GET /api/auth/me – returns current user info */
authRouter.get('/api/auth/me', requireAuth, (req: Request, res: Response) => {
  return res.json({ email: req.user!.email, role: req.user!.role });
});

/** POST /api/auth/logout – destroys current device session */
authRouter.post('/api/auth/logout', requireAuth, (req: Request, res: Response) => {
  sessionStore.deleteById(req.user!.sessionId);
  res.clearCookie(COOKIE_NAME, { path: '/' });
  return res.json({ success: true });
});

/* ------------------------------------------------------------------ */
/* Admin session-management endpoints                                   */
/* ------------------------------------------------------------------ */

/** GET /api/admin/sessions – list all active sessions */
authRouter.get(
  '/api/admin/sessions',
  requireAuth,
  requireAdmin,
  (_req: Request, res: Response) => {
    return res.json({ sessions: sessionStore.getAllActive() });
  }
);

/** DELETE /api/admin/sessions/:id – revoke any session by id */
authRouter.delete(
  '/api/admin/sessions/:id',
  requireAuth,
  requireAdmin,
  (req: Request, res: Response) => {
    const deleted = sessionStore.deleteById(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Session not found' });
    return res.json({ success: true, revokedSessionId: req.params.id });
  }
);
