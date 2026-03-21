import { Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import { normalizeTimestamp } from "./timestamp.utils";

export interface AnnouncementBannerModel {
  title: string;
  message: string;
  isEnabled: boolean;
  updatedAt: Date;
}

const ANNOUNCEMENTS_COLLECTION = "announcements";
const GLOBAL_BANNER_DOC_ID = "global-banner";

const db = getAdminFirestore();

/**
 * Fetches the persisted global announcement banner configuration.
 *
 * @returns The stored banner configuration, or a disabled default banner when no document exists.
 */
export async function getAnnouncementBanner(): Promise<AnnouncementBannerModel> {
  const snapshot = await db
    .collection(ANNOUNCEMENTS_COLLECTION)
    .doc(GLOBAL_BANNER_DOC_ID)
    .get();

  if (!snapshot.exists) {
    throw new Error("Announcement banner not found.");
  }

  const data = snapshot.data()!;

  return {
    title: typeof data.title === "string" ? data.title : "",
    message: typeof data.message === "string" ? data.message : "",
    isEnabled: Boolean(data.isEnabled),
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
    .collection(ANNOUNCEMENTS_COLLECTION)
    .doc(GLOBAL_BANNER_DOC_ID)
    .set({
      ...banner,
      updatedAt: Timestamp.now(),
    });
}
