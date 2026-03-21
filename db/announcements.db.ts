import { Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import { normalizeOptionalTimestamp } from "./timestamp.utils";

export interface AnnouncementBannerModel {
  title: string;
  message: string;
  isEnabled: boolean;
  updatedAt: Date | null;
}

const ANNOUNCEMENTS_COLLECTION = "announcements";
const GLOBAL_BANNER_DOC_ID = "global-banner";

const db = getAdminFirestore();

export async function getAnnouncementBanner(): Promise<AnnouncementBannerModel> {
  const snapshot = await db
    .collection(ANNOUNCEMENTS_COLLECTION)
    .doc(GLOBAL_BANNER_DOC_ID)
    .get();

  if (!snapshot.exists) {
    return {
      title: "",
      message: "",
      isEnabled: false,
      updatedAt: null,
    };
  }

  const data = snapshot.data()!;

  return {
    title: typeof data.title === "string" ? data.title : "",
    message: typeof data.message === "string" ? data.message : "",
    isEnabled: Boolean(data.isEnabled),
    updatedAt: normalizeOptionalTimestamp(data.updatedAt),
  };
}

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
