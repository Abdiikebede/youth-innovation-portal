import express from 'express';
import { User } from '../models/User';
import { db } from '../services/database';
import { sendNotification } from '../services/notification';

const router = express.Router();

// Check user verification status
router.get('/check/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await db.findUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if user is already verified
    if (user.verified) {
      return res.json({ isVerified: true, hasPending: false });
    }
    
    // Check for pending or approved application in verificationApplications collection
    const existingApp = await db.verificationApplications.findOne({
      userId: userId,
      status: { $in: ['pending', 'approved'] }
    });
    
    const hasPendingApp = !!existingApp;
    
    console.log(`Checking verification for user ${userId}:`, {
      userExists: !!user,
      isVerified: user.verified,
      hasPendingApp,
      applicationStatus: existingApp?.status || 'none'
    });
    
    res.json({
      canApply: !user.verified && !hasPendingApp,
      isVerified: user.verified,
      hasPending: hasPendingApp
    });
  } catch (error) {
    console.error('Check verification status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Submit verification application
router.post('/', async (req, res) => {
  try {
    const { userId, info } = req.body;
    console.log('🔄 Received application submission:', { userId, info });
    
    // Validate request data
    if (!userId) {
      console.error('❌ Missing userId in request');
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    if (!info) {
      console.error('❌ Missing info in request');
      return res.status(400).json({ error: 'Application info is required' });
    }
    
    const user = await db.findUserById(userId);
    if (!user) {
      console.error('❌ User not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log('✅ User found:', { id: user._id, email: user.email });
    
    // Check if user already has a pending or approved application in verificationApplications collection
    const existingApplication = await db.verificationApplications.findOne({
      userId: userId,
      status: { $in: ['pending', 'approved'] }
    });
    
    if (existingApplication) {
      console.log('⚠️ User already has application:', existingApplication.status);
      if (existingApplication.status === 'approved') {
        return res.status(400).json({ error: 'You are already verified.' });
      }
      return res.status(400).json({ error: 'You already have a pending application.' });
    }
    // Validate sector against allowed list
    const ALLOWED_SECTORS = ["Education", "Technology", "Agriculture", "Health"] as const;
    if (!info.sector || !(ALLOWED_SECTORS as readonly string[]).includes(info.sector)) {
      return res.status(400).json({ error: 'Invalid sector. Allowed: Education, Technology, Agriculture, Health' });
    }

    // Build a complete verificationApplication object
    const verificationApplication = {
      type: info.type || 'individual',
      sector: info.sector,
      projectTitle: info.projectTitle || '',
      projectDescription: info.projectDescription || '',
      githubUrl: info.githubUrl || '',
      githubUsername: info.githubUsername || '',
      teamMembers: info.teamMembers || [],
      duration: info.duration || info.teamSize || '1', // Handle both duration and teamSize
      status: 'pending',
      submittedAt: new Date(),
    };
    // Store application in verificationApplications collection
    const applicationWithUser = {
      ...verificationApplication,
      userId: userId,
      userEmail: user.email,
      userName: `${user.firstName} ${user.lastName}`,
    };
    
    const savedApplication = await db.createVerificationApplication(applicationWithUser);
    if (!savedApplication) {
      console.error('Failed to save application to collection:', { userId, verificationApplication });
      return res.status(500).json({ error: 'Failed to store application in database.' });
    }
    
    console.log('✅ Application saved to verificationApplications collection:', savedApplication._id);
    // Send notification to the applicant (do not await)
    sendNotification(
      userId,
      'Your verification is under review. You will be notified once the admin reviews your application.',
      'application_update',
      'Application Pending'
    );

    // Notify all admins with exact username about new verification application
    try {
      const admins = await db.users.find({ role: 'admin' } as any, { projection: { _id: 1 } } as any).toArray();
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User';
      const notif = {
        type: 'application',
        title: 'Verification application',
        message: `New verification application from ${fullName}`,
        username: fullName,
        read: false,
        createdAt: new Date(),
      } as any;
      for (const a of admins) {
        const adminId = a._id?.toString?.() || a._id;
        if (!adminId) continue;
        await db.notifications.insertOne({ ...notif, userId: adminId } as any);
      }
    } catch (e) {
      console.warn('Failed to create admin notification for verification application:', e);
    }
    res.json({ message: 'Application submitted successfully.' });
  } catch (error) {
    console.error('Submit verification error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
