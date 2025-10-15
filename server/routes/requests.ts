import express from 'express';
import { db } from '../services/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { uploadDocs } from '../middleware/upload';

const router = express.Router();

// Create a new request (funding or certificate)
// Accept JSON or multipart with optional 'proposal' file (PDF/DOC/DOCX)
router.post('/', authenticateToken, uploadDocs.single('proposal'), async (req: any, res) => {
  try {
    const { type, title, amount, description, projectLink, certificateType, link } = req.body || {};
    if (!type || !['funding', 'certificate'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Must be funding or certificate.' });
    }

    const now = new Date();
    // Ensure we persist the real user id from JWT payload
    const jwtUser: any = req.user || {};
    const userIdFromJwt = jwtUser.userId;
    const userId = typeof userIdFromJwt === 'string' && userIdFromJwt.length > 0
      ? userIdFromJwt
      : undefined;
    if (!userId) {
      return res.status(401).json({ error: 'Unable to determine user id' });
    }

    const doc: any = {
      userId,
      type,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    if (type === 'funding') {
      const amt = Number(amount);
      if (!title || !amount || isNaN(amt) || amt <= 0) {
        return res.status(400).json({ error: 'title and amount (>0) are required for funding request' });
      }
      doc.title = title;
      doc.amount = amt;
      if (req.file && req.file.filename) {
        // Save relative URL to static uploads mount
        doc.proposalUrl = `/uploads/${req.file.filename}`;
        doc.proposalOriginalName = req.file.originalname;
        doc.proposalMime = req.file.mimetype;
      }
    } else if (type === 'certificate') {
      if (!certificateType || !description || !link) {
        return res.status(400).json({ error: 'certificateType, description and link are required for certificate request' });
      }
      doc.certificateType = certificateType;
      doc.description = description;
      doc.link = link;
    }

    // Insert into primary `requests` collection only
    const result = await db.requests.insertOne(doc);

    // Notify all admins about this new request, with the requester's name
    try {
      const requester = await db.findUserById(userId);
      const rName = requester ? `${requester.firstName || ''} ${requester.lastName || ''}`.trim() : 'Unknown User';
      // Case-insensitive admin role to ensure all admins receive notifications
      const admins = await db.users.find({ role: { $regex: /^admin$/i } } as any, { projection: { _id: 1 } } as any).toArray();
      const notifType = type; // 'funding' | 'certificate'
      const title = type === 'funding' ? 'Funding request' : 'Certificate request';
      const message = `New request for ${type} from ${rName}`;
      const notif = {
        type: notifType,
        title,
        message,
        username: rName,
        read: false,
        createdAt: now,
      } as any;
      for (const a of admins) {
        const adminId = a._id?.toString?.() || a._id;
        if (!adminId) continue;
        await db.notifications.insertOne({ ...notif, userId: adminId } as any);
      }
    } catch (e) {
      console.warn('Failed to create admin notification for request:', e);
    }

    return res.status(201).json({ _id: result.insertedId, ...doc });
  } catch (err) {
    console.error('create request error:', err);
    return res.status(500).json({ error: 'Failed to create request' });
  }
});

// Get current user's requests
router.get('/', authenticateToken, async (req: any, res) => {
  try {
    // Use the same field saved during creation: req.user.userId
    const userIdFromJwt = req.user?.userId ?? req.user?.id ?? req.user?._id ?? req.user;
    if (!userIdFromJwt) {
      return res.status(401).json({ error: 'Unable to determine user id' });
    }
    const userId = typeof userIdFromJwt === 'string' ? userIdFromJwt : String(userIdFromJwt);
    const items = await db.requests
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();
    return res.json({ requests: items });
  } catch (err) {
    console.error('list requests error:', err);
    return res.status(500).json({ error: 'Failed to load requests' });
  }
});

export default router;
