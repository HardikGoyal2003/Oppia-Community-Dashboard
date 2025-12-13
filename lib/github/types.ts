export interface User {
  login: string;
}

interface Project {
  title: string;
}

interface CommentNode {
  nodes: {
    author: User;
    createdAt: string;
  }[];
}

interface ProjectNode {
  nodes: Project[]
}

export interface RawIssueNode {
  number: number;
  title: string;
  url: string;
  state: string;
  comments: CommentNode;
  projectsV2: ProjectNode
}

export interface Issue {
  issueNumber: number;
  issueUrl: string;
  issueTitle: string;
  linkedProject: string;
}





