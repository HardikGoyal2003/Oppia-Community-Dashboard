import { Timestamp } from "firebase-admin/firestore";
import { normalizeTimestamp } from "../utils/timestamp.utils";
import type { AnnouncementBannerModel } from "./announcements.db";

export type FirestoreAnnouncementBanner = Omit<
  AnnouncementBannerModel,
  "updatedAt"
> & {
  updatedAt: Timestamp;
};

/**
 * Validates the raw Firestore announcement banner document shape.
 *
 * @param banner The raw Firestore document data.
 * @returns Nothing. Throws when the announcement banner data is invalid.
 */
function assertFirestoreAnnouncementBanner(
  banner: FirebaseFirestore.DocumentData,
): asserts banner is FirestoreAnnouncementBanner {
  if (typeof banner.title !== "string") {
    throw new Error("Announcement banner title must be a string.");
  }

  if (typeof banner.message !== "string") {
    throw new Error("Announcement banner message must be a string.");
  }

  if (typeof banner.isEnabled !== "boolean") {
    throw new Error("Announcement banner isEnabled must be a boolean.");
  }

  if (!(banner.updatedAt instanceof Timestamp)) {
    throw new Error("Announcement banner updatedAt must be a Timestamp.");
  }
}

/**
 * Normalizes a Firestore announcement banner document into the app model.
 *
 * @param banner The raw Firestore announcement banner document.
 * @returns The normalized announcement banner model.
 */
export function normalizeAnnouncementBanner(
  banner: FirestoreAnnouncementBanner,
): AnnouncementBannerModel {
  return {
    title: banner.title,
    message: banner.message,
    isEnabled: banner.isEnabled,
    updatedAt: normalizeTimestamp(banner.updatedAt),
  };
}

/**
 * Normalizes raw Firestore announcement banner document data into the app model.
 *
 * @param banner The raw Firestore announcement banner document data.
 * @returns The normalized announcement banner model.
 */
export function normalizeAnnouncementBannerDocument(
  banner: FirebaseFirestore.DocumentData,
): AnnouncementBannerModel {
  assertFirestoreAnnouncementBanner(banner);
  return normalizeAnnouncementBanner(banner);
}
