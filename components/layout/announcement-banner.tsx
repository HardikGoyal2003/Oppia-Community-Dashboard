"use client";

import { useEffect, useRef, useState } from "react";

type AnnouncementBannerData = {
  title: string;
  message: string;
  isEnabled: boolean;
  updatedAt: string;
};

export function AnnouncementBanner() {
  const [announcement, setAnnouncement] =
    useState<AnnouncementBannerData | null>(null);
  const bannerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/announcements", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load announcement.");
        }

        const data = (await response.json()) as {
          announcement: AnnouncementBannerData;
        };

        setAnnouncement(data.announcement);
      } catch (error) {
        console.error(error);
      }
    })();
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    const syncBannerHeight = () => {
      const height = bannerRef.current?.offsetHeight ?? 0;
      root.style.setProperty("--announcement-banner-height", `${height}px`);
    };

    syncBannerHeight();
    window.addEventListener("resize", syncBannerHeight);

    return () => {
      window.removeEventListener("resize", syncBannerHeight);
      root.style.setProperty("--announcement-banner-height", "0px");
    };
  }, [announcement]);

  if (
    !announcement ||
    !announcement.isEnabled ||
    (!announcement.title && !announcement.message)
  ) {
    return null;
  }

  return (
    <div
      ref={bannerRef}
      className="relative z-20 border-b border-amber-200 bg-amber-50 px-6 py-3 text-amber-950"
    >
      <div className="mx-auto max-w-7xl flex justify-center items-center">
        {announcement.title && (
          <p className="text-sm font-semibold">{announcement.title}</p>
        )}
        {announcement.message && (
          <p className="mx-1 text-sm">{announcement.message}</p>
        )}
      </div>
    </div>
  );
}
