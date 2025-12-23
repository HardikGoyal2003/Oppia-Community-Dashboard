import { ArchiveIcon } from "@/components/icons/archive-icon";
import { CategorizedProjectIssues } from "../dashboard.types"

type TeamTabsProps = {
  categorizedProjectIssuesData: CategorizedProjectIssues | null;
  activeTab: keyof CategorizedProjectIssues;
  setActiveTab: React.Dispatch<
    React.SetStateAction<keyof CategorizedProjectIssues>
  >;
};

const tabBaseStyle =
  "border border-t-4 cursor-pointer p-3 sm:p-4 whitespace-nowrap";

export const TeamTabs = ({categorizedProjectIssuesData, activeTab, setActiveTab}: TeamTabsProps) => {

  return (
        <div className="flex flex-wrap text-base sm:text-xl translate-y-px">
        {(["leap", "core", "dev", "others"] as const).map((tab) => (
          <div
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`${tabBaseStyle} ${
              activeTab === tab ? "active-tab" : ""
            }`}
          >
            {tab === "leap" && `LEAP Team (${categorizedProjectIssuesData?.leap.length ?? 0})`}
            {tab === "core" && `CORE Team (${categorizedProjectIssuesData?.core.length ?? 0})`}
            {tab === "dev" && `Dev Workflow Team (${categorizedProjectIssuesData?.dev.length ?? 0})`}
            {tab === "others" && `Others (${categorizedProjectIssuesData?.others.length ?? 0})`}
          </div>
        ))}

        <div
          key={"archive"}
          onClick={() => setActiveTab("archive")}
          className={`flex ${tabBaseStyle} ${
            activeTab === "archive" ? "active-tab" : ""
          }`}
        >
          <ArchiveIcon className="h-6 w-6 mr-1.5 mt-0.1.25" /> {`Archived Issues(${categorizedProjectIssuesData?.archive.length ?? 0})`}
        </div>
      </div>
    )
}