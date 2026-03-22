"use client";

import { useEffect, useRef } from "react";
import { CONSTANTS } from "@/lib/constants";

export function AnnouncementBanner() {
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const title = CONSTANTS.ANNOUNCEMENT_BANNER.TITLE;
  const message = CONSTANTS.ANNOUNCEMENT_BANNER.MESSAGE;
  const isEnabled = CONSTANTS.ANNOUNCEMENT_BANNER.IS_ENABLED;

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
  }, [isEnabled, message, title]);

  if (!isEnabled || (!title && !message)) {
    return null;
  }

  return (
    <div
      ref={bannerRef}
      className="relative z-20 border-b border-amber-200 bg-amber-50 px-6 py-3 text-amber-950"
    >
      <div className="mx-auto max-w-7xl flex justify-center items-center">
        {title && <p className="text-sm font-semibold">{title}</p>}
        {message && <p className="mx-1 text-sm">{message}</p>}
      </div>
    </div>
  );
}
