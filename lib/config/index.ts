/**
 * @fileoverview Barrel exports for client-safe application configuration.
 *
 * Keep this module free of environment access and large content trees. Both are
 * easy to pull into client bundles when a component imports any symbol from
 * here. Server-only configuration lives in `./server`, and heavy content such
 * as the contributor journey should be imported from its own module.
 */

export { ANNOUNCEMENT_BANNER } from "./announcement.constants";
export { CONTRIBUTING_DOCS, GITHUB_REPOS } from "./github.constants";
export { ANDROID_TEAMS, WEB_TEAMS } from "./teams.constants";
