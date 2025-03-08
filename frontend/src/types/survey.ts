export interface Survey {
  id: string;
  name: string;
  prizePool: string;
  dueDate: string;
  responses?: string;
  status: "draft" | "ongoing" | "completed";
}

export interface NotificationType {
  id: string;
  title: string;
  message: string;
  icon: string;
  timestamp: string;
}
