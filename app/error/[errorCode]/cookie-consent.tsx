"use client";

import { useSyncExternalStore } from "react";

const COOKIE_CONSENT_STORAGE_KEY = "oppia_cookie_consent";

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getSnapshot(): boolean {
  return window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) === "accepted";
}

function getServerSnapshot(): boolean {
  return false;
}

export function CookieConsent() {
  const accepted = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  if (accepted) {
    return null;
  }

  const handleAccept = () => {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, "accepted");
    window.dispatchEvent(new Event("storage"));
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-black/70 px-6 py-5 text-white">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
        <p className="text-sm leading-6 text-white/90">
          We use cookies to help personalise content and improve your
          experience. By clicking OK, you agree to our use of cookies.{" "}
          <a href="#" className="font-bold underline">
            Privacy Policy
          </a>
        </p>
        <button
          type="button"
          onClick={handleAccept}
          className="rounded-md bg-[#1a73e8] px-8 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          OK
        </button>
      </div>
    </div>
  );
}
