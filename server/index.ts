// Load environment variables FIRST before any other imports
import dotenv from 'dotenv';
dotenv.config();

// Debug environment variables immediately after loading
console.log('🔧 Environment Variables Loaded:');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'Present' : 'MISSING');
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'Present' : 'MISSING');

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, readdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { db } from './services/database.js';
import { handleRegister, handleLogin, handleGetProfile, handleUpdateProfile, handleDeleteAccount, handleForgotPassword, handleResetPassword } from './routes/auth.js';
import { avatarUpload, handleAvatarUpload } from './routes/avatar-upload';
import { upload } from './middleware/upload';
import { authenticateToken } from './middleware/auth.js';
import { handleGoogleAuth, handleGoogleCallback } from './routes/oauth.js';
import { handleGithubAuth, handleGithubCallback } from './routes/github.js';
import verificationRoutes from './routes/verification.js';
import notificationRoutes from './routes/notification.js';
import requestsRouter from './routes/requests.js';
// import VerificationApplication from './models/VerificationApplication.js';
import * as projectsRoutes from './routes/projects.js';
import * as adminRoutes from './routes/admin.js';
import * as eventsRoutes from './routes/events';
import * as statsRoutes from './routes/stats';
import chatRouter from './routes/chat';
import { ensureIndex } from './rag/buildIndex';

// Enforce required env vars in production
if (process.env.NODE_ENV === 'production') {
  const missing: string[] = []
  if (!process.env.JWT_SECRET) missing.push('JWT_SECRET')
  if (!process.env.MONGODB_URI) missing.push('MONGODB_URI')
  if (!process.env.GOOGLE_CLIENT_ID) missing.push('GOOGLE_CLIENT_ID')
  if (!process.env.GOOGLE_CLIENT_SECRET) missing.push('GOOGLE_CLIENT_SECRET')
  if (missing.length) {
    console.error('❌ Missing required environment variables:', missing.join(', '))
    process.exit(1)
  }
}

// Connect to database
db.connect().catch(console.error);
// Ensure RAG index exists on startup (non-blocking)
ensureIndex().catch(err => console.error('RAG ensureIndex failed:', err));

const app = express();
// Security headers
app.use(helmet());
// CORS configuration
const corsOrigin = process.env.FRONTEND_URL || true;
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
);
// Rate limiting for sensitive routes
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
const chatLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
app.use('/api/auth', authLimiter);
app.use('/api/chat', chatLimiter);
app.use(express.json());
// Serve static files
app.use('/avatars', express.static('public/avatars'));

// Configure uploads directory path
const uploadsPath = path.join(process.cwd(), 'server', 'uploads');
console.log('🔍 Uploads directory path:', uploadsPath);

// Create uploads directory if it doesn't exist
if (!existsSync(uploadsPath)) {
  console.log('ℹ️ Uploads directory not found, creating it...');
  mkdirSync(uploadsPath, { recursive: true });
}

// Log directory contents for debugging
try {
  const files = readdirSync(uploadsPath);
  console.log('🔍 Uploads directory contents:', files);
} catch (err) {
  console.error('❌ Error reading uploads directory:', err);
}

// Simple static file serving for uploads
app.use('/uploads', express.static(uploadsPath, {
  setHeaders: (res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Access-Control-Allow-Origin', '*');
  }
}));

console.log('📁 Serving uploads from:', uploadsPath);

// Test endpoint to verify file serving
app.get('/test-upload/:filename', (req, res) => {
  const filePath = path.join(uploadsPath, req.params.filename);
  console.log('🔍 Testing file path:', filePath);
  console.log('📂 File exists:', existsSync(filePath) ? '✅ Yes' : '❌ No');
  
  if (existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'File not found', path: filePath });
  }
});

// Public: get a short user summary by ID (for author dialogs)
app.get('/api/users/:id/summary', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await db.findUserById(id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const ghUsername = (user as any).githubUsername || (user as any)?.githubStats?.username;
    const githubUrl = (user as any).githubUrl || (ghUsername ? `https://github.com/${ghUsername}` : undefined);
    const followersCount = Array.isArray((user as any).followers) ? (user as any).followers.length : ((user as any).followersCount || 0);
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || (user as any).name || '';
    res.json({
      _id: (user as any)._id?.toString?.() || id,
      fullName,
      email: user.email,
      followersCount,
      githubUsername: ghUsername,
      githubUrl,
    });
  } catch (e) {
    console.error('❌ user summary failed:', e);
    res.status(500).json({ error: 'Failed to load user summary' });
  }
});

// Direct file test endpoint
app.get('/test-file', (req, res) => {
  const testFile = path.join(uploadsPath, '1754583031989-365426656-image-6.png');
  
  if (existsSync(testFile)) {
    console.log('✅ Test file exists at:', testFile);
    res.sendFile(testFile);
  } else {
    console.error('❌ Test file not found at:', testFile);
    res.status(404).json({
      error: 'File not found',
      path: testFile,
      exists: existsSync(testFile),
      files: existsSync(uploadsPath) ? readdirSync(uploadsPath) : []
    });
  }
});

// Direct image serving route
app.get('/image/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(uploadsPath, filename);
  
  console.log('📤 Direct image request for:', filePath);
  
  if (existsSync(filePath)) {
    console.log('✅ File found, sending...');
    res.sendFile(filePath);
  } else {
    console.error('❌ File not found:', filePath);
    res.status(404).json({
      error: 'File not found',
      path: filePath,
      uploadsDir: uploadsPath,
      files: existsSync(uploadsPath) ? readdirSync(uploadsPath) : []
    });
  }
});

// Test endpoint to verify file access
app.get('/test-upload', (req, res) => {
  const testFilePath = path.join(uploadsPath, '1754583031989-365426656-image-6.png');
  const fileExists = existsSync(testFilePath);
  
  res.json({
    uploadsPath,
    testFile: '1754583031989-365426656-image-6.png',
    fileExists,
    filePath: testFilePath,
    directoryContents: existsSync(uploadsPath) ? readdirSync(uploadsPath) : []
  });
});

// Import the projects router with multer middleware
import projectsRouter from './routes/projects';
import notificationsRouter from './routes/notification';

// Projects routes - public GET, protected POST (handled in router)
app.use('/api/projects', projectsRouter);
// Notifications routes
app.use('/api/notifications', notificationsRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    message: process.env.PING_MESSAGE || "pong from Innovation Portal",
    timestamp: new Date().toISOString(),
  });
});

// Auth routes
app.post("/api/auth/register", handleRegister);
app.post("/api/auth/login", handleLogin);
// Forgot/Reset password endpoints
app.post("/api/auth/forgot-password", handleForgotPassword);
app.post("/api/auth/reset-password", handleResetPassword);
app.get("/api/auth/profile", authenticateToken, handleGetProfile);
app.put("/api/auth/profile", authenticateToken, handleUpdateProfile);
app.post("/api/auth/avatar", authenticateToken, avatarUpload.single('avatar'), handleAvatarUpload);
app.delete("/api/auth/account", authenticateToken, handleDeleteAccount);

// General image upload endpoint
app.post("/api/upload", upload.single('image'), (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    
    const imageUrl = `http://localhost:8081/uploads/${req.file.filename}`;
    console.log('✅ Image uploaded successfully:', imageUrl);
    res.json({ imageUrl });
  } catch (error) {
    console.error('❌ Image upload error:', error);
    res.status(500).json({ error: "Failed to upload image" });
  }
});

// Google OAuth routes
app.get("/api/auth/google", handleGoogleAuth);
app.get("/api/auth/google/callback", handleGoogleCallback);

// GitHub OAuth routes
app.get("/api/auth/github", handleGithubAuth);
app.get("/api/auth/github/callback", handleGithubCallback);

// Verification routes
app.use('/api/verification', verificationRoutes);

// Admin routes
app.get('/api/admin/applications', authenticateToken, adminRoutes.requireAdmin, adminRoutes.handleGetPendingApplications);
app.get('/api/admin/stats', authenticateToken, adminRoutes.requireAdmin, adminRoutes.handleGetDashboardStats);
app.get('/api/admin/notifications', authenticateToken, adminRoutes.requireAdmin, adminRoutes.handleGetNotifications);
app.get('/api/admin/requests', authenticateToken, adminRoutes.requireAdmin, adminRoutes.handleGetAllRequests);
app.get('/api/admin/users', authenticateToken, adminRoutes.requireAdmin, adminRoutes.handleGetAllUsers);
app.post('/api/admin/create-admin', authenticateToken, adminRoutes.requireAdmin, adminRoutes.handleCreateAdmin);
// New: suspend a user (verified=false)
app.post('/api/admin/users/:userId/suspend', authenticateToken, adminRoutes.requireAdmin, adminRoutes.handleSuspendUser);
// New: revoke an admin (delete from admins collection)
app.delete('/api/admin/admins/:adminId', authenticateToken, adminRoutes.requireAdmin, adminRoutes.handleDeleteAdmin);
app.put('/api/admin/requests/:requestId/status', authenticateToken, adminRoutes.requireAdmin, adminRoutes.handleUpdateRequestStatus);
app.post('/api/admin/requests/bulk-submit', authenticateToken, adminRoutes.requireAdmin, adminRoutes.handleBulkSubmitRequests);
app.post('/api/admin/applications/:applicationId/approve', authenticateToken, adminRoutes.requireAdmin, adminRoutes.handleApproveApplication);
app.post('/api/admin/applications/:applicationId/reject', authenticateToken, adminRoutes.requireAdmin, adminRoutes.handleRejectApplication);
// SuperAdmin event moderation routes
app.get('/api/admin/events/pending', authenticateToken, adminRoutes.requireAdmin, adminRoutes.handleGetPendingEvents);
app.post('/api/admin/events/:eventId/approve', authenticateToken, adminRoutes.requireAdmin, adminRoutes.handleApproveEvent);
app.post('/api/admin/events/:eventId/reject', authenticateToken, adminRoutes.requireAdmin, adminRoutes.handleRejectEvent);

// Events routes
app.get('/api/events', eventsRoutes.handleGetEvents);
app.get('/api/events/:id', eventsRoutes.handleGetEvent);
app.post('/api/events', authenticateToken, ...eventsRoutes.handleCreateEvent);
app.put('/api/events/:id', authenticateToken, eventsRoutes.handleUpdateEvent);
app.delete('/api/events/:id', authenticateToken, eventsRoutes.handleDeleteEvent);

// Stats routes
app.get('/api/stats', statsRoutes.handleGetStats);

// Notification routes
app.use('/api/notifications', notificationRoutes);

// Requests routes (funding & certificate)
app.use('/api/requests', requestsRouter);

// Projects routes (create/list/like/follow/comment/edit/delete)
app.use('/api/projects', projectsRoutes.default);

// Chat (RAG) route
app.use('/api/chat', chatRouter);

// Error handling middleware
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error('Global error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  },
);

// 404 handler (move to very end)
app.use("*", (_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

const PORT = Number(process.env.PORT) || 8081;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
