"use client";

import { Users } from "lucide-react";
import { getRoleDisplayLabel } from "@/lib/auth/role-display";
import type { TeamLead } from "../overview.types";

export function LeadCoverage({ leads }: { leads: TeamLead[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-r from-white to-slate-50/80 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
              <Users className="h-4 w-4 text-slate-600" />
            </div>
            <h2 className="text-sm font-semibold text-slate-900">Team Leads</h2>
          </div>
          <span className="text-xs font-medium text-slate-500">
            {leads.length} {leads.length === 1 ? "lead" : "leads"}
          </span>
        </div>
      </div>

      <div className="px-6 py-5">
        <div className="space-y-2.5">
          {leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8">
              <Users className="mb-2 h-6 w-6 text-slate-300" />
              <p className="text-sm text-slate-500">
                No leads synced for this team yet.
              </p>
            </div>
          ) : (
            leads.map((lead) => {
              const initial = lead.username
                ? lead.username.charAt(0).toUpperCase()
                : "?";
              return (
                <div
                  key={lead.uid}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-slate-300"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-800 text-xs font-bold text-white shadow-sm">
                      {initial}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        @{lead.username}
                      </p>
                      <p className="text-xs text-slate-500">Lead</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                    {getRoleDisplayLabel(lead.role)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
