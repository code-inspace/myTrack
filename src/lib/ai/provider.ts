import { AIProvider, AIRequest, AIResponse } from "./types";
import { SYSTEM_COACH_PROMPT, formatAIContext } from "./prompts";

/**
 * Built-in Intelligent Heuristic AI Coach
 * Analyzes live habit completion, streak, and momentum without requiring an external API key.
 */
export class HeuristicAIProvider implements AIProvider {
  name = "Heuristic MyTrack Coach";

  async generateResponse(request: AIRequest): Promise<AIResponse> {
    const { messages, context } = request;
    const lastUserMessage = messages[messages.length - 1]?.content.toLowerCase() || "";

    const isFrench = /[éèàùçâêîôû]|comment|pourquoi|analyse|semaine|progression|coach|salut|bonjour/i.test(lastUserMessage);

    // 1. Weekly analysis query
    if (
      lastUserMessage.includes("week") ||
      lastUserMessage.includes("semaine") ||
      lastUserMessage.includes("how am i doing") ||
      lastUserMessage.includes("comment")
    ) {
      if (isFrench) {
        return {
          content: `Voici l'analyse de ta semaine :\n\n- **Taux de complétion** : **${context.completionRate}%** avec **${context.totalWins} victoires** au total.\n- **Série actuelle (Streak)** : **${context.currentStreak} jours** consécutifs (ton record personnel est de **${context.bestStreak} jours**).\n- **Momentum** : **${context.momentum}/100**.\n\n${
            context.strugglingHabits.length > 0
              ? `💡 **Point d'attention** : Tu as manqué de régularité sur **${context.strugglingHabits.join(", ")}**. Je te conseille de réduire la cible ou de caler ces tâches plus tôt dans la journée.`
              : `🔥 **Superbe régularité** ! Tu as maintenu l'ensemble de tes habitudes.`
          }\n\nMon conseil pour demain : continue sur cette lancée sans augmenter brutalement la charge.`,
          suggestedActions: ["Analyser mon momentum", "Quelles habitudes améliorer ?", "Programme de demain"],
        };
      } else {
        return {
          content: `Here is your weekly performance breakdown:\n\n- **Completion Rate**: **${context.completionRate}%** with **${context.totalWins} total wins**.\n- **Current Streak**: **${context.currentStreak} days** (Your best streak is **${context.bestStreak} days**).\n- **Momentum Score**: **${context.momentum}/100**.\n\n${
            context.strugglingHabits.length > 0
              ? `💡 **Area for improvement**: You experienced missed days with **${context.strugglingHabits.join(", ")}**. Consider locking in an earlier time slot.`
              : `🔥 **Incredible consistency** across all your scheduled habits!`
          }\n\nTactical takeaway: Focus on protecting your **${context.currentStreak}-day streak** tomorrow!`,
          suggestedActions: ["Why is my momentum going down?", "What should I focus on tomorrow?", "Analyze my habits"],
        };
      }
    }

    // 2. Momentum query
    if (lastUserMessage.includes("momentum") || lastUserMessage.includes("score")) {
      if (isFrench) {
        return {
          content: `Ton score de **Momentum est à ${context.momentum}/100**.\n\nLe Momentum combine ton taux de complétion quotidien (${context.completionRate}%), ton streak actif (${context.currentStreak} jours) et le respect de tes créneaux horaires.\n\n${
            context.momentum >= 60
              ? `🚀 Ton momentum est en hausse (+10 pts) ! Tu as une excellente dynamique.`
              : `⚡ Pour faire grimper ton momentum au-dessus de 70, valide tes tâches prioritaires dès le matin.`
          }`,
          suggestedActions: ["Comment s'est passée ma semaine ?", "Quelles habitudes améliorer ?"],
        };
      } else {
        return {
          content: `Your **Momentum is at ${context.momentum}/100**.\n\nMomentum scales based on your recent habit completion (${context.completionRate}%), streak multiplier (${context.currentStreak} days), and task consistency.\n\n${
            context.momentum >= 60
              ? `🚀 Strong velocity (+10 points vs previous period). You are locked into a great rhythm.`
              : `⚡ Complete your active tasks early in the morning to push your momentum past 70.`
          }`,
          suggestedActions: ["How am I doing this week?", "What habits am I struggling with?"],
        };
      }
    }

    // Default response
    if (isFrench) {
      return {
        content: `Je suis ton coach MyTrack. Avec **${context.totalWins} tâches validées**, un **streak de ${context.currentStreak} jours** et un **momentum de ${context.momentum}/100**, tu progresses bien.\n\nQue souhaites-tu analyser en détail ?`,
        suggestedActions: ["Comment s'est passée ma semaine ?", "Pourquoi mon momentum change ?", "Quelles habitudes améliorer ?"],
      };
    } else {
      return {
        content: `I'm your MyTrack AI Coach. With **${context.totalWins} completed wins**, a **${context.currentStreak}-day streak**, and **${context.momentum}/100 momentum**, you are building solid consistency.\n\nWhat would you like me to analyze?`,
        suggestedActions: ["How am I doing this week?", "What habits am I struggling with?", "Analyze my momentum"],
      };
    }
  }
}

/**
 * Universal AI Provider Factory
 * Supports Groq LLMs (openai/gpt-oss-120b, openai/gpt-oss-20b, qwen/qwen3.6-27b), OpenAI, Gemini, or Heuristic Engine.
 */
export function getAIProvider(): AIProvider {
  const providerType = (process.env.AI_PROVIDER || (process.env.GROQ_API_KEY ? "groq" : "heuristic")).toLowerCase();
  const apiKey = process.env.AI_API_KEY || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;

  // 1. Groq (High-Speed LLMs on Groq LPUs)
  if ((providerType === "groq" || providerType === "llama") && apiKey) {
    return {
      name: "Groq AI Coach",
      generateResponse: async (request: AIRequest): Promise<AIResponse> => {
        try {
          const model = process.env.AI_MODEL || "openai/gpt-oss-120b";
          const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: `${SYSTEM_COACH_PROMPT}\n${formatAIContext(request.context)}` },
                ...request.messages,
              ],
              temperature: 0.7,
            }),
          });
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            return {
              content,
              suggestedActions: ["Comment s'est passée ma semaine ?", "Analyser mon momentum", "Quelles habitudes améliorer ?"],
            };
          }
          console.error("Groq API error response:", data);
        } catch (err) {
          console.error("Groq API fetch failed:", err);
        }

        // Fallback to Heuristic engine if Groq fails
        return new HeuristicAIProvider().generateResponse(request);
      },
    };
  }

  // 2. OpenAI (GPT-4o / GPT-4o-mini)
  if (providerType === "openai" && apiKey) {
    return {
      name: "OpenAI Coach",
      generateResponse: async (request: AIRequest): Promise<AIResponse> => {
        try {
          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: process.env.AI_MODEL || "gpt-4o-mini",
              messages: [
                { role: "system", content: `${SYSTEM_COACH_PROMPT}\n${formatAIContext(request.context)}` },
                ...request.messages,
              ],
              temperature: 0.7,
            }),
          });
          const data = await response.json();
          return {
            content: data.choices?.[0]?.message?.content || "Désolé, aucune réponse générée.",
            suggestedActions: ["Comment s'est passée ma semaine ?", "Analyser mon momentum", "Quelles habitudes améliorer ?"],
          };
        } catch {
          return new HeuristicAIProvider().generateResponse(request);
        }
      },
    };
  }

  // Default: Built-in Heuristic AI Coach (Free, 0 latency, 0 external API cost)
  return new HeuristicAIProvider();
}
