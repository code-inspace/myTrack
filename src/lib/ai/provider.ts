import { AIProvider, AIRequest, AIResponse } from "./types";
import { SYSTEM_COACH_PROMPT, formatAIContext } from "./prompts";

/**
 * Built-in Intelligent Heuristic AI Coach
 * Analyzes live habit completion, streak, and momentum without requiring an external API key.
 */
export class HeuristicAIProvider implements AIProvider {
  name = "Tracky • Coach IA";

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
          content: `### 📊 Bilan de ta semaine

- 🔥 **Série active (Streak)** : **${context.currentStreak} jours** consécutifs *(ton record est de **${context.bestStreak} jours**)*.
- ⚡ **Momentum** : **${context.momentum}/100**.
- 🎯 **Taux de complétion** : **${context.completionRate}%** avec **${context.totalWins} victoires** validées.

${
  context.strugglingHabits.length > 0
    ? `> 💡 **Point d'attention** : Tu as rencontré des difficultés sur **${context.strugglingHabits.join(", ")}**. Planifie ces tâches plus tôt dans la journée pour protéger ta série.`
    : `> 🚀 **Excellente constance** ! Tu as validé l'ensemble de tes habitudes prévues cette semaine.`
}

### 🎯 Plan d'action pour demain :
Maintiens ton rythme sans surcharger ton planning. Valide ta première action dès le matin !`,
          suggestedActions: ["Analyser mon momentum", "Quelles habitudes améliorer ?", "Programme de demain"],
        };
      } else {
        return {
          content: `### 📊 Weekly Performance Breakdown

- 🔥 **Active Streak**: **${context.currentStreak} days** *(Your personal best is **${context.bestStreak} days**)*.
- ⚡ **Momentum Score**: **${context.momentum}/100**.
- 🎯 **Completion Rate**: **${context.completionRate}%** with **${context.totalWins} total wins**.

${
  context.strugglingHabits.length > 0
    ? `> 💡 **Key Takeaway**: You missed days with **${context.strugglingHabits.join(", ")}**. Lock in an earlier time slot.`
    : `> 🚀 **Incredible consistency** across all your scheduled actions!`
}

### 🎯 Action Plan:
Protect your streak tomorrow by completing your priority task first!`,
          suggestedActions: ["Why is my momentum going down?", "What should I focus on tomorrow?", "Analyze my habits"],
        };
      }
    }

    // 2. Momentum query
    if (lastUserMessage.includes("momentum") || lastUserMessage.includes("score")) {
      if (isFrench) {
        return {
          content: `### ⚡ Analyse de ton Momentum

Ton score actuel est de **${context.momentum}/100**.

- 📈 **Complétion** : **${context.completionRate}%**
- 🔥 **Streak actif** : **${context.currentStreak} jours**
- 🏆 **Victoires** : **${context.totalWins} actions**

${
  context.momentum >= 60
    ? `> 🚀 **Dynamique excellente (+10 pts)** : Tu as un rythme solide et régulier.`
    : `> ⚡ **Objectif** : Valide tes habitudes dès le matin pour faire grimper ton momentum au-dessus de **75/100**.`
}`,
          suggestedActions: ["Comment s'est passée ma semaine ?", "Quelles habitudes améliorer ?"],
        };
      } else {
        return {
          content: `### ⚡ Momentum Analysis

Your current momentum is **${context.momentum}/100**.

- 📈 **Completion**: **${context.completionRate}%**
- 🔥 **Active Streak**: **${context.currentStreak} days**
- 🏆 **Total Wins**: **${context.totalWins} actions**

${
  context.momentum >= 60
    ? `> 🚀 **Strong velocity**: You are maintaining great discipline.`
    : `> ⚡ **Target**: Complete your morning routine to push past **75/100**.`
}`,
          suggestedActions: ["How am I doing this week?", "What habits am I struggling with?"],
        };
      }
    }

    // Default response
    if (isFrench) {
      return {
        content: `### 🤖 Salut, je suis Tracky !

Je suis ton coach MyTrack. Avec **${context.totalWins} victoires**, un **streak de ${context.currentStreak} jours** et un **momentum de ${context.momentum}/100**, tu es sur une bonne dynamique.

> 💡 **Que souhaites-tu analyser ensemble ?**`,
        suggestedActions: ["Comment s'est passée ma semaine ?", "Pourquoi mon momentum change ?", "Quelles habitudes améliorer ?"],
      };
    } else {
      return {
        content: `### 🤖 Hi, I'm Tracky!

I'm your personal MyTrack coach. With **${context.totalWins} wins**, a **${context.currentStreak}-day streak**, and **${context.momentum}/100 momentum**, you are making steady progress.

> 💡 **What would you like to review together?**`,
        suggestedActions: ["How am I doing this week?", "What habits am I struggling with?", "Analyze my momentum"],
      };
    }
  }
}

const DEFAULT_GROQ_CHAT_MODEL = "openai/gpt-oss-120b";

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
          const callGroq = (model: string) =>
            fetch("https://api.groq.com/openai/v1/chat/completions", {
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
            }).then((res) => res.json());

          const configuredModel = process.env.AI_MODEL || DEFAULT_GROQ_CHAT_MODEL;
          let data = await callGroq(configuredModel);
          // Groq retires models regularly: a configured model that no longer exists falls back to
          // the default one instead of silently degrading to the heuristic engine.
          if (
            configuredModel !== DEFAULT_GROQ_CHAT_MODEL &&
            ["model_not_found", "model_decommissioned"].includes(data?.error?.code)
          ) {
            console.warn(`Groq model "${configuredModel}" unavailable, using ${DEFAULT_GROQ_CHAT_MODEL}`);
            data = await callGroq(DEFAULT_GROQ_CHAT_MODEL);
          }
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
