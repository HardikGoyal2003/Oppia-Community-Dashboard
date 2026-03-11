import { ArchiveIcon } from "@/components/icons/archive-icon";
import { CategorizedProjectIssues } from "../dashboard.types"
import type { ContributionPlatform } from "@/lib/auth/auth.types";

type TeamTabsProps = {
  platform: ContributionPlatform;
  categorizedProjectIssuesData: CategorizedProjectIssues | null;
  activeTab: keyof CategorizedProjectIssues;
  setActiveTab: React.Dispatch<
    React.SetStateAction<keyof CategorizedProjectIssues>
  >;
};

const tabBaseStyle =
  "border border-t-4 cursor-pointer p-3 sm:p-4 whitespace-nowrap";

export const TeamTabs = ({
  platform,
  categorizedProjectIssuesData,
  activeTab,
  setActiveTab
}: TeamTabsProps) => {
  const tabs =
    platform === "ANDROID"
      ? (["team1", "team2", "others"] as const)
      : (["team1", "team2", "team3", "others"] as const);

  return (
        <div className="flex flex-wrap text-base sm:text-xl translate-y-px">
        {tabs.map((tab) => (
          <div
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`${tabBaseStyle} ${
              activeTab === tab ? "active-tab" : ""
            }`}
          >
            {tab === "team1" &&
              `${
                platform === "ANDROID" ? "CLAM Team" : "LEAP Team"
              } (${categorizedProjectIssuesData?.team1.length ?? 0})`}
            {tab === "team2" &&
              `${
                platform === "ANDROID"
                  ? "Dev Workflow & Infrastructure Team"
                  : "CORE Team"
              } (${categorizedProjectIssuesData?.team2.length ?? 0})`}
            {tab === "team3" &&
              `Dev Workflow Team (${categorizedProjectIssuesData?.team3.length ?? 0})`}
            {tab === "others" &&
              `Others (${categorizedProjectIssuesData?.others.length ?? 0})`}
          </div>
        ))}

        <div
          key={"archive"}
          onClick={() => setActiveTab("archive")}
          className={`flex ${tabBaseStyle} ${
            activeTab === "archive" ? "active-tab" : ""
          }`}
        >
          <ArchiveIcon className="h-6 w-6 mr-1.5 mt-0.1.25" /> {`Archived Issues (${categorizedProjectIssuesData?.archive.length ?? 0})`}
        </div>
      </div>
    )
}
