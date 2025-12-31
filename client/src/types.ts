export type User = {
  id: string;
  email: string;
};

export type Organization = {
  id: string;
  name: string;
  role?: "ADMIN" | "MEMBER";
};

export type Project = {
  id: string;
  orgId: string;
  name: string;
  createdAt?: string;
};

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type Member = {
  membershipId: string;
  role: "ADMIN" | "MEMBER";
  joinedAt: string;
  userId: string;
  email: string;
};

export type Label = {
  id: string;
  orgId: string;
  name: string;
  createdAt?: string;
};

export type Comment = {
  id: string;
  body: string;
  createdAt: string;
  authorUserId: string;
  authorEmail: string;
};

export type Task = {
  id: string;
  columnId: string;
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  dueDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
  assigneeUserId?: string | null;
};

export type Column = {
  id: string;
  name: string;
  tasks: Task[];
};
