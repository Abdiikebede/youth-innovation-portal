import { RequestHandler } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { db } from "../services/database";
import { sendPasswordResetEmail } from "../services/email";

const registerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(6),
});

export const handleRegister: RequestHandler = async (req, res) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    
    // Check if user already exists in both collections
    const existingUser = await db.findUserByEmail(validatedData.email);
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Hash password with consistent salt rounds (12 for all users)
    const hashedPassword = await bcrypt.hash(validatedData.password, 12);

    // Create user with proper structure - default role is "user"
    const user = await db.createUser({
      email: validatedData.email,
      password: hashedPassword,
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      profileComplete: false,
      verified: false, // Require admin approval to verify innovator status
      role: "user", // Explicitly set as regular user
    });

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email, role: user.role },
      process.env.JWT_SECRET || "dev-secret",
      { expiresIn: "7d" }
    );

    // Remove password from response
    const { password, ...userWithoutPassword } = user;

    res.status(201).json({
      message: "User registered successfully",
      user: userWithoutPassword,
      token,
    });
  } catch (error) {
    console.error("Registration error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input data", details: error.errors });
    }
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleLogin: RequestHandler = async (req, res) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    
    // Validate user credentials
    const validUser = await db.validateUser(validatedData.email, validatedData.password);
    
    if (!validUser) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    // Generate JWT token with consistent format
    const token = jwt.sign(
      { userId: validUser._id, email: validUser.email, role: validUser.role },
      process.env.JWT_SECRET || "dev-secret",
      { expiresIn: "7d" }
    );
    
    res.json({
      message: "Login successful",
      user: validUser,
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input data", details: error.errors });
    }
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleForgotPassword: RequestHandler = async (req, res) => {
  try {
    const validatedData = forgotPasswordSchema.parse(req.body);
    
    // Find user
    const user = await db.findUserByEmail(validatedData.email);
    if (!user) {
      // Don't reveal if user exists or not
      return res.json({ message: "If the email exists, reset instructions have been sent" });
    }

    // Generate a secure token and expiry (1 hour)
    const crypto = await import('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save token and expiry to user
    await db.updateUser(user._id.toString(), {
      resetPasswordToken: token,
      resetPasswordExpires: expires,
    });

    // Send password reset email
    const emailSent = await sendPasswordResetEmail(validatedData.email, token);
    
    if (emailSent) {
      console.log(`Password reset email sent to: ${validatedData.email}`);
    } else {
      console.log(`Failed to send password reset email to: ${validatedData.email}`);
    }

    res.json({ message: "If the email exists, reset instructions have been sent" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input data", details: error.errors });
    }
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleResetPassword: RequestHandler = async (req, res) => {
  try {
    const validatedData = resetPasswordSchema.parse(req.body);
    
    // Find user with valid reset token
    const user = await db.findUserByResetToken(validatedData.token);
    if (!user) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    // Check if token is expired
    if (!user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
      return res.status(400).json({ error: "Reset token has expired" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(validatedData.password, 12);

    // Update user password and clear reset token
    await db.updateUser(user._id.toString(), {
      password: hashedPassword,
      resetPasswordToken: undefined,
      resetPasswordExpires: undefined,
    });

    res.json({ message: "Password successfully reset" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input data", details: error.errors });
    }
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleGetProfile: RequestHandler = async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const user = await db.findUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Derive GitHub username/url if missing, without mutating DB
    const ghUsername = (user as any).githubUsername || (user as any).githubStats?.username;
    let ghUrl = (user as any).githubUrl as string | undefined;
    if (!ghUrl && ghUsername) ghUrl = `https://github.com/${ghUsername}`;

    // Remove password from response and attach derived fields
    const { password, ...userWithoutPassword } = user as any;
    const responseUser = { ...userWithoutPassword } as any;
    if (ghUsername && !responseUser.githubUsername) responseUser.githubUsername = ghUsername;
    if (ghUrl && !responseUser.githubUrl) responseUser.githubUrl = ghUrl;
    res.json({ user: responseUser });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const updateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  bio: z.string().optional(),
  location: z.string().optional(),
  githubUrl: z.string().optional(),
});

export const handleUpdateProfile: RequestHandler = async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    console.log("🔍 Profile update request body:", req.body);
    const validatedData = updateProfileSchema.parse(req.body);
    console.log("✅ Validated data:", validatedData);
    
    const updateResult = await db.updateUser(userId, validatedData);
    if (!updateResult) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get the updated user data
    const updatedUser = await db.findUserById(userId);
    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = updatedUser;
    res.json({ user: userWithoutPassword, message: "Profile updated successfully" });
  } catch (error) {
    console.error("❌ Update profile error:", error);
    if (error instanceof z.ZodError) {
      console.error("🚫 Validation errors:", error.errors);
      return res.status(400).json({ 
        error: "Validation failed", 
        details: error.errors,
        message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      });
    }
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete the authenticated user's account and related data
export const handleDeleteAccount: RequestHandler = async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const role = (req as any).user?.role;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Do not allow admins to self-delete via this endpoint
    if (role === "admin") {
      return res.status(403).json({ error: "Admins cannot delete account via this endpoint" });
    }

    const success = await db.deleteUserCascade(userId);
    if (!success) {
      return res.status(500).json({ error: "Failed to delete account" });
    }

    // Client should clear tokens and local state upon success
    return res.json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("❌ Delete account error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
