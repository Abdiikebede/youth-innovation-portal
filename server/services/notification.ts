import { db } from './database';
import { ObjectId } from 'mongodb';



export async function sendNotification(
  userId: string,
  message: string,
  type: 'application_update' | 'event_reminder' | 'project_comment' | 'system_announcement' = 'application_update',
  title: string = 'Notification'
): Promise<void> {
  try {
    await db.createNotification({
      userId,
      type,
      title,
      message,
      read: false
    });
  } catch (error) {
    console.error('Send notification error:', error);
  }
}


export async function getUserNotifications(userId: string): Promise<any[]> {
  try {
    return await db.getUserNotifications(userId);
  } catch (error) {
    console.error('Get notifications error:', error);
    return [];
  }
}


export async function markNotificationRead(notificationId: string): Promise<any> {
  try {
    const _id = new ObjectId(notificationId);
    return await db.notifications.updateOne(
      { _id },
      { $set: { read: true } }
    );
  } catch (error) {
    console.error('Mark notification read error:', error);
    return null;
  }
}

export async function markAllNotificationsRead(userId: string): Promise<boolean> {
  try {
    await db.notifications.updateMany(
      { userId },
      { $set: { read: true } }
    );
    return true;
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    return false;
  }
}
