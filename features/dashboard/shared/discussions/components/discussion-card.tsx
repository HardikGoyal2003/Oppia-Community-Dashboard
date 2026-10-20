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
import type { Discussion } from "@/lib/domain/discussions.types";
import { getElapsedTimeLabel } from "@/lib/utils/date.utils";
import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { useArchiveDiscussion } from "../hooks/use-archive-discussion.hook";
import { useMarkDiscussionAnswered } from "../hooks/use-mark-discussion-answered.hook";

interface DiscussionCardProps {
  discussion: Discussion;
  serialNumber: number;
}

export const DiscussionCard = ({
  discussion,
  serialNumber,
}: DiscussionCardProps) => {
  const archiveDiscussion = useArchiveDiscussion();
  const discussionAnswered = useMarkDiscussionAnswered();
  const waitedForLabel = getElapsedTimeLabel(discussion.createdAt);

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

      <Link href={discussion.discussionUrl} target="_blank" className="w-full">
        <CardHeader className="w-full px-4 sm:px-6">
          <CardTitle className="text-base sm:text-lg wrap-break-words">
            {discussion.discussionTitle}
          </CardTitle>
          <CardDescription className="space-y-1">
            <p>{`#${discussion.discussionNumber}`}</p>
            {!discussion.isArchived ? (
              <p className="text-xs text-slate-600">
                Waiting {waitedForLabel} since opened
              </p>
            ) : discussion.archivedBy || discussion.archivedAt ? (
              <p className="text-xs text-slate-500">
                {discussion.archivedBy && (
                  <span>Archived by {discussion.archivedBy}</span>
                )}
                {discussion.archivedBy && discussion.archivedAt && (
                  <span> · </span>
                )}
                {discussion.archivedAt && (
                  <span>{getElapsedTimeLabel(discussion.archivedAt)} ago</span>
                )}
              </p>
            ) : null}
          </CardDescription>
        </CardHeader>
      </Link>

      {!discussion.isArchived && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => discussionAnswered(discussion)}
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

      {!discussion.isArchived && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => archiveDiscussion(discussion)}
              className="p-2 text-muted-foreground hover:text-foreground"
              aria-label="Archive discussion"
            >
              <ArchiveIcon className="h-6 w-6 cursor-pointer" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Archive discussion</p>
          </TooltipContent>
        </Tooltip>
      )}
    </Card>
  );
};
