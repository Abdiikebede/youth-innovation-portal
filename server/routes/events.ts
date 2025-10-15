import { Request, Response } from 'express';
import { upload } from '../middleware/upload.js';
import { ObjectId, WithId, Filter, ModifyResult } from 'mongodb';
import { db } from '../services/database.js';
import type { Event } from '../models/User';
import * as fs from 'fs';
import { promisify } from 'util';

const unlink = promisify(fs.unlink);
const exists = promisify(fs.exists);

// Helper to convert string ID to ObjectId
const toObjectId = (id: string | ObjectId): ObjectId => {
  return typeof id === 'string' ? new ObjectId(id) : id;
};

export const handleGetEvents = async (req: Request, res: Response) => {
  try {
    const includeAll = (req.query.all ?? req.query.includeAll ?? '') as string;
    const query = includeAll ? {} : { status: 'published' };
    const events = await db.events.find(query as any).sort({ createdAt: -1 }).toArray();
    
    // Convert _id to id for frontend compatibility and ensure proper structure
    const formattedEvents = events.map(event => ({
      ...event,
      id: event._id?.toString()
    }));
    
    res.json({ events: formattedEvents });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
};

export const handleGetEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const filter: Filter<Event> = { _id: toObjectId(id) } as any;
    const existing = await db.events.findOne(filter);
    const event = await db.events.findOne(filter);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Convert _id to id for frontend compatibility
    const formattedEvent = {
      ...event,
      id: event._id?.toString()
    };
    
    res.json({ event: formattedEvent });
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
};

// Express route handler for multipart/form-data (with images)
export const handleCreateEvent = [
  upload.array('images', 5),
  async (req: Request, res: Response) => {
    try {
      console.log('Processing event creation...');
      console.log('Files received:', (req as any).files);
      console.log('Request body:', req.body);
      
      // Process uploaded files
      let images: string[] = [];
      const files = (req as any).files || [];
      
      // Build public URLs for uploaded files saved by multer
      if (Array.isArray(files) && files.length > 0) {
        images = files.map((file: any) => `/uploads/${file.filename}`);
      }
      // Parse and validate required fields
      const {
        title, description, type, category, startDate, endDate, registrationDeadline,
        location, mode, maxParticipants, registrationLink, status = 'draft',
        organizerName = 'MinT Innovation Portal', organizerUserId = ''
      } = req.body;

      const requester = (req as any).user || {};
      const requesterRole = String(requester.role || '').toLowerCase();

      if (!title || !description || !startDate) {
        throw new Error('Title, description, and start date are required');
      }

      // Parse arrays - handle both array and string inputs
      let prizes: string[] = [];
      let requirements: string[] = [];
      
      if (Array.isArray(req.body.prizes)) {
        prizes = req.body.prizes.filter(Boolean);
      } else if (req.body.prizes) {
        prizes = [req.body.prizes].filter(Boolean);
      }
      
      if (Array.isArray(req.body.requirements)) {
        requirements = req.body.requirements.filter(Boolean);
      } else if (req.body.requirements) {
        requirements = [req.body.requirements].filter(Boolean);
      }

      // Create event document with proper typing
      // If an admin tries to publish directly, queue for superadmin approval
      const normalizedStatus = ((): any => {
        const desired = ['draft', 'published', 'cancelled'].includes(status) ? status : 'draft';
        if (requesterRole === 'admin' && desired === 'published') return 'pending_approval'
        return desired
      })();

      const eventToInsert: Omit<Event, '_id'> = {
        title: title.trim(),
        description: description.trim(),
        type: type?.trim() || 'workshop',
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : undefined,
        registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : undefined,
        location: location?.trim() || 'Online',
        isVirtual: mode !== 'in-person',
        maxParticipants: maxParticipants ? parseInt(maxParticipants, 10) : 0,
        currentParticipants: 0,
        registrationOpen: normalizedStatus === 'published',
        registrationLink: registrationLink?.trim() || '',
        status: normalizedStatus,
        prizes,
        requirements,
        images,
        organizer: {
          name: organizerName.trim(),
          userId: organizerUserId.trim()
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        participants: [],
        views: 0
      };

      // Insert event into database (no explicit transaction/session required)
      const result = await db.events.insertOne(eventToInsert);
      const event = await db.events.findOne({ _id: result.insertedId });
      
      console.log('Event created successfully:', result.insertedId);
      // If created as published (superadmin only), broadcast notifications
      try {
        if ((event as any)?.status === 'published') {
          const usersCursor = db.users.find({ role: { $regex: /^user$/i } }, { projection: { _id: 1 } } as any);
          const users = await usersCursor.toArray();
          if (users && users.length) {
            const docs = users.map((u: any) => ({
              userId: (u._id || '').toString(),
              type: 'event_reminder',
              title: 'New event posted',
              message: `${event?.title || 'An event'} — ${(event as any)?.type || 'event'} is now open. Tap to view and register!`,
              read: false,
              data: { eventId: (event as any)?._id?.toString?.(), eventType: (event as any)?.type, startDate: (event as any)?.startDate, registrationDeadline: (event as any)?.registrationDeadline },
              createdAt: new Date(),
            }));
            if (docs.length) await db.notifications.insertMany(docs as any[]);
          }
          // Notify admins as a mirror so admin bell updates during testing
          try {
            const adminsCursor = db.users.find({ role: { $regex: /admin$/i } }, { projection: { _id: 1 } } as any);
            const admins = await adminsCursor.toArray();
            if (admins && admins.length) {
              const adminDocs = admins.map((a: any) => ({
                userId: (a._id || '').toString(),
                type: 'system_announcement',
                title: 'Event Created',
                message: `${event?.title || 'An event'} has been created and published.`,
                read: false,
                data: { eventId: (event as any)?._id?.toString?.() },
                createdAt: new Date(),
              }));
              if (adminDocs.length) await db.notifications.insertMany(adminDocs as any[]);
            }
          } catch (e) {
            console.warn('Event create (events.ts): failed to notify admins (non-fatal):', e);
          }
        }
      } catch (notifyErr) {
        console.warn('Event create (events.ts): failed to broadcast notifications (non-fatal):', notifyErr);
      }
      
      // Return the created event with proper ID
      res.status(201).json({
        ...event,
        id: event?._id.toString()
      });
    } catch (error) {
      console.error('Error creating event:', error);
      
      // Clean up uploaded files if any
      const files = (req as any).files || [];
      for (const file of files) {
        try {
          if (await exists(file.path)) {
            await unlink(file.path);
          }
        } catch (cleanupError) {
          console.error('Error cleaning up file:', cleanupError);
        }
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to create event';
      res.status(500).json({ 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }
];

export const handleUpdateEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Validate ObjectId format
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid event ID format' });
    }
    
    const filter: Filter<Event> = { _id: toObjectId(id) } as any;
    // Remove fields that shouldn't be updated (organizer, id, _id, createdAt)
    const { organizer, id: frontendId, _id, createdAt, ...cleanUpdateData } = updateData;
    
    const update = {
      $set: {
        ...cleanUpdateData,
        updatedAt: new Date()
      }
    };
    
    const result = await db.events.findOneAndUpdate(
      filter,
      update,
      { returnDocument: 'after' }
    );

    // get the updated document from the driver response
    const updated: any = (result as any)?.value ?? result;

    // Check if result is null (event not found)
    if (!updated) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Convert _id to id for frontend compatibility
    const formattedEvent = {
      ...updated,
      id: updated._id?.toString()
    };
    
    res.json({ event: formattedEvent });

    // If status changed to published, broadcast notifications
    try {
      const existing = await db.events.findOne({ _id: toObjectId(id) });
      const becamePublished = (existing as any)?.status !== 'published' && (updated as any)?.status === 'published';
      if (becamePublished) {
        const title = (updated as any)?.title || 'An event';
        const type = (updated as any)?.type || 'event';
        const eventId = (updated as any)?._id?.toString?.();
        const usersCursor = db.users.find({ role: { $regex: /^user$/i } }, { projection: { _id: 1 } } as any);
        const users = await usersCursor.toArray();
        if (users && users.length) {
          const docs = users.map((u: any) => ({
            userId: (u._id || '').toString(),
            type: 'event_reminder',
            title: 'New event posted',
            message: `${title} — ${type} just went live. Tap to view and register!`,
            read: false,
            data: { eventId, eventType: type, startDate: (updated as any)?.startDate, registrationDeadline: (updated as any)?.registrationDeadline },
            createdAt: new Date(),
          }));
          if (docs.length) await db.notifications.insertMany(docs as any[]);
        }
        // Mirror notify admins for testing
        try {
          const adminsCursor = db.users.find({ role: { $regex: /admin$/i } }, { projection: { _id: 1 } } as any);
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
          console.warn('Event publish (events.ts): failed to notify admins (non-fatal):', e);
        }
      }
    } catch (notifyErr) {
      console.warn('Event update (events.ts): failed to broadcast notifications (non-fatal):', notifyErr);
    }
  } catch (error: any) {
    console.error('Error updating event:', error);
    // Return more specific error message
    res.status(500).json({ 
      error: 'Failed to update event', 
      details: error.message 
    });
  }
};

export const handleDeleteEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId format
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid event ID format' });
    }
    
    const filter: Filter<Event> = { _id: toObjectId(id) } as any;
    const result = await db.events.deleteOne(filter);
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
};
