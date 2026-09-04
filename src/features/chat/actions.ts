import { ChatMessage } from "./types";
import { AICoachContext } from "@/lib/ai/types";
import { fetchTasks, fetchCompletions, getEffectiveUserId, decryptTaskModel } from "../tasks/actions";
import { calculateDashboardStats } from "../analytics/calculations";
import { HeuristicAIProvider } from "@/lib/ai/provider";
import { createClient } from "@/utils/supabase/client";
import { decryptEmbeddedEncryptedText } from "@/lib/crypto/encryption";

const CHAT_STORAGE_PREFIX = "mytrack_chat_messages_";

export const DEFAULT_INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "msg-welcome",
    sender: "assistant",
    content:
      "### 👋 Salut, je suis Tracky !\n\nJe suis ton **coach IA personnel**. J'analyse en continu tes habitudes, ton momentum et tes streaks pour t'aider à progresser chaque jour.\n\n> 🎯 *Pose-moi une question sur ta semaine ou choisis une suggestion ci-dessous !*",
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
  const [rawTasks, completions] = await Promise.all([
    fetchTasks(targetId),
    fetchCompletions(targetId),
  ]);
  // Ensure all task titles and descriptions are decrypted before feeding to the AI coach
  const tasks = await Promise.all(rawTasks.map((t) => decryptTaskModel(t)));
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
      const mapped: ChatMessage[] = await Promise.all(
        data.map(async (m: any) => ({
          id: m.id,
          sender: m.sender,
          content: await decryptEmbeddedEncryptedText(m.content),
          timestamp: m.created_at,
          suggestedActions: m.context_snapshot?.suggestedActions,
        }))
      );
      saveStoredChatMessages(mapped, targetId);
      return mapped;
    }
  } catch (err) {
    console.warn("Supabase fetchDbChatMessages fallback:", err);
  }

  const stored = getStoredChatMessages(targetId);
  return Promise.all(
    stored.map(async (m) => ({
      ...m,
      content: await decryptEmbeddedEncryptedText(m.content),
    }))
  );
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

  let responseContent = "";
  let suggestedActions: string[] | undefined = undefined;

  // 1. Try server-side LLM route (Groq Llama 3.3 / OpenAI / Gemini)
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: userText }],
        context,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.content) {
        responseContent = data.content;
        suggestedActions = data.suggestedActions;
      }
    }
  } catch (err) {
    console.warn("Server /api/chat error, falling back to local heuristic provider:", err);
  }

  // 2. Client-side heuristic fallback if server LLM unavailable
  if (!responseContent) {
    const heuristic = new HeuristicAIProvider();
    const heuristicRes = await heuristic.generateResponse({
      messages: [{ role: "user", content: userText }],
      context,
    });
    responseContent = heuristicRes.content;
    suggestedActions = heuristicRes.suggestedActions;
  }

  // Transparently decrypt any embedded encrypted tokens in the final output
  const cleanResponse = await decryptEmbeddedEncryptedText(responseContent);

  const assistantMessage: ChatMessage = {
    id: "msg-" + Date.now(),
    sender: "assistant",
    content: cleanResponse,
    timestamp: new Date().toISOString(),
    suggestedActions,
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
          content: cleanResponse,
          context_snapshot: { suggestedActions },
        },
      ]);
    }
  } catch (err) {
    console.warn("Supabase chat message insert fallback:", err);
  }

  return assistantMessage;
}
