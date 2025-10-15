import { MongoClient, Db, Collection, ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import type { User, Project, Event, Notification } from "../models/User";

class DatabaseService {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  async connect(
    connectionString: string = process.env.MONGO_URI ||
      process.env.MONGODB_URI ||
      "mongodb://localhost:27017/YOUTH-INNOVATION-PORTAL",
  ) {
    // Prevent multiple connections
    if (this.client && this.db) {
      console.log("📊 Database already connected");
      return;
    }

    try {
      this.client = new MongoClient(connectionString);
      await this.client.connect();
      this.db = this.client.db("YOUTH-INNOVATION-PORTAL");
      console.log("📊 Connected to MongoDB");

      // Create indexes only - no automatic admin seeding
      await this.createIndexes();
    } catch (error) {
      console.error("❌ MongoDB connection error:", error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      console.log("🔌 Disconnected from MongoDB");
    }
  }

  private async createIndexes() {
    if (!this.db) return;

    // User indexes
    await this.db
      .collection("users")
      .createIndex({ email: 1 }, { unique: true });
    await this.db.collection("users").createIndex({ verified: 1 });
    await this.db
      .collection("users")
      .createIndex({ "verificationApplication.status": 1 });

    // Admin indexes
    await this.db
      .collection("admins")
      .createIndex({ email: 1 }, { unique: true });

    // Project indexes
    await this.db.collection("projects").createIndex({ "author.userId": 1 });
    await this.db.collection("projects").createIndex({ sector: 1 });
    await this.db.collection("projects").createIndex({ status: 1 });
    await this.db.collection("projects").createIndex({ featured: 1 });
    await this.db.collection("projects").createIndex({ createdAt: -1 });

    // Event indexes
    await this.db.collection("events").createIndex({ status: 1 });
    await this.db.collection("events").createIndex({ startDate: 1 });
    await this.db.collection("events").createIndex({ type: 1 });

    // Notification indexes
    await this.db
      .collection("notifications")
      .createIndex({ userId: 1, read: 1 });
    await this.db.collection("notifications").createIndex({ createdAt: -1 });
  }

  // Collection getters
  get users(): Collection<User> {
    if (!this.db) throw new Error("Database not connected");
    return this.db.collection<User>("users");
  }

  get projects(): Collection<Project> {
    if (!this.db) throw new Error("Database not connected");
    return this.db.collection<Project>("projects");
  }

  get events(): Collection<Event> {
    if (!this.db) throw new Error("Database not connected");
    return this.db.collection<Event>("events");
  }

  get notifications(): Collection<Notification> {
    if (!this.db) throw new Error("Database not connected");
    return this.db.collection<Notification>("notifications");
  }

  get admins(): Collection<User> {
    if (!this.db) throw new Error("Database not connected");
    return this.db.collection<User>("admins");
  }

  get verificationApplications(): Collection<any> {
    if (!this.db) throw new Error("Database not connected");
    return this.db.collection("verificationApplications");
  }

  // Requests (funding and certificate)
  get requests(): Collection<any> {
    if (!this.db) throw new Error("Database not connected");
    return this.db.collection("requests");
  }

  // New singular collection per user request: 'request'
  get request(): Collection<any> {
    if (!this.db) throw new Error("Database not connected");
    return this.db.collection("request");
  }

  // Delete a user and cascade cleanup across related collections
  async deleteUserCascade(userId: string): Promise<boolean> {
    try {
      if (!userId || typeof userId !== 'string') {
        console.error('❌ deleteUserCascade: invalid userId');
        return false;
      }

      // Validate ObjectId for users collection
      let objectId: ObjectId | null = null;
      try {
        objectId = new ObjectId(userId);
      } catch {
        // If not a valid ObjectId, we'll still try string-based fields below
        objectId = null;
      }

      // 1) Delete the user document (only from users, not admins)
      if (objectId) {
        await this.users.deleteOne({ _id: objectId } as any);
      }

      // 2) Delete all projects authored by the user
      await this.projects.deleteMany({ 'author.userId': userId } as any);

      // 3) Remove user's likes and follows from all projects
      await this.projects.updateMany(
        {},
        {
          $pull: {
            likes: userId,
            follows: userId,
            comments: { userId },
          },
          $set: { updatedAt: new Date() },
        } as any
      );

      // 4) Remove follow relationships from other users
      if (objectId) {
        await this.users.updateMany(
          {},
          {
            $pull: {
              following: userId,
              followers: userId,
            },
          } as any
        );
      }

      // 5) Delete funding/certificate requests created by the user
      await this.requests.deleteMany({ userId } as any);

      // 6) Delete verification applications created by the user
      await this.verificationApplications.deleteMany({ userId } as any);

      // 7) Delete notifications for this user
      await this.notifications.deleteMany({ userId } as any);

      return true;
    } catch (error) {
      console.error('💥 deleteUserCascade error:', error);
      return false;
    }
  }

  // Authentication operations
  async createUser(userData: any): Promise<any> {
    const now = new Date();
    const user = {
      ...userData,
      verified: ["admin", "superadmin"].includes(userData.role) ? true : false, // Auto-verify admins/superadmins
      role: userData.role || "user",
      createdAt: now,
      updatedAt: now,
    };

    // Store users and admins in separate collections based on role
    let result;
    if (user.role === "admin") {
      result = await this.admins.insertOne(user);
    } else {
      result = await this.users.insertOne(user);
    }
    
    // Return user with proper _id as ObjectId (don't convert to string here)
    const { password, ...userWithoutPassword } = user;
    return { ...userWithoutPassword, _id: result.insertedId };
  }

  async validateUser(email: string, password: string): Promise<any> {
    try {
      // First check users collection
      let user = await this.users.findOne({ email });
      let userType = "user";
      
      // If not found in users, check admins collection
      if (!user) {
        user = await this.admins.findOne({ email });
        userType = "admin";
      }
      
      if (!user || !user.password) {
        return null;
      }
      
      // Compare password
      const isValidPassword = await bcrypt.compare(password, user.password);
      
      if (isValidPassword) {
        const { password: _, ...userWithoutPassword } = user;
        return { 
          ...userWithoutPassword, 
          _id: user._id.toString(),
          role: userType,
          verified: true // Ensure login is allowed
        };
      }
      
      return null;
    } catch (error) {
      console.error("validateUser error:", error);
      return null;
    }
  }

  async findUserByEmail(email: string): Promise<User | null> {
    // Check users collection first
    let user = await this.users.findOne({ email });
    if (user) return user;

    // Check admins collection
    user = await this.admins.findOne({ email });
    return user;
  }

  async findUserById(id: string): Promise<User | null> {
    // Validate ObjectId format
    if (!id || typeof id !== 'string' || !/^[a-fA-F0-9]{24}$/.test(id)) {
      console.error('findUserById: Invalid ObjectId format:', id);
      return null;
    }
    // Check users collection first
    let user = await this.users.findOne({ _id: new ObjectId(id) });
    if (user) return user;

    // Check admins collection
    user = await this.admins.findOne({ _id: new ObjectId(id) });
    return user;
  }

  async findUserByGoogleId(googleId: string): Promise<User | null> {
    // Check users collection first
    let user = await this.users.findOne({ googleId });
    if (user) return user;

    // Check admins collection
    user = await this.admins.findOne({ googleId });
    return user;
  }

  async findUserByResetToken(token: string): Promise<User | null> {
    // Check users collection first
    let user = await this.users.findOne({ resetPasswordToken: token });
    if (user) return user;

    // Check admins collection
    user = await this.admins.findOne({ resetPasswordToken: token });
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<boolean> {
    try {
      // Always set updatedAt on write
      const $set = { ...updates, updatedAt: new Date() } as any;

      // 1) Try to update in users collection
      const resultUsers = await this.users.updateOne(
        { _id: new ObjectId(id) } as any,
        { $set }
      );

      // 2) If not found/modified in users, try admins collection
      let modified = resultUsers.modifiedCount > 0;
      if (!modified) {
        const resultAdmins = await this.admins.updateOne(
          { _id: new ObjectId(id) } as any,
          { $set }
        );
        modified = resultAdmins.modifiedCount > 0;
      }

      // If name was updated, update all posts by this user
      if (modified && (updates.firstName || updates.lastName)) {
        const user = await this.findUserById(id);
        if (user) {
          const fullName = `${user.firstName} ${user.lastName}`.trim();
          await this.updateAuthorNameInPosts(id, fullName);
        }
      }

      // If avatar was updated, update all posts by this user
      if (modified && typeof (updates as any).avatar === 'string') {
        await this.updateAuthorAvatarInPosts(id, (updates as any).avatar);
      }
      
      return modified;
    } catch (error) {
      console.error('❌ Error updating user:', error);
      return false;
    }
  }
  
  // Update author name in all posts by a user
  private async updateAuthorNameInPosts(userId: string, newName: string): Promise<void> {
    try {
      const result = await this.projects.updateMany(
        { 'author.userId': userId },
        { $set: { 'author.name': newName } }
      );
      console.log(`✅ Updated author name in ${result.modifiedCount} posts for user ${userId}`);
    } catch (error) {
      console.error('❌ Error updating author name in posts:', error);
    }
  }

  // Update author avatar in all posts by a user
  private async updateAuthorAvatarInPosts(userId: string, newAvatar: string): Promise<void> {
    try {
      const result = await this.projects.updateMany(
        { 'author.userId': userId },
        { $set: { 'author.avatar': newAvatar } }
      );
      console.log(`✅ Updated author avatar in ${result.modifiedCount} posts for user ${userId}`);
    } catch (error) {
      console.error('❌ Error updating author avatar in posts:', error);
    }
  }

  // Project operations
  async createProject(
    projectData: Omit<Project, "_id" | "createdAt" | "updatedAt">,
  ): Promise<Project> {
    const now = new Date();
    const project: Project = {
      ...projectData,
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.projects.insertOne(project);
    return { ...project, _id: result.insertedId.toString() };
  }

  async getProjects(
    filters: {
      sector?: string;
      status?: string;
      featured?: boolean;
      search?: string;
      limit?: number;
      skip?: number;
    } = {},
  ): Promise<Project[]> {
    const query: any = {};

    if (filters.sector && filters.sector !== "All Sectors") {
      query.sector = filters.sector;
    }
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.featured !== undefined) {
      query.featured = filters.featured;
    }
    if (filters.search) {
      query.$or = [
        { title: { $regex: filters.search, $options: "i" } },
        { description: { $regex: filters.search, $options: "i" } },
        { tags: { $in: [new RegExp(filters.search, "i")] } },
      ];
    }

    return await this.projects
      .find(query)
      .sort({ createdAt: -1 })
      .limit(filters.limit || 50)
      .skip(filters.skip || 0)
      .toArray();
  }

  // =============================
  // Verification Applications API
  // =============================

  /**
   * Create a verification application in verificationApplications collection.
   * Also attaches user's GitHub stats snapshot to the saved document for admin view.
   */
  async createVerificationApplication(app: any): Promise<any | null> {
    try {
      if (!this.db) throw new Error('Database not connected');
      const userId = app.userId;
      let ghStats: any = null;
      try {
        if (typeof userId === 'string' && /^[a-fA-F0-9]{24}$/.test(userId)) {
          const u = await this.users.findOne({ _id: new ObjectId(userId) } as any);
          ghStats = u?.githubStats || null;
        }
      } catch {}
      const doc = {
        ...app,
        githubStats: ghStats || app.githubStats || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;
      const res = await this.verificationApplications.insertOne(doc);
      return { ...doc, _id: res.insertedId };
    } catch (e) {
      console.error('💥 createVerificationApplication error:', e);
      return null;
    }
  }

  /**
   * Helper aggregate to join user info for admin lists.
   */
  private verificationWithUserPipeline(match: any, limit = 50): any[] {
    return [
      { $match: match },
      { $sort: { submittedAt: -1, createdAt: -1 } },
      { $limit: Math.max(1, limit) },
      {
        $lookup: {
          from: 'users',
          let: { uid: '$userId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $and: [ { $eq: [ { $type: '$$uid' }, 'objectId' ] }, { $eq: ['$_id', '$$uid'] } ] },
                    { $and: [ { $eq: [ { $type: '$$uid' }, 'string' ] }, { $eq: [ { $toString: '$_id' }, '$$uid' ] } ] }
                  ]
                }
              }
            },
            { $project: { firstName: 1, lastName: 1, email: 1, avatar: 1, githubStats: 1, profileImage: 1, image: 1, photo: 1, picture: 1, name: 1 } }
          ],
          as: 'userInfo'
        }
      },
      { $addFields: {
          _uFirst: { $arrayElemAt: ['$userInfo.firstName', 0] },
          _uLast: { $arrayElemAt: ['$userInfo.lastName', 0] },
          _uEmail: { $arrayElemAt: ['$userInfo.email', 0] },
          _uAvatar: { $arrayElemAt: ['$userInfo.avatar', 0] },
          _uImage: { $arrayElemAt: ['$userInfo.image', 0] },
          _uProfileImage: { $arrayElemAt: ['$userInfo.profileImage', 0] },
          _uPhoto: { $arrayElemAt: ['$userInfo.photo', 0] },
          _uPicture: { $arrayElemAt: ['$userInfo.picture', 0] },
          _uName: { $arrayElemAt: ['$userInfo.name', 0] },
          _ghStats: { $arrayElemAt: ['$userInfo.githubStats', 0] }
        }
      },
      { $addFields: {
          userFirstName: {
            $ifNull: ['$_uFirst', { $let: { vars: { nm: '$_uName' }, in: { $cond: [{ $ifNull: ['$$nm', false] }, { $arrayElemAt: [{ $split: ['$$nm', ' '] }, 0] }, null] } } }]
          },
          userLastName: { $ifNull: ['$_uLast', null] },
          userEmail: '$_uEmail',
          userAvatar: { $ifNull: ['$_uAvatar', { $ifNull: ['$_uProfileImage', { $ifNull: ['$_uPhoto', { $ifNull: ['$_uImage', '$_uPicture'] }] }] }] },
          githubStats: { $ifNull: ['$githubStats', '$_ghStats'] }
        }
      },
      { $project: { userInfo: 0, _uFirst: 0, _uLast: 0, _uEmail: 0, _uAvatar: 0, _uImage: 0, _uProfileImage: 0, _uPhoto: 0, _uPicture: 0, _uName: 0, _ghStats: 0 } }
    ];
  }

  async getAllPendingApplications(limit = 50): Promise<any[]> {
    try {
      return await this.verificationApplications
        .aggregate(this.verificationWithUserPipeline({ status: 'pending' }, limit))
        .toArray();
    } catch (e) {
      console.error('💥 getAllPendingApplications error:', e);
      return [];
    }
  }

  async getVerificationApplicationsByStatus(status: string, limit = 50): Promise<any[]> {
    try {
      return await this.verificationApplications
        .aggregate(this.verificationWithUserPipeline({ status }, limit))
        .toArray();
    } catch (e) {
      console.error('💥 getVerificationApplicationsByStatus error:', e);
      return [];
    }
  }

  async approveApplication(applicationId: string, adminId?: string): Promise<boolean> {
    try {
      const _id = new ObjectId(applicationId);
      const app = await this.verificationApplications.findOne({ _id } as any);
      if (!app) return false;
      await this.verificationApplications.updateOne(
        { _id } as any,
        { $set: { status: 'approved', approvedAt: new Date(), approvedBy: adminId || null, updatedAt: new Date() } }
      );
      const userId = (app.userId?.toString?.() || app.userId) as string;
      if (userId && /^[a-fA-F0-9]{24}$/.test(userId)) {
        const updates: any = { verified: true, updatedAt: new Date() };
        const enteredUsername = (app as any).githubUsername || (app as any).githubUsernameEntered || '';
        if (enteredUsername) {
          updates.githubUrl = `https://github.com/${enteredUsername}`;
          updates.githubStats = {
            ...(app.githubStats || {}),
            username: enteredUsername
          };
        }
        await this.users.updateOne({ _id: new ObjectId(userId) } as any, { $set: updates });
      }
      return true;
    } catch (e) {
      console.error('💥 approveApplication error:', e);
      return false;
    }
  }

  async rejectApplication(applicationId: string, reason?: string): Promise<boolean> {
    try {
      const _id = new ObjectId(applicationId);
      // Load application to obtain userId
      const app = await this.verificationApplications.findOne({ _id } as any);
      if (!app) return false;
      // Mark application rejected
      const res = await this.verificationApplications.updateOne(
        { _id } as any,
        { $set: { status: 'rejected', rejectedAt: new Date(), reason: reason || null, updatedAt: new Date() } }
      );
      // If the user exists, revoke verification so they cannot post and can reapply
      const userId = (app as any).userId?.toString?.() || (app as any).userId;
      if (userId && /^[a-fA-F0-9]{24}$/.test(userId)) {
        await this.users.updateOne(
          { _id: new ObjectId(userId) } as any,
          { $set: { verified: false, suspendedAt: new Date(), suspensionReason: reason || 'Rejected by admin' } as any }
        );
      }
      return res.modifiedCount > 0;
    } catch (e) {
      console.error('💥 rejectApplication error:', e);
      return false;
    }
  }

  async createNotification(n: Partial<Notification> & { userId: string; title: string; message: string; type?: string; read?: boolean }): Promise<boolean> {
    try {
      await this.notifications.insertOne({
        userId: n.userId,
        type: (n.type as any) || 'application_update',
        title: n.title,
        message: n.message,
        read: !!n.read,
        createdAt: new Date(),
      } as any);
      return true;
    } catch (e) {
      console.error('💥 createNotification error:', e);
      return false;
    }
  }

  // Application operations
  async submitApplication(
    userId: string,
    applicationData: any
  ): Promise<boolean> {
    try {
      console.log('🔄 Submitting application for user:', userId);
      console.log('📝 Application data:', JSON.stringify(applicationData, null, 2));
      
      // Validate userId
      if (!userId) {
        console.error('❌ Missing userId');
        return false;
      }
      
      let objectId;
      try {
        objectId = new ObjectId(userId);
      } catch (err) {
        console.error('❌ Invalid ObjectId format:', userId);
        return false;
      }
      
      // Prepare the update data
      const updateData = {
        $set: {
          verificationApplication: {
            type: applicationData.type || 'individual',
            sector: applicationData.sector || '',
            projectTitle: applicationData.projectTitle || '',
            projectDescription: applicationData.projectDescription || '',
            githubUrl: applicationData.githubUrl || '',
            teamMembers: applicationData.teamMembers || [],
            duration: applicationData.duration || '',
            status: "pending",
            submittedAt: new Date(),
          },
          updatedAt: new Date(),
        },
      };
      
      console.log('🔧 Update query:', JSON.stringify({ _id: objectId }, null, 2));
      console.log('🔧 Update data:', JSON.stringify(updateData, null, 2));
      
      const result = await this.users.updateOne(
        { _id: objectId },
        updateData as any
      );
      
      console.log('✅ Update result:', {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        acknowledged: result.acknowledged
      });
      
      if (result.matchedCount === 0) {
        console.error('❌ No user found with ID:', userId);
        return false;
      }
      
      if (result.modifiedCount === 0) {
        console.error('❌ User found but document not modified. Possible duplicate application.');
        return false;
      }
      
      console.log('🎉 Application submitted successfully!');
      return true;
      
    } catch (error) {
      console.error('💥 Error in submitApplication:', error);
      return false;
    }
  }

  async getPendingApplications(limit: number = 50): Promise<User[]> {
    return await this.users
      .find({ "verificationApplication.status": "pending" })
      .sort({ "verificationApplication.submittedAt": -1 })
      .limit(limit)
      .toArray();
  }



  // Event operations
  async createEvent(
    eventData: Omit<Event, "_id" | "createdAt" | "updatedAt">,
  ): Promise<Event> {
    const now = new Date();
    const event: Event = {
      ...eventData,
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.events.insertOne(event);
    return { ...event, _id: result.insertedId.toString() };
  }

  async getEvents(
    filters: {
      status?: string;
      type?: string;
      upcoming?: boolean;
      limit?: number;
    } = {},
  ): Promise<Event[]> {
    const query: any = {};

    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.type) {
      query.type = filters.type;
    }
    if (filters.upcoming) {
      query.startDate = { $gte: new Date() };
    }

    const events = await this.events
      .find(query)
      .sort({ startDate: 1 })
      .limit(filters.limit || 20)
      .toArray();
    
    // Convert _id to id for frontend compatibility
    return events.map(event => ({
      ...event,
      id: event._id.toString()
    } as any));
  }

  async getEvent(eventId: string): Promise<Event | null> {
    const event = await this.events.findOne({ _id: new ObjectId(eventId) });
    if (!event) return null;
    
    // Convert _id to id for frontend compatibility
    return {
      ...event,
      id: event._id.toString()
    } as any;
  }

  async updateEvent(
    eventId: string,
    eventData: Partial<Event>,
  ): Promise<Event | null> {
    if (!this.db) throw new Error("Database not connected");
    
    const eventsCollection = this.db.collection<Event>("events");
    const result = await eventsCollection.updateOne(
      { _id: new ObjectId(eventId) },
      {
        $set: {
          ...eventData,
          updatedAt: new Date(),
        },
      },
    );

    if (result.modifiedCount > 0) {
      const event = await eventsCollection.findOne({ _id: new ObjectId(eventId) });
      if (!event) return null;
      
      // Convert _id to id for frontend compatibility
      return {
        ...event,
        id: event._id.toString()
      } as any;
    }
    return null;
  }

  async deleteEvent(eventId: string): Promise<boolean> {
    if (!this.db) throw new Error("Database not connected");
    
    const eventsCollection = this.db.collection<Event>("events");
    const result = await eventsCollection.deleteOne({ _id: new ObjectId(eventId) });
    return result.deletedCount > 0;
  }

  async registerForEvent(registrationData: {
    eventId: string;
    eventTitle: string;
    userId: string;
    fullName: string;
    email: string;
    phoneNumber: string;
    reason?: string;
  }): Promise<any> {
    if (!this.db) throw new Error("Database not connected");

    const registrationsCollection = this.db.collection("eventRegistrations");
    const now = new Date();
    
    const registration = {
      ...registrationData,
      status: 'pending',
      createdAt: now,
      updatedAt: now
    };

    const result = await registrationsCollection.insertOne(registration);
    return { ...registration, _id: result.insertedId };
  }

  

  async getUserNotifications(
    userId: string,
    limit: number = 20,
  ): Promise<Notification[]> {
    const filters: any[] = [{ userId }];
    try {
      // Also match ObjectId userId if some writers stored it that way
      const asObj = new ObjectId(userId);
      filters.push({ userId: asObj as any });
    } catch {}
    return await this.notifications
      .find({ $or: filters } as any)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }

  

  

  

  

  
}

export const db = new DatabaseService();
