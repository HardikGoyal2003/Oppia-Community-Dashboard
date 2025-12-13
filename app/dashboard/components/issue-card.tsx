import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

interface IssueCardProps {
  issue: {
    issueUrl: string;
    issueTitle: string;
    issueNumber: number;
  };
  serialNumber: number;
}

export const IssueCard = ({ issue, serialNumber }: IssueCardProps) => {
  return (
    <Link href={issue.issueUrl} target="_blank" className="w-full">
      <Card className="w-full flex flex-col sm:flex-row px-4 sm:px-10">

        <div className="sm:w-24 w-full text-3xl sm:text-5xl font-bold
                        flex items-center justify-center
                        border-b sm:border-b-0 sm:border-r
                        py-4 sm:py-0 sm:pr-6">
          {serialNumber}
        </div>

        <CardHeader className="w-full px-4 sm:px-6">
          <CardTitle className="text-base sm:text-lg wrap-break-words">
            {issue.issueTitle}
          </CardTitle>
          <CardDescription>{`#${issue.issueNumber}`}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
};
