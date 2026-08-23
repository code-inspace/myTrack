import { ChatMessage } from "./types";
import { AICoachContext } from "@/lib/ai/types";
import { getStoredTasks, getStoredCompletions } from "../tasks/actions";
import { calculateDashboardStats } from "../analytics/calculations";
import { getAIProvider } from "@/lib/ai/provider";

const CHAT_STORAGE_PREFIX = "mytrack_chat_messages_";

export const DEFAULT_INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "msg-welcome",
    sender: "assistant",
    content:
      "Salut ! Je suis ton **coach MyTrack**. J'analyse en continu tes habitudes, ton momentum et tes streaks pour t'aider à progresser chaque jour.\n\nPose-moi une question sur ta semaine ou choisis une suggestion ci-dessous !",
    timestamp: new Date().toISOString(),
    suggestedActions: [
      "Comment s'est passée ma semaine ?",
      "Pourquoi mon momentum change ?",
      "Quelles habitudes améliorer ?",
    ],
  },
];

export function extractAICoachContext(userId?: string): AICoachContext {
  const tasks = getStoredTasks(userId);
  const completions = getStoredCompletions(userId);
  const stats = calculateDashboardStats(tasks, completions, "week");

  const taskCompletionCounts = tasks.map((t) => {
    const count = completions.filter((c) => c.taskId === t.id && c.completed).length;
    return { title: t.title, count };
  });

  const topHabits = taskCompletionCounts
    .filter((t) => t.count >= 2)
    .sort((a, b) => b.count - a.count)
    .map((t) => t.title);

  const strugglingHabits = taskCompletionCounts
    .filter((t) => t.count === 0)
    .map((t) => t.title);

  const recentDaysSummary = stats.last7DaysStatus
    .map((d) => `${d.dayName}: ${d.status === "completed" ? "Fait" : "Manqué"}`)
    .join(", ");

  return {
    currentStreak: stats.currentStreak,
    bestStreak: stats.bestStreak,
    momentum: stats.momentum,
    completionRate: stats.completionRate,
    totalWins: stats.totalWins,
    tasksScheduled: tasks.length,
    tasksCompleted: stats.tasksCompleted,
    topHabits,
    strugglingHabits,
    recentDaysSummary,
  };
}

export function getStoredChatMessages(userId: string = "user-demo"): ChatMessage[] {
  if (typeof window === "undefined") return DEFAULT_INITIAL_MESSAGES;
  const key = CHAT_STORAGE_PREFIX + userId;
  const stored = localStorage.getItem(key);
  if (!stored) {
    localStorage.setItem(key, JSON.stringify(DEFAULT_INITIAL_MESSAGES));
    return DEFAULT_INITIAL_MESSAGES;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return DEFAULT_INITIAL_MESSAGES;
  }
}

export function saveStoredChatMessages(messages: ChatMessage[], userId: string = "user-demo"): void {
  if (typeof window === "undefined") return;
  const key = CHAT_STORAGE_PREFIX + userId;
  localStorage.setItem(key, JSON.stringify(messages));
}

export async function processUserMessage(userText: string, userId?: string): Promise<ChatMessage> {
  const context = extractAICoachContext(userId);
  const provider = getAIProvider();

  const response = await provider.generateResponse({
    messages: [{ role: "user", content: userText }],
    context,
  });

  const assistantMessage: ChatMessage = {
    id: "msg-" + Date.now(),
    sender: "assistant",
    content: response.content,
    timestamp: new Date().toISOString(),
    suggestedActions: response.suggestedActions,
  };

  return assistantMessage;
}
