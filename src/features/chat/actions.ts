import { ChatMessage } from "./types";
import { AICoachContext } from "@/lib/ai/types";
import { fetchTasks, fetchCompletions, getEffectiveUserId } from "../tasks/actions";
import { calculateDashboardStats } from "../analytics/calculations";
import { getAIProvider } from "@/lib/ai/provider";
import { createClient } from "@/utils/supabase/client";

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

export async function extractAICoachContext(userId?: string): Promise<AICoachContext> {
  const targetId = getEffectiveUserId(userId);
  const [tasks, completions] = await Promise.all([
    fetchTasks(targetId),
    fetchCompletions(targetId),
  ]);
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

export async function fetchDbChatMessages(userId?: string): Promise<ChatMessage[]> {
  const targetId = getEffectiveUserId(userId);
  const key = CHAT_STORAGE_PREFIX + targetId;

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*, chat_conversations!inner(user_id)")
      .eq("chat_conversations.user_id", targetId)
      .order("created_at", { ascending: true });

    if (!error && data && data.length > 0) {
      const mapped: ChatMessage[] = data.map((m: any) => ({
        id: m.id,
        sender: m.sender,
        content: m.content,
        timestamp: m.created_at,
        suggestedActions: m.context_snapshot?.suggestedActions,
      }));
      saveStoredChatMessages(mapped, targetId);
      return mapped;
    }
  } catch (err) {
    console.warn("Supabase fetchDbChatMessages fallback:", err);
  }

  return getStoredChatMessages(targetId);
}

export function getStoredChatMessages(userId: string = "00000000-0000-0000-0000-000000000001"): ChatMessage[] {
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

export function saveStoredChatMessages(messages: ChatMessage[], userId: string = "00000000-0000-0000-0000-000000000001"): void {
  if (typeof window === "undefined") return;
  const key = CHAT_STORAGE_PREFIX + userId;
  localStorage.setItem(key, JSON.stringify(messages));
}

export async function processUserMessage(userText: string, userId?: string): Promise<ChatMessage> {
  const targetId = getEffectiveUserId(userId);
  const context = await extractAICoachContext(targetId);
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

  // Persist to Supabase if conversation exists
  try {
    const supabase = createClient();
    const { data: conv } = await supabase
      .from("chat_conversations")
      .select("id")
      .eq("user_id", targetId)
      .limit(1)
      .single();

    if (conv?.id) {
      await supabase.from("chat_messages").insert([
        {
          conversation_id: conv.id,
          sender: "user",
          content: userText,
        },
        {
          conversation_id: conv.id,
          sender: "assistant",
          content: response.content,
          context_snapshot: { suggestedActions: response.suggestedActions },
        },
      ]);
    }
  } catch (err) {
    console.warn("Supabase chat message insert fallback:", err);
  }

  return assistantMessage;
}
