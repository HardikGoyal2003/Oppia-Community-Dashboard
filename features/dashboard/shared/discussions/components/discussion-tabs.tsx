import { ArchiveIcon } from "@/components/icons/archive-icon";
import type { CategorizedProjectDiscussions } from "../../../dashboard.types";

type DiscussionTabsProps = {
  categorizedProjectDiscussionsData: CategorizedProjectDiscussions | null;
  activeTab: keyof CategorizedProjectDiscussions;
  setActiveTab: React.Dispatch<
    React.SetStateAction<keyof CategorizedProjectDiscussions>
  >;
};

const tabBaseStyle =
  "border border-t-4 cursor-pointer p-3 sm:p-4 whitespace-nowrap";

export const DiscussionTabs = ({
  categorizedProjectDiscussionsData,
  activeTab,
  setActiveTab,
}: DiscussionTabsProps) => {
  const tabs = ["active", "archive"] as const;

  return (
    <div className="flex flex-wrap text-base sm:text-xl translate-y-px">
      {tabs.map((tab) => (
        <div
          key={tab}
          onClick={() => setActiveTab(tab)}
          className={`flex ${tabBaseStyle} ${
            activeTab === tab ? "active-tab" : ""
          }`}
        >
          {tab === "active" &&
            `Unanswered Discussions (${
              categorizedProjectDiscussionsData?.active.length ?? 0
            })`}
          {tab === "archive" && (
            <>
              <ArchiveIcon className="h-6 w-6 mr-1.5 mt-0.1.25" />{" "}
              {`Archived Discussions (${
                categorizedProjectDiscussionsData?.archive.length ?? 0
              })`}
            </>
          )}
        </div>
      ))}
    </div>
  );
};
