/**
 * Registry of error codes that map to the `/error/:errorCode` page.
 *
 * Mirrors Oppia's `/error/:status_code` pattern: the route stays the same
 * and the rendered page changes based on the error code. Add a new entry
 * here for each additional external service or failure mode.
 */

export type ErrorCode = "GITHUB_API_UNAVAILABLE";

export type ErrorCodeMeta = {
  heading: string;
  message: string;
  description: string;
  homePageHref: string;
  issueTrackerHref: string;
};

const REPO_ISSUES_URL =
  "https://github.com/HardikGoyal2003/Oppia-Community-Dashboard/issues";

const ERROR_CODE_META: Record<ErrorCode, ErrorCodeMeta> = {
  GITHUB_API_UNAVAILABLE: {
    heading: "Error 502 - Bad Gateway",
    message:
      "Oops! Something went wrong. The server received an invalid response.",
    description:
      "We're having trouble connecting to the service right now. This is usually a temporary problem and it wasn't your fault. Please try returning to the home page. If the issue continues, please let us know through our issue tracker. Sorry about this.",
    homePageHref: "/dashboard",
    issueTrackerHref: REPO_ISSUES_URL,
  },
};

const FALLBACK_ERROR_CODE_META: ErrorCodeMeta = {
  heading: "Error",
  message: "Something went wrong.",
  description:
    "An unexpected error occurred while loading this page. This is usually a temporary problem and it wasn't your fault. Please try returning to the home page. If the issue continues, please let us know through our issue tracker.",
  homePageHref: "/",
  issueTrackerHref: REPO_ISSUES_URL,
};

/**
 * Resolves the page content to render for a given error code.
 *
 * @param errorCode The error code from the `/error/:errorCode` route.
 * @returns The metadata used to render the error page.
 */
export function getErrorCodeMeta(errorCode: string): ErrorCodeMeta {
  if (errorCode in ERROR_CODE_META) {
    return ERROR_CODE_META[errorCode as ErrorCode];
  }

  return FALLBACK_ERROR_CODE_META;
}
