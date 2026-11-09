import { getOrgMeta } from "@/db/org-meta/org-meta.db";
import type { OrgMetaRecord } from "@/db/org-meta/org-meta.mapper";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { fetchOrgAndCollaboratorAccess } from "./github.query-helpers";
import type { GitHubRepoTarget } from "./github.types";

export type MaintainerAccess = {
  orgMembers: Set<string>;
  collaborators: Set<string>;
  maintainers: Set<string>;
};

/**
 * Resolves the GitHub users whose comments count as a team/maintainer response.
 *
 * The resolution order matches the unanswered-issues flow: client cache first,
 * then the stored org metadata, then the GitHub API.
 *
 * @param target The GitHub repository to inspect.
 * @param platform Optional platform used to read cached org metadata.
 * @param cachedOrgMeta Optional org metadata supplied by the client.
 * @returns The org-member, collaborator, and maintainer username sets.
 */
export async function resolveMaintainerAccess(
  target: GitHubRepoTarget,
  platform?: ContributionPlatform | null,
  cachedOrgMeta?: Omit<OrgMetaRecord, "schemaVersion">,
): Promise<MaintainerAccess> {
  if (cachedOrgMeta) {
    console.log("Using org meta from client cache...");

    return {
      orgMembers: new Set(cachedOrgMeta.orgMembers),
      collaborators: new Set(
        cachedOrgMeta.collaborators.map((collaborator) => collaborator.login),
      ),
      maintainers: new Set(
        cachedOrgMeta.collaborators
          .filter((collaborator) =>
            ["ADMIN", "MAINTAIN", "WRITE"].includes(collaborator.permission),
          )
          .map((collaborator) => collaborator.login),
      ),
    };
  }

  if (platform) {
    const cached = await getOrgMeta(platform);

    if (cached) {
      console.log("Using cached org meta from Firestore...");

      return {
        orgMembers: new Set(cached.orgMembers),
        collaborators: new Set(
          cached.collaborators.map((collaborator) => collaborator.login),
        ),
        maintainers: new Set(
          cached.collaborators
            .filter((collaborator) =>
              ["ADMIN", "MAINTAIN", "WRITE"].includes(collaborator.permission),
            )
            .map((collaborator) => collaborator.login),
        ),
      };
    }

    console.log("No cached org meta found, falling back to GitHub API...");
  } else {
    console.log("Fetching collaborators and org members from GitHub...");
  }

  const fetched = await fetchOrgAndCollaboratorAccess(target);
  const collaboratorEdges = fetched.repository.collaborators.edges;

  return {
    orgMembers: new Set(
      fetched.organization.membersWithRole.nodes.map((member) => member.login),
    ),
    collaborators: new Set(collaboratorEdges.map((entry) => entry.node.login)),
    maintainers: new Set(
      collaboratorEdges
        .filter((entry) =>
          ["ADMIN", "MAINTAIN", "WRITE"].includes(entry.permission),
        )
        .map((entry) => entry.node.login),
    ),
  };
}
