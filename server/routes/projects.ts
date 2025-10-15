import { RequestHandler, Router } from "express";
import path from "path";
import fs from "fs";
import { upload } from "../middleware/upload";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { db } from "../services/database";
import { authenticateToken } from "../middleware/auth";

const ALLOWED_SECTORS = ["Education", "Technology", "Agriculture", "Health"] as const;

const createProjectSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(10),
  sector: z.enum(ALLOWED_SECTORS),
  duration: z.string().min(1),
  tags: z.array(z.string()),
  githubUrl: z.string().url().optional(),
  demoUrl: z.string().url().optional(),
  teamMembers: z.array(z.object({
    name: z.string(),
    role: z.string(),
  })).optional(),
});

export const handleGetProjects: RequestHandler = async (req, res) => {
  try {
    const { sector, status, featured, limit, skip, search } = req.query;
    
    const filters: any = {
      sector: sector as string,
      status: (status as string) || "published",
      featured: featured === "true",
      limit: limit ? parseInt(limit as string) : 50,
      skip: skip ? parseInt(skip as string) : 0,
    };
    if (search) {
      filters.search = search as string;
    }

    const projects = await db.getProjects(filters);

    // For each project, set githubUrl to the author's current profile GitHub URL (or username-derived URL)
    const enriched = await Promise.all(projects.map(async (p: any) => {
      const authorId = p?.author?.userId;
      if (!authorId) return p;
      try {
        const author = await db.findUserById(String(authorId));
        const profileUrl: string | undefined = (author as any)?.githubUrl || (author as any)?.profile?.githubUrl;
        if (profileUrl && /^https?:\/\//i.test(profileUrl)) {
          return { ...p, githubUrl: profileUrl };
        }
        const username = (author as any)?.githubUsername
          || (author as any)?.profile?.githubUsername
          || (author as any)?.githubStats?.username
          || (() => {
          if (!profileUrl) return undefined;
          try {
            const u = new URL(profileUrl);
            const parts = u.pathname.split('/').filter(Boolean);
            return parts[0];
          } catch { return undefined; }
        })();
        if (username) return { ...p, githubUrl: `https://github.com/${username}` };
        return { ...p, githubUrl: undefined };
      } catch {
        return { ...p, githubUrl: p?.githubUrl };
      }
    }));

    // Return the projects array directly for frontend compatibility
    res.json(enriched);
  } catch (error) {
    console.error("Get projects error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get current user's collaboration request status for a project
export const handleGetCollaborationStatus: RequestHandler = async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { id: projectId } = req.params as any;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!projectId) return res.status(400).json({ error: 'Project id is required' });

    // Prefer structured request record
    const existing = await db.requests.findOne({
      type: 'collaboration',
      projectId: String(projectId),
      $or: [
        { requesterId: String(userId) },
        { userId: String(userId) }, // some records use userId as requester
      ],
    } as any);

    if (existing) {
      const proj = await db.projects.findOne({ _id: new ObjectId(projectId) } as any, { projection: { title: 1 } } as any);
      return res.json({ exists: true, status: existing.status || 'pending', projectTitle: (proj as any)?.title || undefined });
    }

    // Backward compat: check legacy comments for collab marker
    const legacy = await db.projects.findOne(
      {
        _id: new ObjectId(projectId) as any,
        comments: { $elemMatch: { userId: String(userId), content: { $regex: /^\[COLLAB REQUEST/i } } },
      } as any,
      { projection: { _id: 1 } } as any,
    );
    if (legacy) {
      const proj = await db.projects.findOne({ _id: new ObjectId(projectId) } as any, { projection: { title: 1 } } as any);
      return res.json({ exists: true, status: 'pending', projectTitle: (proj as any)?.title || undefined });
    }

    return res.json({ exists: false });
  } catch (error) {
    console.error('Get collab status error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
export const handleCreateProject: RequestHandler = async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if user is verified
    const user = await db.findUserById(userId);
    if (!user || !user.verified) {
      return res.status(403).json({ error: "Only verified innovators can create projects" });
    }

    // Accept multipart/form-data for images
    let images: string[] = [];
    const reqAny = req as any;
    if (reqAny.files && Array.isArray(reqAny.files)) {
      if (reqAny.files.length > 4) {
        return res.status(400).json({ error: "You can upload up to 4 images only" });
      }
      images = reqAny.files.map((file: any) => `/uploads/${file.filename}`);
    }

    // Parse text fields from form-data
    const {
      title,
      description,
      sector,
      duration,
      tags,
      githubUrl,
      demoUrl,
      teamMembers
    } = req.body;

    // Parse tags/teamMembers from JSON if sent as string
    const parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
    const parsedTeamMembers = typeof teamMembers === 'string' ? JSON.parse(teamMembers) : teamMembers;

    // Validate
    const validatedData = createProjectSchema.parse({
      title,
      description,
      sector,
      duration,
      tags: parsedTags,
      githubUrl,
      demoUrl,
      teamMembers: parsedTeamMembers
    });

    const project = await db.createProject({
      title: validatedData.title,
      description: validatedData.description,
      sector: validatedData.sector,
      author: {
        userId: userId,
        name: `${user.firstName} ${user.lastName}`,
        verified: user.verified,
        avatar: user.avatar || null,
      },
      team: validatedData.teamMembers ? {
        size: validatedData.teamMembers.length + 1,
        members: [
          { name: `${user.firstName} ${user.lastName}`, role: "Lead" },
          ...validatedData.teamMembers.map((member: any) => ({
            name: member.name || "Team Member",
            role: member.role || "Developer"
          })),
        ],
      } : undefined,
      duration: validatedData.duration,
      status: "published",
      tags: validatedData.tags,
      githubUrl: validatedData.githubUrl,
      demoUrl: validatedData.demoUrl,
      images,
      likes: [],
      comments: [],
      follows: [],
      featured: false,
    });

    res.status(201).json({ message: "Project created successfully", project });
  } catch (error) {
    console.error("Create project error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input data", details: error.errors });
    }
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleLikeProject: RequestHandler = async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { id: projectId } = req.params;
    

    
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const project = await db.projects.findOne({ _id: new ObjectId(projectId) } as any);
    console.log('📄 Found project:', project ? 'Yes' : 'No');
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const hasLiked = project.likes.includes(userId);

    
    if (hasLiked) {
      // Unlike
      await db.projects.updateOne(
        { _id: new ObjectId(projectId) } as any,
        { $pull: { likes: userId }, $set: { updatedAt: new Date() } }
      );
    } else {
      // Like
      await db.projects.updateOne(
        { _id: new ObjectId(projectId) } as any,
        { $push: { likes: userId }, $set: { updatedAt: new Date() } }
      );
    }


    res.json({ message: hasLiked ? "Project unliked" : "Project liked" });
  } catch (error) {
    console.error("Like project error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleFollowProject: RequestHandler = async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { id: projectId } = req.params;
    
    console.log('🔍 Follow project request:', { userId, projectId });
    
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const project = await db.projects.findOne({ _id: new ObjectId(projectId) } as any);
    console.log('📄 Found project:', project ? 'Yes' : 'No');
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const authorId = project.author.userId;
    console.log('👤 Author ID:', authorId);
    
    // Check if user is already following this author
    const follower = await db.users.findOne({ _id: new ObjectId(userId) } as any);
    if (!follower) {
      return res.status(404).json({ error: "User not found" });
    }
    
    console.log('👤 Found follower user:', follower._id);
    
    // Initialize following/followers arrays if they don't exist
    if (!follower.following || !follower.followers) {
      console.log('🔄 Initializing following/followers arrays for user');
      await db.users.updateOne(
        { _id: userId } as any,
        { 
          $set: { 
            following: [],
            followers: []
          } 
        }
      );
      // Update the follower object with the new arrays
      follower.following = [];
      follower.followers = [];
    }
    
    const isFollowing = follower.following?.includes(authorId) || false;
    console.log('👥 User is following author:', isFollowing);
    
    // Ensure author also has following/followers fields
    const author = await db.users.findOne({ _id: new ObjectId(authorId) } as any);
    if (author && (!author.following || !author.followers)) {
      console.log('🔄 Initializing following/followers arrays for author');
      await db.users.updateOne(
        { _id: new ObjectId(authorId) } as any,
        { 
          $set: { 
            following: author.following || [],
            followers: author.followers || []
          } 
        }
      );
    }
    
    if (isFollowing) {
      // Unfollow author
      console.log('🔄 Unfollowing author...');
      const unfollowResult = await db.users.updateOne(
        { _id: new ObjectId(userId) } as any,
        { $pull: { following: authorId } }
      );
      console.log('🔄 Unfollow result:', unfollowResult.modifiedCount);
      
      // Update author's followers count
      const removeFollowerResult = await db.users.updateOne(
        { _id: new ObjectId(authorId) } as any,
        { $pull: { followers: userId } }
      );
      console.log('🔄 Remove follower result:', removeFollowerResult.modifiedCount);
    } else {
      // Follow author
      console.log('🔄 Following author...');
      const followResult = await db.users.updateOne(
        { _id: new ObjectId(userId) } as any,
        { $addToSet: { following: authorId } }
      );
      console.log('🔄 Follow result:', followResult.modifiedCount);
      
      // Update author's followers count
      const addFollowerResult = await db.users.updateOne(
        { _id: new ObjectId(authorId) } as any,
        { $addToSet: { followers: userId } }
      );
      console.log('🔄 Add follower result:', addFollowerResult.modifiedCount);
      try {
        // Notify author about new follower
        await db.notifications.insertOne({
          userId: authorId,
          type: 'follow',
          title: 'New follower',
          message: `${follower.firstName || ''} ${follower.lastName || ''}`.trim() + ' started following you.',
          meta: { fromUserId: userId, projectId },
          read: false,
          createdAt: new Date(),
        } as any);
      } catch (e) {
        console.warn('Follow notification failed (non-fatal):', e);
      }
    }

    console.log('✅ Follow operation completed');
    
    // Return updated user data so frontend can update UI immediately
    const updatedUser = await db.users.findOne({ _id: new ObjectId(userId) } as any);
    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Ensure following and followers arrays exist
    const userWithFollowData = {
      ...updatedUser,
      following: updatedUser.following || [],
      followers: updatedUser.followers || []
    };
    
    const { password, ...userWithoutPassword } = userWithFollowData;
    
    console.log('👤 Returning user with following:', userWithoutPassword.following);
    
    res.json({ 
      message: isFollowing ? "Project unfollowed" : "Project followed",
      user: userWithoutPassword,
      isFollowing: !isFollowing
    });
  } catch (error) {
    console.error("Follow project error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const handleAddComment: RequestHandler = async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { id: projectId } = req.params;
    const { content } = req.body;
    
    if (!userId || !content) {
      return res.status(400).json({ error: "User ID and content are required" });
    }

    const user = await db.findUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Detect collaboration request before writing comment so we can enforce one-per-project per user
    const isCollab = typeof content === 'string' && content.trim().toUpperCase().startsWith('[COLLAB REQUEST');
    if (isCollab) {
      // Prevent duplicate collaboration request for the same project from the same requester
      const existing = await db.requests.findOne({
        type: 'collaboration',
        projectId: String(projectId),
        requesterId: String(userId),
      } as any);
      if (existing) {
        // Provide status and title for better client UX
        const proj = await db.projects.findOne({ _id: new ObjectId(projectId) } as any, { projection: { title: 1 } } as any);
        return res.status(409).json({ error: 'You have already requested to collaborate on this project.', status: existing.status || 'pending', projectTitle: proj?.title || undefined });
      }
      // Backward compatibility: check legacy comments for prior collab request from same user
      const legacy = await db.projects.findOne(
        {
          _id: new ObjectId(projectId) as any,
          comments: { $elemMatch: { userId: String(userId), content: { $regex: /^\[COLLAB REQUEST/i } } },
        } as any,
        { projection: { _id: 1 } } as any,
      );
      if (legacy) {
        const proj = await db.projects.findOne({ _id: new ObjectId(projectId) } as any, { projection: { title: 1 } } as any);
        return res.status(409).json({ error: 'You have already requested to collaborate on this project.', status: 'pending', projectTitle: proj?.title || undefined });
      }
    }

    const commentId = new ObjectId().toString();
    const comment = {
      userId,
      userName: `${user.firstName} ${user.lastName}`,
      content,
      createdAt: new Date(),
      commentId,
    };

    await db.projects.updateOne(
      { _id: new ObjectId(projectId) } as any,
      { 
        $push: { comments: comment },
        $set: { updatedAt: new Date() }
      } as any
    );

    // If this is a collaboration request, notify the project owner
    try {
      const project = await db.projects.findOne({ _id: new ObjectId(projectId) } as any);
      const ownerIdRaw = project?.author?.userId;
      const ownerId = ownerIdRaw ? String(ownerIdRaw) : undefined;
      if (ownerId && isCollab && ownerId !== userId) {
        await db.notifications.insertOne({
          userId: ownerId,
          type: 'collab-request',
          title: 'New collaboration request',
          message: `${user.firstName} ${user.lastName} requested to collaborate on '${project?.title || 'your project'}'.`,
          meta: { projectId: String(projectId), commentId, fromUserId: userId },
          read: false,
          createdAt: new Date(),
        } as any);
        // Also persist a structured collaboration request in the requests collection for reliable fetching
        await db.requests.insertOne({
          type: 'collaboration',
          status: 'pending',
          ownerId: ownerId,
          userId: userId, // requester
          projectId: String(projectId),
          commentId: commentId,
          message: content,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any);
      }
    } catch (e) {
      console.warn('Collab notification failed (non-fatal):', e);
    }

    res.status(201).json({ message: "Comment added successfully", comment });
  } catch (error) {
    console.error("Add comment error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Accept a collaboration request (project owner only)
export const handleAcceptCollaboration: RequestHandler = async (req, res) => {
  try {
    const ownerId = (req as any).user?.userId;
    const { id: projectId, commentId } = req.params as any;

    if (!ownerId) return res.status(401).json({ error: 'Unauthorized' });

    const project = await db.projects.findOne({ _id: new ObjectId(projectId) } as any);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.author?.userId !== ownerId) return res.status(403).json({ error: 'Forbidden' });

    const comment = (project.comments || []).find((c: any) => c.commentId === commentId);
    if (!comment) return res.status(404).json({ error: 'Collaboration request not found' });

    const requesterId = comment.userId;

    // Guard: ensure request is pending
    const reqDoc = await db.requests.findOne({ type: 'collaboration', ownerId, projectId: String(projectId), commentId } as any);
    if (reqDoc && reqDoc.status && reqDoc.status !== 'pending') {
      return res.status(409).json({ error: 'Request already processed', status: reqDoc.status });
    }

    // Add collaborator
    await db.projects.updateOne(
      { _id: new ObjectId(projectId) } as any,
      { $addToSet: { collaboratorIds: requesterId }, $set: { updatedAt: new Date() } } as any
    );

    // Recalculate collaboratorCount lazily
    const updated = (await db.projects.findOne({ _id: new ObjectId(projectId) } as any)) as any;
    const collabIds = Array.isArray(updated?.collaboratorIds) ? (updated.collaboratorIds as any[]) : [];
    const count = collabIds.length;
    await db.projects.updateOne(
      { _id: new ObjectId(projectId) } as any,
      { $set: { collaboratorCount: count, updatedAt: new Date() } } as any
    );

    // Notify requester
    await db.notifications.insertOne({
      userId: requesterId,
      type: 'collab-response',
      title: 'Collaboration request accepted',
      message: `Your collaboration request for '${project.title}' was accepted by the owner. We will contact you soon through your email address.`,
      meta: { projectId, commentId },
      read: false,
      createdAt: new Date(),
    } as any);

    // Mark structured collaboration request as accepted
    await db.requests.updateOne(
      { type: 'collaboration', ownerId, projectId, commentId } as any,
      { $set: { status: 'accepted', updatedAt: new Date() } } as any
    );

    res.json({ message: 'Collaboration accepted', collaboratorCount: count, status: 'accepted' });
  } catch (error) {
    console.error('Accept collaboration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Reject a collaboration request (project owner only)
export const handleRejectCollaboration: RequestHandler = async (req, res) => {
  try {
    const ownerId = (req as any).user?.userId;
    const { id: projectId, commentId } = req.params as any;

    if (!ownerId) return res.status(401).json({ error: 'Unauthorized' });

    const project = await db.projects.findOne({ _id: new ObjectId(projectId) } as any);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.author?.userId !== ownerId) return res.status(403).json({ error: 'Forbidden' });

    const comment = (project.comments || []).find((c: any) => c.commentId === commentId);
    if (!comment) return res.status(404).json({ error: 'Collaboration request not found' });

    const requesterId = comment.userId;

    await db.notifications.insertOne({
      userId: requesterId,
      type: 'collab-response',
      title: 'Collaboration request rejected',
      message: `Your collaboration request was rejected for '${project.title}'.`,
      meta: { projectId, commentId },
      read: false,
      createdAt: new Date(),
    } as any);

    // Mark structured collaboration request as rejected
    await db.requests.updateOne(
      { type: 'collaboration', ownerId, projectId, commentId } as any,
      { $set: { status: 'rejected', updatedAt: new Date() } } as any
    );

    res.json({ message: 'Collaboration rejected', status: 'rejected' });
  } catch (error) {
    console.error('Reject collaboration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// List collaboration requests for current user (owns projects)
export const handleGetCollaborationRequests: RequestHandler = async (req, res) => {
  try {
    const ownerId = (req as any).user?.userId;
    if (!ownerId) return res.status(401).json({ error: 'Unauthorized' });

    // Fetch collaboration requests from the primary requests collection
    let items = await db.requests
      .find({ type: 'collaboration', ownerId })
      .sort({ createdAt: -1 })
      .toArray();

    const results: any[] = [];
    if (items.length > 0) {
      for (const r of items as any[]) {
        const requester = r.userId ? await db.findUserById(r.userId) : null;
        const proj = r.projectId ? await db.projects.findOne({ _id: new ObjectId(r.projectId) } as any) : null;
        const strip = (txt?: string) => {
          if (!txt || typeof txt !== 'string') return txt;
          const m = txt.match(/^\[COLLAB REQUEST[^\]]*\]\s*(.*)$/i);
          return m ? m[1] : txt;
        };
        const created = r.createdAt ? new Date(r.createdAt) : new Date();
        const mins = Math.floor((Date.now() - created.getTime())/60000);
        const timeAgo = mins < 60 ? `${mins} minute${mins===1?'':'s'} ago` : `${Math.floor(mins/60)} hour${Math.floor(mins/60)===1?'':'s'} ago`;

        // Compute requester stats
        let requesterStats: any = null;
        if (requester) {
          const requesterId = String((requester as any)._id);
          const projectsCount = await db.projects.countDocuments({ 'author.userId': requesterId } as any);
          const followersCount = Array.isArray((requester as any).followers) ? (requester as any).followers.length : 0;
          const collabHistoryCount = await db.requests.countDocuments({ type: 'collaboration', userId: requesterId } as any);
          const githubUsername = (requester as any).githubStats?.username || (() => {
            const url: string | undefined = (requester as any).profile?.githubUrl;
            if (!url) return undefined;
            try {
              const u = new URL(url);
              const parts = u.pathname.split('/').filter(Boolean);
              return parts[0];
            } catch { return undefined; }
          })();
          requesterStats = { projectsCount, followersCount, collabHistoryCount, githubUsername };
        }
        results.push({
          projectId: r.projectId,
          projectTitle: (proj as any)?.title || 'Project',
          commentId: r.commentId,
          message: strip(r.message),
          createdAt: r.createdAt,
          status: r.status || 'pending',
          timeAgo,
          requester: requester ? {
            _id: String((requester as any)._id),
            firstName: (requester as any).firstName,
            lastName: (requester as any).lastName,
            email: (requester as any).email,
            avatar: (requester as any).avatar,
          } : null,
          requesterStats,
        });
      }
      return res.json({ requests: results });
    }

    // Fallback: scan owned projects' comments and seed missing requests
    const ownerObjId = ObjectId.isValid(ownerId) ? new ObjectId(ownerId) : null;
    const owned = await db.projects.find({
      $or: [
        { 'author.userId': ownerId } as any,
        ...(ownerObjId ? [{ 'author.userId': ownerObjId } as any] : []),
      ],
    } as any).toArray();
    const isCollabMarker = (text: string) => typeof text === 'string' && text.trim().toUpperCase().startsWith('[COLLAB REQUEST');

    for (const p of owned) {
      const comments = Array.isArray((p as any).comments) ? (p as any).comments : [];
      for (const c of comments) {
        if (isCollabMarker(c?.content)) {
          const requesterId = c.userId ? String(c.userId) : undefined;
          const requestDoc = {
            type: 'collaboration',
            status: 'pending',
            ownerId: String(ownerId),
            userId: requesterId,
            projectId: String((p as any)._id),
            commentId: c.commentId,
            message: c.content,
            createdAt: c.createdAt || new Date(),
            updatedAt: new Date(),
          } as any;
          // Upsert to seed
          await db.requests.updateOne(
            { type: 'collaboration', ownerId: requestDoc.ownerId, projectId: requestDoc.projectId, commentId: requestDoc.commentId } as any,
            { $setOnInsert: requestDoc },
            { upsert: true } as any
          );

          const requester = requesterId ? await db.findUserById(requesterId) : null;
          const strip = (txt?: string) => {
            if (!txt || typeof txt !== 'string') return txt;
            const m = txt.match(/^\[COLLAB REQUEST[^\]]*\]\s*(.*)$/i);
            return m ? m[1] : txt;
          };
          const created = requestDoc.createdAt ? new Date(requestDoc.createdAt) : new Date();
          const mins = Math.floor((Date.now() - created.getTime())/60000);
          const timeAgo = mins < 60 ? `${mins} minute${mins===1?'':'s'} ago` : `${Math.floor(mins/60)} hour${Math.floor(mins/60)===1?'':'s'} ago`;
          // Compute requester stats for fallback path
          let requesterStats: any = null;
          if (requester) {
            const rid = String((requester as any)._id);
            const projectsCount = await db.projects.countDocuments({ 'author.userId': rid } as any);
            const followersCount = Array.isArray((requester as any).followers) ? (requester as any).followers.length : 0;
            const collabHistoryCount = await db.requests.countDocuments({ type: 'collaboration', userId: rid } as any);
            const githubUsername = (requester as any).githubStats?.username || (() => {
              const url: string | undefined = (requester as any).profile?.githubUrl;
              if (!url) return undefined;
              try {
                const u = new URL(url);
                const parts = u.pathname.split('/').filter(Boolean);
                return parts[0];
              } catch { return undefined; }
            })();
            requesterStats = { projectsCount, followersCount, collabHistoryCount, githubUsername };
          }
          results.push({
            projectId: requestDoc.projectId,
            projectTitle: (p as any).title,
            commentId: requestDoc.commentId,
            message: strip(requestDoc.message),
            createdAt: requestDoc.createdAt,
            status: requestDoc.status || 'pending',
            timeAgo,
            requester: requester ? {
              _id: String((requester as any)._id),
              firstName: (requester as any).firstName,
              lastName: (requester as any).lastName,
              email: (requester as any).email,
              avatar: (requester as any).avatar,
            } : null,
            requesterStats,
          });
        }
      }
    }

    res.json({ requests: results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) });
  } catch (error) {
    console.error('Get collaboration requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update a project (only by owner)
export const handleUpdateProject: RequestHandler = async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { id: projectId } = req.params;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const project = await db.projects.findOne({ _id: new ObjectId(projectId) } as any);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (project.author?.userId !== userId) return res.status(403).json({ error: "Forbidden" });

    // Allow partial updates on selected fields
    const {
      title,
      description,
      sector,
      duration,
      tags,
      githubUrl,
      demoUrl,
    } = req.body || {};

    const $set: any = { updatedAt: new Date() };
    if (typeof title === 'string' && title.trim()) $set.title = title.trim();
    if (typeof description === 'string' && description.trim()) $set.description = description.trim();
    if (typeof sector === 'string' && sector.trim()) {
      const trimmed = sector.trim();
      if (!ALLOWED_SECTORS.includes(trimmed as any)) {
        return res.status(400).json({ error: "Invalid sector. Allowed: Education, Technology, Agriculture, Health" });
      }
      $set.sector = trimmed;
    }
    if (typeof duration === 'string' && duration.trim()) $set.duration = duration.trim();
    if (Array.isArray(tags)) $set.tags = tags;
    if (typeof githubUrl === 'string') $set.githubUrl = githubUrl || null;
    if (typeof demoUrl === 'string') $set.demoUrl = demoUrl || null;

    await db.projects.updateOne(
      { _id: new ObjectId(projectId) } as any,
      { $set }
    );

    const updated = await db.projects.findOne({ _id: new ObjectId(projectId) } as any);
    res.json({ message: "Project updated", project: updated });
  } catch (error) {
    console.error("Update project error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete a project (only by owner)
export const handleDeleteProject: RequestHandler = async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { id: projectId } = req.params;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const project = await db.projects.findOne({ _id: new ObjectId(projectId) } as any);
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (project.author?.userId !== userId) return res.status(403).json({ error: "Forbidden" });

    await db.projects.deleteOne({ _id: new ObjectId(projectId) } as any);
    res.json({ message: "Project deleted" });
  } catch (error) {
    console.error("Delete project error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Create router
const router = Router();

// Public routes
router.get("/", handleGetProjects);

// Protected routes (require authentication)
router.post("/", authenticateToken, upload.array("images", 4), handleCreateProject);
router.post("/:id/like", authenticateToken, handleLikeProject);
router.post("/:id/follow", authenticateToken, handleFollowProject);
router.post("/:id/comments", authenticateToken, handleAddComment);
router.post("/:id/collaboration/:commentId/accept", authenticateToken, handleAcceptCollaboration);
router.post("/:id/collaboration/:commentId/reject", authenticateToken, handleRejectCollaboration);
router.get("/:id/collaboration/status", authenticateToken, handleGetCollaborationStatus);
router.get("/collaboration/requests", authenticateToken, handleGetCollaborationRequests);
router.put("/:id", authenticateToken, handleUpdateProject);
router.delete("/:id", authenticateToken, handleDeleteProject);

export default router;
