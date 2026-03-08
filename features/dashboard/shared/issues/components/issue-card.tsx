import { ArchiveIcon } from "@/components/icons/archive-icon";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Issue } from "../../../dashboard.types"; 
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
  
  return (
    <Card className="w-full flex flex-col sm:flex-row px-4 sm:px-10">
        <div className="sm:w-24 w-full text-3xl sm:text-5xl font-bold
                        flex items-center justify-center
                        border-b sm:border-b-0 sm:border-r
                        py-4 sm:py-0 sm:pr-6">
          {serialNumber}
        </div>

      <Link href={issue.issueUrl} target="_blank" className="w-full">
        <CardHeader className="w-full px-4 sm:px-6">
          <CardTitle className="text-base sm:text-lg wrap-break-words">
            {issue.issueTitle}
          </CardTitle>
          <CardDescription>{`#${issue.issueNumber}`}</CardDescription>
        </CardHeader>
      </Link>

      {!issue.isArchived && 
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => issueAnswered(issue)}
            className="p-2 text-muted-foreground hover:text-foreground"
            aria-label="Mark as answered">
            <CircleCheck className="cursor-pointer" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Mark Done</p>
        </TooltipContent>
      </Tooltip>
      }        

      {!issue.isArchived && 
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => archiveIssue(issue)}
            className="p-2 text-muted-foreground hover:text-foreground"
            aria-label="Archive issue">
            <ArchiveIcon className="h-6 w-6 cursor-pointer" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Archive issue</p>
        </TooltipContent>
      </Tooltip>
      }  
    </Card>
  );
};
