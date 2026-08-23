export interface AICoachContext {
  currentStreak: number;
  bestStreak: number;
  momentum: number;
  completionRate: number;
  totalWins: number;
  tasksScheduled: number;
  tasksCompleted: number;
  topHabits: string[];
  strugglingHabits: string[];
  recentDaysSummary: string;
}

export interface AIRequest {
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  context: AICoachContext;
}

export interface AIResponse {
  content: string;
  suggestedActions?: string[];
}

export interface AIProvider {
  name: string;
  generateResponse(request: AIRequest): Promise<AIResponse>;
}
