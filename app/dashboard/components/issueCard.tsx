import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

export const IssueCard = ({...props}) => {
  return (
    <Link href={props.issue.issueUrl} target="_blank">
      <Card className="w-[90vw]">
        <CardHeader>
          <CardTitle>{props.issue.issueTitle}</CardTitle>
          <CardDescription>{`#${props.issue.issueNumber}`}</CardDescription>
        </CardHeader>
        <CardFooter>
          <p>{props.issue.linkedProject}</p>
        </CardFooter>
      </Card>
    </Link>
  )
}
