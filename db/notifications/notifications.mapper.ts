import { Notification } from "@/lib/auth/auth.types";
import { Timestamp } from "firebase-admin/firestore";

export function normalizeNotifications(value: Notification[]): Notification[] {
  return value.map((notification) => {
    const createdAt = notification.createdAt;

    return {
      id: notification.id,
      message: notification.message,
      read: notification.read,
      createdAt:
        createdAt instanceof Timestamp
          ? createdAt.toDate()
          : createdAt instanceof Date
            ? createdAt
            : new Date(),
    };
  });
}
