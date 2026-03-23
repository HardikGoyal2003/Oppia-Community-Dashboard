"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CONSTANTS } from "@/lib/constants";

export function AnnouncementBanner() {
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const title = CONSTANTS.ANNOUNCEMENT_BANNER.TITLE;
  const message = CONSTANTS.ANNOUNCEMENT_BANNER.MESSAGE;
  const isEnabled = CONSTANTS.ANNOUNCEMENT_BANNER.IS_ENABLED;
  const [isDismissed, setIsDismissed] = useState(false);

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

  if (!isEnabled || isDismissed || (!title && !message)) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  return (
    <div
      ref={bannerRef}
      className="relative z-20 border-b border-amber-200 bg-amber-50 px-6 py-3 text-amber-950"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 pr-10 text-center">
        {title && <p className="text-sm font-semibold">{title}</p>}
        {message && <p className="text-sm">{message}</p>}
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss announcement"
        className="absolute right-4 top-1/2 -translate-y-1/2 rounded p-1 text-amber-900 transition hover:bg-amber-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
