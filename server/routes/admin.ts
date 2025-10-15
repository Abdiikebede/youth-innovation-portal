import { RequestHandler } from "express";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { db } from "../services/database";
import { Request as ExpressRequest } from 'express';
import bcrypt from 'bcryptjs';

const createEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(10),
  type: z.enum(["hackathon", "workshop", "competition", "announcement"]),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  location: z.string().optional(),
  isVirtual: z.boolean().default(false),
  maxParticipants: z.number().positive().optional(),
  registrationDeadline: z.string().datetime().optional(),
  requirements: z.array(z.string()).optional(),
  prizes: z.array(z.string()).optional(),
  organizer: z.object({
    name: z.string().min(1),
    userId: z.string(),
  }).optional(),
});

// Middleware to check admin role
export const requireAdmin: RequestHandler = async (req, res, next) => {
  try {
    const user = (req as any).user;
    const role = (user?.role || '').toString().toLowerCase();
    // Allow both admin and superadmin to access admin routes
    if (!user || (role !== "admin" && role !== "superadmin")) {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

// Superadmin: list events pending approval
export const handleGetPendingEvents: RequestHandler = async (req, res) => {
  try {
    const user = (req as any).user;
    const role = (user?.role || '').toString().toLowerCase();
    if (role !== 'superadmin') return res.status(403).json({ error: 'SuperAdmin access required' });
    const events = await db.events.find({ status: 'pending_approval' } as any).sort({ createdAt: -1 }).toArray();
    const formatted = events.map((e: any) => ({ ...e, id: e._id?.toString?.() }));
    res.json({ events: formatted });
  } catch (e) {
    console.error('Get pending events failed:', e);
    res.status(500).json({ error: 'Failed to load pending events' });
  }
};

// Superadmin: approve a pending event -> publish + notifications
export const handleApproveEvent: RequestHandler = async (req, res) => {
  try {
    const user = (req as any).user;
    const role = (user?.role || '').toString().toLowerCase();
    // Allow both admin and superadmin for faster moderation flow
    if (role !== 'superadmin' && role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const { eventId } = req.params as any;
    if (!eventId) return res.status(400).json({ error: 'eventId is required' });

    const result = await db.events.findOneAndUpdate(
      { _id: new ObjectId(eventId) } as any,
      { $set: { status: 'published' as any, registrationOpen: true, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    const updated: any = (result as any)?.value ?? result;
    if (!updated) return res.status(404).json({ error: 'Event not found' });

    // Broadcast notifications to users
    try {
      const title = updated.title || 'An event';
      const type = updated.type || 'event';
      const eventIdStr = updated._id?.toString?.();
      const usersCursor = db.users.find({ role: { $regex: /^user$/i } }, { projection: { _id: 1 } } as any);
      const users = await usersCursor.toArray();
      if (users && users.length) {
        const docs = users.map((u: any) => ({
          userId: (u._id || '').toString(),
          type: 'event_reminder',
          title: 'New event posted',
          message: `${title} — ${type} just went live. Tap to view and register!`,
          read: false,
          data: { eventId: eventIdStr, eventType: type, startDate: updated.startDate, registrationDeadline: updated.registrationDeadline },
          createdAt: new Date(),
        }));
        if (docs.length) await db.notifications.insertMany(docs as any[]);
      }
    } catch (e) {
      console.warn('approveEvent: notify users failed (non-fatal):', e);
    }

    res.json({ event: { ...updated, id: updated._id?.toString?.() } });
  } catch (e) {
    console.error('Approve event error:', e);
    res.status(500).json({ error: 'Failed to approve event' });
  }
};

// Superadmin: reject a pending event -> mark rejected
export const handleRejectEvent: RequestHandler = async (req, res) => {
  try {
    const user = (req as any).user;
    const role = (user?.role || '').toString().toLowerCase();
    // Allow both admin and superadmin for faster moderation flow
    if (role !== 'superadmin' && role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const { eventId } = req.params as any;
    if (!eventId) return res.status(400).json({ error: 'eventId is required' });

    const result = await db.events.findOneAndUpdate(
      { _id: new ObjectId(eventId) } as any,
      { $set: { status: 'rejected' as any, registrationOpen: false, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    const updated: any = (result as any)?.value ?? result;
    if (!updated) return res.status(404).json({ error: 'Event not found' });

    res.json({ event: { ...updated, id: updated._id?.toString?.() } });
  } catch (e) {
    console.error('Reject event error:', e);
    res.status(500).json({ error: 'Failed to reject event' });
  }
};

// Suspend a regular user by setting verified=false
export const handleSuspendUser: RequestHandler = async (req, res) => {
  try {
    const currentUser = (req as any).user;
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const { userId } = req.params as any;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const user = await db.users.findOne({ _id: userId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    await db.users.updateOne(
      { _id: userId },
      { $set: { verified: false, updatedAt: new Date() } }
    );

    res.json({ message: 'User suspended (verified=false)' });
  } catch (error) {
    console.error('Suspend user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Revoke an admin by deleting from admins collection
export const handleDeleteAdmin: RequestHandler = async (req, res) => {
  try {
    const currentUser = (req as any).user;
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const { adminId } = req.params as any;
    if (!adminId) return res.status(400).json({ error: 'adminId is required' });

    const admin = await db.admins.findOne({ _id: adminId });
    if (!admin) return res.status(404).json({ error: 'Admin not found' });

    await db.admins.deleteOne({ _id: adminId });
    res.json({ message: 'Admin revoked (deleted)' });
  } catch (error) {
    console.error('Delete admin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Admin: bulk mark multiple requests as submitted (irreversible)
export const handleBulkSubmitRequests: RequestHandler = async (req, res) => {
  try {
    const admin = (req as any).user;
    const role = (admin?.role || '').toString().toLowerCase();
    if (!admin || (role !== 'admin' && role !== 'superadmin')) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const body = (req as ExpressRequest).body as { requestIds?: string[] };
    const ids = Array.isArray(body?.requestIds) ? body.requestIds : [];
    const objectIds = ids
      .map((id) => { try { return new ObjectId(id); } catch { return null; } })
      .filter((x): x is ObjectId => !!x);
    if (objectIds.length === 0) return res.status(400).json({ error: 'No valid requestIds provided' });

    const toUpdate = await db.requests.find({ _id: { $in: objectIds }, status: { $ne: 'submitted' } as any } as any).toArray();
    if (toUpdate.length === 0) return res.json({ message: 'No pending items to submit', updated: 0 });

    const idsToUpdate = toUpdate.map((r: any) => r._id);
    await db.requests.updateMany(
      { _id: { $in: idsToUpdate } } as any,
      { $set: { status: 'submitted', updatedAt: new Date() } }
    );

    // Notify each affected user
    for (const r of toUpdate) {
      const userId = r.userId?.toString?.() || r.userId;
      if (!userId) continue;
      await db.notifications.insertOne({
        userId,
        type: 'request-status',
        title: 'Request status updated',
        message: `Your ${r.type || 'request'} has been marked as 'submitted'. We will contact you soon through your email address. Please check your email and respond promptly.`,
        read: false,
        createdAt: new Date(),
      } as any);
    }

    return res.json({ message: 'Requests marked as submitted', updated: idsToUpdate.length });
  } catch (error) {
    console.error('Bulk submit requests error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Admin: update a single funding/certificate request status and notify the user
export const handleUpdateRequestStatus: RequestHandler = async (req, res) => {
  try {
    const admin = (req as any).user;
    const role = (admin?.role || '').toString().toLowerCase();
    if (!admin || (role !== 'admin' && role !== 'superadmin')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { requestId } = (req.params || {}) as { requestId?: string };
    const body = (req as ExpressRequest).body as { status?: string; note?: string };

    if (!requestId) {
      return res.status(400).json({ error: 'Missing requestId' });
    }

    const parsed = z.object({ status: z.enum(['pending', 'submitted']) }).safeParse(body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid status. Allowed: pending | submitted' });
    }

    const _id = (() => { try { return new ObjectId(requestId); } catch { return null; } })();
    if (!_id) return res.status(400).json({ error: 'Invalid requestId' });

    const existing = await db.requests.findOne({ _id });
    if (!existing) return res.status(404).json({ error: 'Request not found' });

    // Irreversible: once 'submitted', cannot go back to 'pending'
    if (String(existing.status).toLowerCase() === 'submitted' && parsed.data.status === 'pending') {
      return res.status(400).json({ error: "Submitted requests can't be reverted to pending" });
    }
    // Idempotency: if already submitted, don't allow (or need) submitting again
    if (String(existing.status).toLowerCase() === 'submitted' && parsed.data.status === 'submitted') {
      return res.status(400).json({ error: 'Request is already submitted' });
    }
    // Update status
    await db.requests.updateOne(
      { _id },
      { $set: { status: parsed.data.status, updatedAt: new Date() } }
    );

    // Send notification to the requester
    const userId = existing.userId?.toString?.() || existing.userId;
    if (userId) {
      await db.notifications.insertOne({
        userId,
        type: 'request-status',
        title: 'Request status updated',
        message: `Your ${existing.type || 'request'} has been marked as '${parsed.data.status}'. We will contact you soon through your email address. Please check your email and respond promptly.`,
        read: false,
        createdAt: new Date(),
      } as any);
    }

    return res.json({ message: 'Status updated', status: parsed.data.status });
  } catch (error) {
    console.error('Update request status error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Admin: fetch all user requests (funding & certificate)
export const handleGetAllRequests: RequestHandler = async (_req, res) => {
  try {
    const items = await db.requests.aggregate([
      // Only funding and certificate should appear in admin response sidebar
      { $match: { type: { $in: ['funding', 'certificate'] } } },
      { $sort: { createdAt: -1 } },
      {
        $addFields: {
          userIdStr: {
            $cond: [
              { $eq: [{ $type: '$userId' }, 'string'] },
              {
                $cond: [
                  { $eq: ['$userId', '[object Object]'] },
                  null,
                  '$userId'
                ]
              },
              {
                $cond: [
                  { $eq: [{ $type: '$userId' }, 'object'] },
                  {
                    $let: {
                      vars: { u: '$userId' },
                      in: {
                        $ifNull: [
                          '$$u.userId',
                          {
                            $cond: [
                              { $ne: [{ $type: '$$u._id' }, 'missing'] },
                              {
                                $cond: [
                                  { $eq: [{ $type: '$$u._id' }, 'objectId'] },
                                  { $toString: '$$u._id' },
                                  '$$u._id'
                                ]
                              },
                              null
                            ]
                          }
                        ]
                      }
                    }
                  },
                  null
                ]
              }
            ]
          },
          userObjectId: {
            $cond: [
              { $eq: [{ $type: '$userId' }, 'objectId'] },
              '$userId',
              { $convert: { input: '$userIdStr', to: 'objectId', onError: null, onNull: null } }
            ]
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          let: { uid: '$userObjectId', uidStr: '$userIdStr' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $and: [ { $ne: ['$$uid', null] }, { $eq: ['$_id', '$$uid'] } ] },
                    // Also match when request has string id and users._id may be string/ObjectId
                    { $and: [ { $ne: ['$$uidStr', null] }, { $eq: [ { $toString: '$_id' }, '$$uidStr' ] } ] },
                    { $and: [ { $ne: ['$$uidStr', null] }, { $eq: ['$googleId', '$$uidStr'] } ] },
                    { $and: [ { $ne: ['$$uidStr', null] }, { $eq: ['$email', '$$uidStr'] } ] },
                    { $and: [ { $ne: ['$$uidStr', null] }, { $eq: ['$userId', '$$uidStr'] } ] },
                    { $and: [ { $ne: ['$$uidStr', null] }, { $eq: ['$authId', '$$uidStr'] } ] },
                    { $and: [ { $ne: ['$$uidStr', null] }, { $eq: ['$providerId', '$$uidStr'] } ] },
                    { $and: [ { $ne: ['$$uidStr', null] }, { $eq: ['$oauthId', '$$uidStr'] } ] },
                    { $and: [ { $ne: ['$$uidStr', null] }, { $eq: ['$sub', '$$uidStr'] } ] }
                  ]
                }
              }
            },
            { $project: { firstName: 1, lastName: 1, email: 1, avatar: 1, profileImage: 1, photo: 1, image: 1, picture: 1, name: 1 } }
          ],
          as: 'userInfo'
        }
      },
      {
        $addFields: {
          _uFirst: { $arrayElemAt: ['$userInfo.firstName', 0] },
          _uLast: { $arrayElemAt: ['$userInfo.lastName', 0] },
          _uEmail: { $arrayElemAt: ['$userInfo.email', 0] },
          _uAvatarRaw: { $arrayElemAt: ['$userInfo.avatar', 0] },
          _uProfileImage: { $arrayElemAt: ['$userInfo.profileImage', 0] },
          _uPhoto: { $arrayElemAt: ['$userInfo.photo', 0] },
          _uImage: { $arrayElemAt: ['$userInfo.image', 0] },
          _uPicture: { $arrayElemAt: ['$userInfo.picture', 0] },
          _uName: { $arrayElemAt: ['$userInfo.name', 0] }
        }
      },
      {
        $addFields: {
          userFirstName: {
            $ifNull: ['$_uFirst', { $let: { vars: { nm: '$_uName' }, in: { $cond: [{ $ifNull: ['$$nm', false] }, { $arrayElemAt: [{ $split: ['$$nm', ' '] }, 0] }, null] } } }]
          },
          userLastName: {
            $ifNull: ['$_uLast', null]
          },
          userEmail: '$_uEmail',
          userAvatar: { $ifNull: ['$_uAvatarRaw', { $ifNull: ['$_uProfileImage', { $ifNull: ['$_uPhoto', { $ifNull: ['$_uImage', '$_uPicture'] }] }] }] },
          userName: {
            $ifNull: [
              '$_uName',
              {
                $trim: {
                  input: {
                    $concat: [
                      { $ifNull: ['$_uFirst', ''] },
                      ' ',
                      { $ifNull: ['$_uLast', ''] }
                    ]
                  }
                }
              }
            ]
          }
        }
      },
      { $project: { userInfo: 0, userObjectId: 0, userIdStr: 0, _uFirst: 0, _uLast: 0, _uEmail: 0, _uAvatarRaw: 0, _uProfileImage: 0, _uPhoto: 0, _uImage: 0, _uName: 0 } }
    ]).toArray();
    res.json({ requests: items });
  } catch (error) {
    console.error('Get all requests (admin) error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const handleGetDashboardStats: RequestHandler = async (req, res) => {
  try {
    console.log('🔄 Admin requesting dashboard stats');
    
    const [
      totalUsers,
      totalApplications,
      pendingApplications,
      approvedApplications,
      rejectedApplications,
      totalProjects,
      upcomingEvents,
      totalEvents,
      totalAnnouncements,
      // Only count funding & certificate for responses (exclude collaboration)
      totalFundingRequests,
      totalCertificateRequests
    ] = await Promise.all([
      db.users.countDocuments(),
      db.verificationApplications.countDocuments(),
      db.verificationApplications.countDocuments({ status: 'pending' }),
      db.verificationApplications.countDocuments({ status: 'approved' }),
      db.verificationApplications.countDocuments({ status: 'rejected' }),
      db.projects.countDocuments(),
      db.events.countDocuments({ status: 'published', startDate: { $gte: new Date() } }),
      db.events.countDocuments(),
      db.events.countDocuments({ type: 'announcement' }),
      db.requests.countDocuments({ type: 'funding' }),
      db.requests.countDocuments({ type: 'certificate' })
    ]);

    const totalResponses = (totalFundingRequests || 0) + (totalCertificateRequests || 0);

    const stats = {
      totalUsers,
      totalApplications,
      pendingApplications,
      approvedApplications,
      rejectedApplications,
      totalProjects,
      upcomingEvents,
      totalEvents,
      totalAnnouncements,
      // Backward compatibility: keep totalRequests equal to responses for existing UI
      totalRequests: totalResponses,
      totalResponses,
      totalFundingRequests,
      totalCertificateRequests,
      verificationRate: totalApplications > 0 ? Math.round((approvedApplications / totalApplications) * 100) : 0
    };
    
    console.log('✅ Dashboard stats:', stats);
    res.json({ stats });
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};



export const handleGetPendingApplications: RequestHandler = async (req, res) => {
  try {
    const { limit, status } = req.query;
    const requestedStatus = (status as string) || 'pending';
    
    console.log(`🔄 Admin requesting ${requestedStatus} applications`);
    console.log(`📊 Query params - status: ${status}, limit: ${limit}`);
    
    // For pending status, get both verification apps and event registrations
    // For other statuses, fall back to the original behavior (just verification apps)
    let applications;
    if (requestedStatus === 'pending') {
      applications = await db.getAllPendingApplications(limit ? parseInt(limit as string) : 50);
    } else {
      applications = await db.getVerificationApplicationsByStatus(
        requestedStatus, 
        limit ? parseInt(limit as string) : 50
      );
    }

    console.log(`✅ Returning ${applications.length} ${requestedStatus} applications to admin`);
    
    // Log first application structure for debugging
    if (applications.length > 0) {
      console.log(`📋 Sample ${requestedStatus} application structure:`, JSON.stringify(applications[0], null, 2));
    }
    
    res.json({ applications });
  } catch (error) {
    console.error("Get pending applications error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleApproveApplication: RequestHandler = async (req, res) => {
  try {
    const { applicationId } = req.params; // Application ID from route parameter
    const adminId = (req as any).user?.userId;
    console.log("[APPROVE] Received applicationId:", applicationId);
    let objectId;
    try {
      // Use imported ObjectId from mongodb
      objectId = typeof applicationId === 'string' ? new ObjectId(applicationId) : applicationId;
      console.log("[APPROVE] Converted to ObjectId:", objectId);
    } catch (e) {
      console.error("[APPROVE] Failed to convert to ObjectId:", e);
      return res.status(400).json({ error: "Invalid application ID" });
    }
    const result = await db.verificationApplications.findOne({ _id: objectId });
    console.log("[APPROVE] DB findOne result:", result);
    const success = await db.approveApplication(applicationId, adminId);
    if (!success) {
      return res.status(404).json({ error: "Application not found" });
    }
    // Create notification for user
    await db.createNotification({
      userId: result.userId, // Use the actual user ID from the application
      type: "application_update",
      title: "Application Approved!",
      message: "Congratulations! Your innovator application has been approved. You can now post projects and participate in all platform features.",
      read: false,
    });
    res.json({ message: "Application approved successfully" });
  } catch (error) {
    console.error("Approve application error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleRejectApplication: RequestHandler = async (req, res) => {
  try {
    const { applicationId } = req.params; // Application ID from route parameter
    const { reason } = req.body;
    const adminId = (req as any).user?.userId;
    console.log("[REJECT] Received applicationId:", applicationId);
    let objectId;
    try {
      // Use imported ObjectId from mongodb
      objectId = typeof applicationId === 'string' ? new ObjectId(applicationId) : applicationId;
      console.log("[REJECT] Converted to ObjectId:", objectId);
    } catch (e) {
      console.error("[REJECT] Failed to convert to ObjectId:", e);
      return res.status(400).json({ error: "Invalid application ID" });
    }
    const result = await db.verificationApplications.findOne({ _id: objectId });
    console.log("[REJECT] DB findOne result:", result);
    if (!result) {
      return res.status(404).json({ error: "Application not found" });
    }
    const success = await db.rejectApplication(applicationId, reason);
    if (!success) {
      return res.status(404).json({ error: "Application not found" });
    }
    // Create notification for user
    await db.createNotification({
      userId: result.userId, // Use the actual user ID from the application
      type: "application_update",
      title: "Application Update",
      message: `Your innovator application requires some improvements. Reason: ${reason}. Please update your application and resubmit.`,
      read: false,
    });
    res.json({ message: "Application rejected" });
  } catch (error) {
    console.error("Reject application error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleCreateEvent: RequestHandler = async (req, res) => {
  try {
    const adminUser = (req as any).user;
    const validatedData = createEventSchema.parse(req.body);

    const role = (adminUser?.role || '').toString().toLowerCase();
    const normalizedStatus = role === 'superadmin' ? 'published' : 'pending_approval';
    const event = await db.createEvent({
      title: validatedData.title,
      description: validatedData.description,
      type: validatedData.type,
      startDate: new Date(validatedData.startDate),
      endDate: validatedData.endDate ? new Date(validatedData.endDate) : undefined,
      location: validatedData.location,
      isVirtual: validatedData.isVirtual,
      maxParticipants: validatedData.maxParticipants,
      currentParticipants: 0,
      registrationOpen: normalizedStatus === 'published',
      registrationDeadline: validatedData.registrationDeadline ? new Date(validatedData.registrationDeadline) : undefined,
      status: normalizedStatus as any,
      organizer: validatedData.organizer ? {
        userId: validatedData.organizer.userId,
        name: validatedData.organizer.name,
      } : {
        userId: adminUser.userId,
        name: "Innovation Portal Admin",
      },
      participants: [],
      requirements: validatedData.requirements,
      prizes: validatedData.prizes,
    });
    // Do not send notifications on creation when created by admins.
    // Notifications will be sent upon SuperAdmin approval (see handleApproveEvent).

    res.status(201).json({ message: "Event created successfully", event });
  } catch (error) {
    console.error("Create event error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input data", details: error.errors });
    }
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleGetEvents: RequestHandler = async (req, res) => {
  try {
    const { status, type, upcoming, limit } = req.query;
    
    const events = await db.getEvents({
      status: status as string,
      type: type as string,
      upcoming: upcoming === "true",
      limit: limit ? parseInt(limit as string) : 20,
    });

    res.json({ events });
  } catch (error) {
    console.error("Get events error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handlePublishEvent: RequestHandler = async (req, res) => {
  try {
    const currentUser = (req as any).user;
    const role = (currentUser?.role || '').toString().toLowerCase();
    if (role !== 'superadmin') {
      return res.status(403).json({ error: 'SuperAdmin access required' });
    }
    const { eventId } = req.params;

    const result = await db.events.updateOne(
      { _id: eventId },
      { 
        $set: { 
          status: "published",
          updatedAt: new Date()
        } 
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Send notifications to all users about newly published event
    try {
      const evt = await db.events.findOne({ _id: eventId as any });
      const title = evt?.title || 'An event';
      const type = evt?.type || 'event';
      const usersCursor = db.users.find({ role: { $regex: /^user$/i } }, { projection: { _id: 1 } });
      const users = await usersCursor.toArray();
      if (users && users.length) {
        const docs = users.map((u: any) => ({
          userId: (u._id || "").toString(),
          type: "event_reminder",
          title: "New event posted",
          message: `${title} — ${type} just went live. Tap to view and register!`,
          read: false,
          data: { eventId, eventType: type, startDate: evt?.startDate, registrationDeadline: evt?.registrationDeadline },
          createdAt: new Date(),
        }));
        if (docs.length) {
          await db.notifications.insertMany(docs as any[]);
        }
      }
      // Also notify all admins so bell updates for admin testers
      try {
        const adminsCursor = db.users.find({ role: { $regex: /admin$/i } }, { projection: { _id: 1 } });
        const admins = await adminsCursor.toArray();
        if (admins && admins.length) {
          const adminDocs = admins.map((a: any) => ({
            userId: (a._id || '').toString(),
            type: 'system_announcement',
            title: 'Event Published',
            message: `${title} has been published.`,
            read: false,
            data: { eventId },
            createdAt: new Date(),
          }));
          if (adminDocs.length) await db.notifications.insertMany(adminDocs as any[]);
        }
      } catch (e) {
        console.warn('Publish event: failed to notify admins (non-fatal):', e);
      }
    } catch (notifyErr) {
      console.warn('Publish event: failed to broadcast notifications (non-fatal):', notifyErr);
    }

    res.json({ message: "Event published successfully" });
  } catch (error) {
    console.error("Publish event error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleGetAllUsers: RequestHandler = async (req, res) => {
  try {
    const { verified, limit, skip } = req.query;
    
    const query: any = {};
    if (verified !== undefined) {
      query.verified = verified === "true";
    }

    // Fetch both regular users and admins, omit passwords
    const lim = limit ? parseInt(limit as string) : 50;
    const skp = skip ? parseInt(skip as string) : 0;

    const [regularUsers, adminUsers] = await Promise.all([
      db.users
        .find(query, { projection: { password: 0 } })
        .sort({ createdAt: -1 })
        .limit(lim)
        .skip(skp)
        .toArray(),
      db.admins
        .find({}, { projection: { password: 0 } })
        .sort({ createdAt: -1 })
        .limit(lim)
        .skip(skp)
        .toArray(),
    ]);

    // Normalize and combine
    const combined = [...regularUsers, ...adminUsers]
      .map((u: any) => ({
        ...u,
        role: (u?.role || 'user'),
      }))
      .sort((a: any, b: any) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime());

    res.json({ users: combined });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleToggleProjectFeatured: RequestHandler = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await db.projects.findOne({ _id: projectId });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    await db.projects.updateOne(
      { _id: projectId },
      { 
        $set: { 
          featured: !project.featured,
          updatedAt: new Date()
        } 
      }
    );

    res.json({ 
      message: `Project ${project.featured ? 'unfeatured' : 'featured'} successfully` 
    });
  } catch (error) {
    console.error("Toggle project featured error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleGetNotifications: RequestHandler = async (req, res) => {
  try {
    console.log('🔔 Admin requesting notifications');
    const adminId = (req as any).user?.userId;
    if (!adminId) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Pull from notifications collection for this admin, exclude collaboration events
    // Prevent stale 304s from caches/proxies
    res.set('Cache-Control', 'no-store');
    const items = await db.notifications
      .find({
        userId: adminId,
        type: { $nin: ['collaboration'] },
      } as any)
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    const notifications = (items || []).map((n: any) => ({
      id: n._id?.toString?.() || n._id,
      type: n.type,
      title: n.title,
      message: n.message,
      username: n.username,
      createdAt: n.createdAt,
      read: !!n.read,
    }));

    console.log(`✅ Found ${notifications.length} notifications for admin ${adminId}`);
    res.json({ notifications });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

export const handleCreateAdmin: RequestHandler = async (req, res) => {
  try {
    const currentUser = (req as any).user;
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { firstName, lastName, email, password, role = 'admin' } = req.body;

    // Validate input
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if user already exists
    const existingUser = await db.users.findOne({ email });
    const existingAdmin = await db.admins.findOne({ email });
    if (existingUser || existingAdmin) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create admin user
    const newAdmin = {
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role,
      verified: true,
      profileComplete: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Store admins in the admins collection
    const result = await db.admins.insertOne(newAdmin);

    if (result.acknowledged) {
      // Remove hashed password from response but include original password for display
      const { password: _hashed, ...adminResponse } = newAdmin;
      res.status(201).json({
        message: 'Admin created successfully',
        admin: { ...adminResponse, _id: result.insertedId },
        plainPassword: password
      });
    } else {
      res.status(500).json({ error: 'Failed to create admin' });
    }
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Example: server/routes/admin.ts

import { Router } from 'express';

const router = Router();

// List applications by status (pending, approved, rejected)
router.get('/applications', requireAdmin, handleGetPendingApplications);

// Approve application
router.post('/applications/:applicationId/approve', requireAdmin, handleApproveApplication);

// Reject application
router.post('/applications/:applicationId/reject', requireAdmin, handleRejectApplication);

export default router;
