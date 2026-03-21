import { create } from "zustand";

type SidebarTab =
  | "INCOMING_REQUEST_TAB"
  | "USER_ROLE_MANAGER_TAB"
  | "UNANSWERED_ISSUES_TAB";

interface ActiveSidebarTabState {
  activeSidebarTab: SidebarTab;
  updateActiveSidebarTab: (activeTab: string) => void;
}

export const useActiveSidebarTab = create<ActiveSidebarTabState>((set) => ({
  activeSidebarTab: "INCOMING_REQUEST_TAB",

  updateActiveSidebarTab: (activeTab: string) =>
    set(() => {
      let mappedTab: SidebarTab = "INCOMING_REQUEST_TAB";

      switch (activeTab) {
        case "Incoming Requests":
          mappedTab = "INCOMING_REQUEST_TAB";
          break;
        case "User Role Manager":
          mappedTab = "USER_ROLE_MANAGER_TAB";
          break;
        case "Unanswered Issue":
          mappedTab = "UNANSWERED_ISSUES_TAB";
        default:
          break;
      }

      return { activeSidebarTab: mappedTab };
    }),
}));
