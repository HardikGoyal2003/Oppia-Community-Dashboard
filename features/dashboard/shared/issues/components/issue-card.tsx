import { ArchiveIcon } from "@/components/icons/archive-icon";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Issue } from "@/lib/domain/issues.types";
import { getElapsedTimeLabel } from "@/lib/utils/date.utils";
import Link from "next/link";
import { useArchiveIssue } from "../hooks/use-archive-issue.hook";
import { CircleCheck } from "lucide-react";
import { useMarkIssueAsnwered } from "../hooks/use-mark-issue-answered.hook";

interface IssueCardProps {
  issue: Issue;
  serialNumber: number;
}

export const IssueCard = ({ issue, serialNumber }: IssueCardProps) => {
  const archiveIssue = useArchiveIssue();
  const issueAnswered = useMarkIssueAsnwered();
  const waitedForLabel = getElapsedTimeLabel(issue.lastCommentCreatedAt);

  return (
    <Card className="w-full flex flex-col sm:flex-row px-4 sm:px-10">
      <div
        className="sm:w-24 w-full text-3xl sm:text-5xl font-bold
                        flex items-center justify-center
                        border-b sm:border-b-0 sm:border-r
                        py-4 sm:py-0 sm:pr-6"
      >
        {serialNumber}
      </div>

      <Link href={issue.issueUrl} target="_blank" className="w-full">
        <CardHeader className="w-full px-4 sm:px-6">
          <CardTitle className="text-base sm:text-lg wrap-break-words">
            {issue.issueTitle}
          </CardTitle>
          <CardDescription className="space-y-1">
            <p>{`#${issue.issueNumber}`}</p>
            {!issue.isArchived ? (
              <p className="text-xs text-slate-600">
                Waiting {waitedForLabel} since last comment
              </p>
            ) : issue.archivedBy || issue.archivedAt ? (
              <p className="text-xs text-slate-500">
                {issue.archivedBy && (
                  <span>Archived by {issue.archivedBy}</span>
                )}
                {issue.archivedBy && issue.archivedAt && <span> · </span>}
                {issue.archivedAt && (
                  <span>{getElapsedTimeLabel(issue.archivedAt)} ago</span>
                )}
              </p>
            ) : null}
          </CardDescription>
        </CardHeader>
      </Link>

      {!issue.isArchived && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => issueAnswered(issue)}
              className="p-2 text-muted-foreground hover:text-foreground"
              aria-label="Mark as answered"
            >
              <CircleCheck className="cursor-pointer" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Mark Done</p>
          </TooltipContent>
        </Tooltip>
      )}

      {!issue.isArchived && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => archiveIssue(issue)}
              className="p-2 text-muted-foreground hover:text-foreground"
              aria-label="Archive issue"
            >
              <ArchiveIcon className="h-6 w-6 cursor-pointer" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Archive issue</p>
          </TooltipContent>
        </Tooltip>
      )}
    </Card>
  );
};
