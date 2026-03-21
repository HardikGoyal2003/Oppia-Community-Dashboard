import { Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import { DB_PATHS } from "./db-paths";
import { normalizeTimestamp } from "./timestamp.utils";

export interface AnnouncementBannerModel {
  title: string;
  message: string;
  isEnabled: boolean;
  updatedAt: Date;
}

const db = getAdminFirestore();

/**
 * Validates the raw announcement banner document shape from Firestore.
 *
 * @param data The raw Firestore document data.
 * @returns Nothing. Throws when the announcement banner data is invalid.
 */
function assertAnnouncementBannerData(
  data: FirebaseFirestore.DocumentData,
): asserts data is {
  title: string;
  message: string;
  isEnabled: boolean;
  updatedAt: Date | Timestamp;
} {
  if (typeof data.title !== "string") {
    throw new Error("Announcement banner title must be a string.");
  }

  if (typeof data.message !== "string") {
    throw new Error("Announcement banner message must be a string.");
  }

  if (typeof data.isEnabled !== "boolean") {
    throw new Error("Announcement banner isEnabled must be a boolean.");
  }
}

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

  const data = snapshot.data()!;
  assertAnnouncementBannerData(data);

  return {
    title: data.title,
    message: data.message,
    isEnabled: data.isEnabled,
    updatedAt: normalizeTimestamp(data.updatedAt),
  };
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
