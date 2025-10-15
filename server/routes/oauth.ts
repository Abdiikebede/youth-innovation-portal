import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { db } from "../services/database";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export async function handleGoogleAuth(req: Request, res: Response) {
  try {
    // Debug environment variables
    console.log('🔍 Google OAuth Debug:');
    console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'Present' : 'MISSING');
    console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'Present' : 'MISSING');
    
    if (!process.env.GOOGLE_CLIENT_ID) {
      console.error('❌ GOOGLE_CLIENT_ID is not set in environment variables');
      return res.status(500).json({ error: 'Google OAuth not configured properly' });
    }

    // For local development, we need to explicitly set the callback URL to use http and port 8081
    const callbackProtocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const callbackHost = process.env.NODE_ENV === 'production' 
      ? req.get('host') 
      : 'localhost:8081';
      
    // Preserve the requesting frontend origin if provided
    const frontend = typeof req.query.frontend === 'string' && req.query.frontend
      ? req.query.frontend
      : (process.env.FRONTEND_URL || 'http://localhost:5173');
    const statePayload = Buffer.from(JSON.stringify({ frontend })).toString('base64');

    const redirectUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(`${callbackProtocol}://${callbackHost}/api/auth/google/callback`)}&` +
      `response_type=code&` +
      `scope=openid email profile&` +
      `state=${encodeURIComponent(statePayload)}`;

    console.log('🔗 Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
}

export async function handleGoogleCallback(req: Request, res: Response) {
  try {
    // For local development, we need to explicitly set the callback URL to use http and port 8081
    const callbackProtocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const callbackHost = process.env.NODE_ENV === 'production' 
      ? req.get('host') 
      : 'localhost:8081';
      
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).json({ error: "Authorization code required" });
    }

    // Exchange code for access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        code: code as string,
        grant_type: "authorization_code",
        redirect_uri: `${callbackProtocol}://${callbackHost}/api/auth/google/callback`,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      throw new Error("Failed to get access token");
    }

    // Get user profile
    const profileResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      },
    );

    const profile = await profileResponse.json();

    if (!profile.email) {
      throw new Error("Failed to get user profile");
    }

    // Check if user exists by email or Google ID
    let user = await db.findUserByEmail(profile.email);
    
    if (!user && profile.id) {
      // Also check by Google ID in case email changed
      user = await db.findUserByGoogleId(profile.id); // Use findUserByGoogleId for Google accounts
    }

    if (!user) {
      // Create new user
      const newUser = {
        email: profile.email,
        firstName: profile.given_name || profile.name?.split(" ")[0] || "User",
        lastName:
          profile.family_name ||
          profile.name?.split(" ").slice(1).join(" ") ||
          "",
        password: "", // OAuth users don't need password
        googleId: profile.id, // Store Google ID
        profileComplete: false,
        verified: false, // Require admin approval before posting
        role: "user" as const,
        avatar: profile.picture, // Save avatar at root for consistency
        profile: {
          avatar: profile.picture,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      user = await db.createUser(newUser);
    } else {
      // Only update avatar from Google if user hasn't uploaded a custom one
      const hasCustomRootAvatar = typeof user.avatar === 'string' && user.avatar.startsWith('/avatars/');
      const hasCustomProfileAvatar = typeof (user as any).profile?.avatar === 'string' && (user as any).profile.avatar.startsWith('/avatars/');
      const shouldUpdateAvatar = !(hasCustomRootAvatar || hasCustomProfileAvatar);

      const updatePayload: any = {
        googleId: profile.id || user.googleId,
      };

      if (shouldUpdateAvatar) {
        updatePayload.avatar = profile.picture || user.avatar;
        updatePayload.profile = {
          ...user.profile,
          avatar: profile.picture || user.profile?.avatar,
        };
      }

      await db.updateUser(user._id.toString(), updatePayload);

      // Update in-memory user fields for subsequent logic
      user.googleId = profile.id;
      if (shouldUpdateAvatar) {
        user.avatar = profile.picture || user.avatar;
        if (user.profile) {
          user.profile.avatar = profile.picture || user.profile.avatar;
        }
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET || "dev-secret",
      { expiresIn: "7d" },
    );

    // Determine target frontend from state, fallback to env/default
    let frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    if (typeof state === 'string' && state) {
      try {
        const parsed = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
        if (parsed?.frontend && typeof parsed.frontend === 'string') {
          frontendBaseUrl = parsed.frontend;
        }
      } catch {}
    }
    // Normalize role and decide admin vs user route
    const isAdminRole = (role?: string) => {
      if (!role) return false
      const norm = String(role).toLowerCase().replace(/[^a-z]/g, "")
      return norm === "admin" || norm === "superadmin"
    }
    const frontendPath = isAdminRole(user.role) ? "/admin" : "/app";
    const userData = {
      _id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      verified: user.verified,
      avatar: user.avatar || user.profile?.avatar,
      profile: {
        ...user.profile,
        avatar: user.profile?.avatar || user.avatar
      }
    };
    console.log('OAuth userData for frontend:', userData);
    
    const redirectUrl = `${frontendBaseUrl}${frontendPath}?token=${token}&user=${encodeURIComponent(JSON.stringify(userData))}`;
    console.log('🔗 Redirecting to frontend:', redirectUrl);
    res.redirect(redirectUrl);
  } catch (error) {
    console.error("Google callback error:", error);
    const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendBaseUrl}/login?error=oauth_failed`);
  }
}
