import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { db } from "../services/database";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

// Simple retry + timeout helper for fetch to reduce transient failures
async function fetchWithRetry(url: string, init: any = {}, opts: { retries?: number; timeoutMs?: number } = {}) {
  const retries = typeof opts.retries === 'number' ? opts.retries : 2;
  const timeoutMs = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : 20000;
  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      return resp;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (attempt === retries) break;
      // small backoff
      await new Promise((r) => setTimeout(r, 500 + attempt * 500));
    }
  }
  throw lastErr;
}

// GET /api/auth/github
export async function handleGithubAuth(req: Request, res: Response) {
  try {
    if (!process.env.GITHUB_CLIENT_ID) {
      console.error("❌ GITHUB_CLIENT_ID is not set");
      return res.status(500).json({ error: "GitHub OAuth not configured" });
    }

    const isProd = process.env.NODE_ENV === "production";
    const baseUrl = isProd
      ? (process.env.BACKEND_URL || `https://${req.get("host")}`)
      : "http://localhost:8081";

    const callbackUrl = `${baseUrl}/api/auth/github/callback`;
    // Preserve requesting frontend origin via state and optional verification parameters
    const frontend = typeof req.query.frontend === 'string' && req.query.frontend
      ? req.query.frontend
      : (process.env.FRONTEND_URL || 'http://localhost:5173');
    const mode = typeof req.query.mode === 'string' ? req.query.mode : undefined;
    const currentUserId = typeof req.query.currentUserId === 'string' ? req.query.currentUserId : undefined;
    const ret = typeof req.query.return === 'string' ? req.query.return : undefined;
    const stateObj: any = { frontend };
    if (mode) stateObj.mode = mode;
    if (currentUserId) stateObj.currentUserId = currentUserId;
    if (ret) stateObj.return = ret;
    // Pass-through any extra query params (e.g., application payload)
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value !== 'string') continue;
      if (['frontend', 'mode', 'currentUserId', 'return'].includes(key)) continue;
      // Only include small payloads (base64 strings are fine)
      if (value && value.length <= 50000) {
        (stateObj as any)[key] = value;
      }
    }
    const statePayload = Buffer.from(JSON.stringify(stateObj)).toString('base64');

    const authUrl =
      `https://github.com/login/oauth/authorize?` +
      `client_id=${process.env.GITHUB_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(callbackUrl)}&` +
      `scope=read:user%20user:email&` +
      `state=${encodeURIComponent(statePayload)}`;

    console.log("🔗 GitHub OAuth start:", authUrl);
    res.redirect(authUrl);
  } catch (err) {
    console.error("GitHub auth error:", err);
    res.status(500).json({ error: "Authentication failed" });
  }
}

// GET /api/auth/github/callback
export async function handleGithubCallback(req: Request, res: Response) {
  try {
    const isProd = process.env.NODE_ENV === "production";
    const baseUrl = isProd
      ? (process.env.BACKEND_URL || `https://${req.get("host")}`)
      : "http://localhost:8081";
    const callbackUrl = `${baseUrl}/api/auth/github/callback`;

    const { code, state } = req.query;
    if (!code) {
      return res.status(400).json({ error: "Authorization code required" });
    }

    // Exchange code for access token
    const tokenResp = await fetchWithRetry("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: callbackUrl,
      }),
    }, { retries: 2, timeoutMs: 20000 });
    const tokenData: any = await tokenResp.json();
    if (!tokenData.access_token) {
      console.error("GitHub token error:", tokenData);
      throw new Error("Failed to get access token");
    }

    // Fetch user profile
    const userResp = await fetchWithRetry("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, "User-Agent": "youth-innovation-portal" },
    }, { retries: 2, timeoutMs: 20000 });
    const ghUser: any = await userResp.json();

    // Fetch primary email (GitHub may hide email on /user)
    let email: string | undefined = ghUser.email;
    if (!email) {
      const emailsResp = await fetchWithRetry("https://api.github.com/user/emails", {
        headers: { Authorization: `Bearer ${tokenData.access_token}`, "User-Agent": "youth-innovation-portal" },
      }, { retries: 2, timeoutMs: 20000 });
      const emails: any[] = await emailsResp.json();
      const primary = emails?.find((e) => e.primary) || emails?.[0];
      email = primary?.email;
    }

    // Fallback pseudo email if none
    if (!email && ghUser?.login) {
      email = `${ghUser.login}@users.noreply.github.com`;
    }
    if (!email) {
      throw new Error("Failed to resolve GitHub email");
    }

    // If this OAuth was initiated in verification mode, just attach GitHub to the specified current user
    let parsedState: any = null;
    if (typeof state === 'string' && state) {
      try { parsedState = JSON.parse(Buffer.from(state, 'base64').toString('utf8')); } catch {}
    }
    if (parsedState?.mode === 'verify' && typeof parsedState.currentUserId === 'string' && parsedState.currentUserId) {
      try {
        const updatePayload: any = {
          githubId: ghUser.id?.toString?.(),
          githubUsername: ghUser.login,
          githubUrl: ghUser.login ? `https://github.com/${ghUser.login}` : undefined,
          githubStats: {
            username: ghUser.login,
            totalRepos: typeof ghUser.public_repos === 'number' ? ghUser.public_repos : undefined,
          },
        };
        // If user entered a username before OAuth, keep it for UI (pending state)
        if (typeof parsedState.application === 'string' && parsedState.application) {
          try {
            const jsonStr = Buffer.from(parsedState.application, 'base64').toString('utf8');
            const appPayload = JSON.parse(jsonStr);
            if (appPayload?.githubUsername) updatePayload.githubUsernameEntered = appPayload.githubUsername;
          } catch {}
        }
        await db.updateUser(parsedState.currentUserId, updatePayload);
      } catch (e) {
        console.error('⚠️ Failed to update user in verify mode:', e);
      }

      // If application payload is provided, create verification application now
      let submittedViaCallback = false;
      if (typeof parsedState.application === 'string' && parsedState.application) {
        try {
          const jsonStr = Buffer.from(parsedState.application, 'base64').toString('utf8');
          const appPayload = JSON.parse(jsonStr);
          const userId = parsedState.currentUserId;
          // Determine the username strictly from user input
          const enteredUsername = (appPayload.githubUsername || '').trim();
          let enteredPublicRepos: number | undefined = undefined;
          if (enteredUsername) {
            try {
              const checkResp = await fetch(`https://api.github.com/users/${encodeURIComponent(enteredUsername)}`);
              if (checkResp.ok) {
                const checkData: any = await checkResp.json();
                if (typeof checkData.public_repos === 'number') enteredPublicRepos = checkData.public_repos;
              }
            } catch {}
          }
          // Compose application document with GitHub details
          const verificationApplication = {
            type: appPayload.type || 'individual',
            sector: appPayload.sector || '',
            projectTitle: appPayload.projectTitle || '',
            projectDescription: appPayload.projectDescription || '',
            // Store ONLY the user-entered username for this application
            githubUsername: enteredUsername || undefined,
            githubTotalRepos: enteredPublicRepos,
            teamMembers: appPayload.teamMembers || [],
            duration: appPayload.duration || appPayload.teamSize || '1',
            status: 'pending',
            submittedAt: new Date(),
          } as any;
          const applicationWithUser = {
            ...verificationApplication,
            userId,
          } as any;
          const saved = await db.createVerificationApplication(applicationWithUser);
          if (saved) {
            submittedViaCallback = true;
            // Notify applicant (non-blocking)
            try {
              const msg = 'Your verification is under review. You will be notified once the admin reviews your application.';
              await db.createNotification({ userId, type: 'application_update', title: 'Application Pending', message: msg, read: false } as any);
            } catch {}
          }
        } catch (e) {
          console.error('⚠️ Failed to create application from GitHub verify callback:', e);
        }
      }

      // Redirect back to the frontend return path with appropriate verify flag
      let frontendBaseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      if (parsedState?.frontend && typeof parsedState.frontend === 'string') {
        frontendBaseUrl = parsedState.frontend;
      }
      const returnPath = typeof parsedState?.return === 'string' && parsedState.return ? parsedState.return : '/app';
      const verifyFlag = submittedViaCallback ? 'application_submitted' : 'github_connected';
      const redirectUrl = `${frontendBaseUrl}${returnPath}${returnPath.includes('?') ? '&' : '?'}verify=${verifyFlag}`;
      console.log("🔗 Redirecting to frontend (GitHub verify):", redirectUrl);
      return res.redirect(redirectUrl);
    }

    // Upsert user by email
    let user = await db.findUserByEmail(email);

    if (!user) {
      const fullName: string = ghUser.name || ghUser.login || "User";
      const [firstName, ...rest] = fullName.split(" ");
      const lastName = rest.join(" ");

      const newUser = {
        email,
        firstName: firstName || "User",
        lastName: lastName || "",
        password: "", // OAuth users don't need password
        githubId: ghUser.id?.toString?.(),
        githubUsername: ghUser.login,
        githubUrl: ghUser.login ? `https://github.com/${ghUser.login}` : undefined,
        profileComplete: false,
        verified: false,
        role: "user" as const,
        avatar: ghUser.avatar_url,
        profile: { avatar: ghUser.avatar_url },
        githubStats: {
          username: ghUser.login,
          dailyCommits: 0,
          totalCommits: 0,
          lastCommitDate: new Date(0),
          streak: 0,
          totalRepos: typeof ghUser.public_repos === 'number' ? ghUser.public_repos : undefined,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      user = await db.createUser(newUser as any);
    } else {
      // Update githubId/avatar if needed
      const updatePayload: any = {
        githubId: ghUser.id?.toString?.(),
        githubUsername: ghUser.login || (user as any).githubUsername,
        githubUrl: ghUser.login ? `https://github.com/${ghUser.login}` : (((user as any).githubUrl) || undefined),
      };
      if (!user.avatar || (typeof user.avatar === "string" && !user.avatar.startsWith("/avatars/"))) {
        updatePayload.avatar = ghUser.avatar_url || user.avatar;
        updatePayload.profile = { ...(user.profile || {}), avatar: ghUser.avatar_url || user.profile?.avatar };
      }
      // Update GitHub stats (username and repo count)
      updatePayload.githubStats = {
        ...(user.githubStats || {}),
        username: ghUser.login || user.githubStats?.username,
        totalRepos: typeof ghUser.public_repos === 'number' ? ghUser.public_repos : (user.githubStats?.totalRepos),
      };
      try {
        await db.updateUser(user._id.toString(), updatePayload);
        // Reload user with fresh fields for redirect payload
        const refreshed = await db.findUserByEmail(email);
        if (refreshed) user = refreshed as any;
      } catch {}
    }

    // Issue JWT (normal login/signup flow)
    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Determine target frontend from state, fallback to env/default
    let frontendBaseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    if (typeof state === 'string' && state) {
      try {
        const parsed = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
        if (parsed?.frontend && typeof parsed.frontend === 'string') {
          frontendBaseUrl = parsed.frontend;
        }
      } catch {}
    }
    const frontendPath = user.role === "admin" ? "/admin" : "/app";
    const userData = {
      _id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      verified: user.verified,
      githubUsername: (user as any).githubUsername || (user as any).githubStats?.username,
      githubUrl: (user as any).githubUrl,
      githubStats: (user as any).githubStats,
    };

    const redirectUrl = `${frontendBaseUrl}${frontendPath}?token=${token}&user=${encodeURIComponent(JSON.stringify(userData))}`;
    console.log("🔗 Redirecting to frontend (GitHub):", redirectUrl);
    res.redirect(redirectUrl);
  } catch (err) {
    console.error("GitHub callback error:", err);
    const frontendBaseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(`${frontendBaseUrl}/login?error=github_oauth_failed`);
  }
}
