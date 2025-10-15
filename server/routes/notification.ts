import express from 'express';
import { getUserNotifications, markNotificationRead, markAllNotificationsRead } from '../services/notification';
import { authenticateToken } from '../middleware/auth';

// Extend Express Request type to include user property
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

const router = express.Router();

// Get all notifications for current user
router.get('/', authenticateToken, async (req, res) => {
  // Extract userId from JWT payload (should be a string)
  const userId = req.user?.userId;
  // Validate userId exists and is a string
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'Invalid userId in token' });
  }
  const notifications = await getUserNotifications(userId);
  res.json({ notifications });
});

// Mark notification as read
router.post('/:id/read', authenticateToken, async (req, res) => {
  await markNotificationRead(req.params.id);
  res.json({ success: true });
});

// Mark all notifications as read for current user
router.post('/read-all', authenticateToken, async (req, res) => {
  const userId = req.user?.userId;
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'Invalid userId in token' });
  }
  const ok = await markAllNotificationsRead(userId);
  if (!ok) return res.status(500).json({ error: 'Failed to mark notifications as read' });
  res.json({ success: true });
});

export default router;
