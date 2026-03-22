import { Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import { DB_PATHS } from "../db-paths";
import { normalizeAnnouncementBannerDocument } from "./announcements.mapper";

export interface AnnouncementBannerModel {
  title: string;
  message: string;
  isEnabled: boolean;
  updatedAt: Date;
}

const db = getAdminFirestore();

/**
 * Fetches the persisted global announcement banner configuration.
 *
 * @returns The stored banner configuration, or a disabled default banner when no document exists.
 */
export async function getAnnouncementBanner(): Promise<AnnouncementBannerModel> {
  const snapshot = await db
    .collection(DB_PATHS.ANNOUNCEMENTS.COLLECTION)
    .doc(DB_PATHS.ANNOUNCEMENTS.GLOBAL_BANNER_DOC_ID)
    .get();

  if (!snapshot.exists) {
    throw new Error("Announcement banner not found.");
  }

  return normalizeAnnouncementBannerDocument(snapshot.data()!);
}

/**
 * Persists the global announcement banner and refreshes its update timestamp.
 *
 * @param banner The banner payload to store.
 * @returns A promise that resolves when the banner document has been written.
 */
export async function upsertAnnouncementBanner(
  banner: Omit<AnnouncementBannerModel, "updatedAt">,
): Promise<void> {
  await db
    .collection(DB_PATHS.ANNOUNCEMENTS.COLLECTION)
    .doc(DB_PATHS.ANNOUNCEMENTS.GLOBAL_BANNER_DOC_ID)
    .set({
      ...banner,
      updatedAt: Timestamp.now(),
    });
}
