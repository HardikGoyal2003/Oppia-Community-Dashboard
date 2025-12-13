"use client";
import { useState } from "react";
import { IssueCard } from "./components/issueCard";
import { Issue } from "@/lib/github/types";

export default function Dashboard() {
  const [responseData, setResponseData] = useState<{ issues: Issue[] } | null>(null);

  const handleClick = async () => {
    const a = await fetch('/api/dashboard')
    const data = await a.json();
    setResponseData(data);
    console.log(data);
  }

  return (
  <div className="flex flex-wrap gap-5 p-12">
    
    {!responseData && <button onClick={handleClick}>Click Me</button>}
    

    {responseData && responseData.issues.map((issue: Issue) => (
      <IssueCard key={issue.issueNumber} issue={issue} />
    ))}
  </div>
  );
}
