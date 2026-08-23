"use client";

import React from "react";
import { ChatMessageList } from "@/features/chat/components/ChatMessageList";
import { ChatInput } from "@/features/chat/components/ChatInput";
import { QuickSuggestions } from "@/features/chat/components/QuickSuggestions";
import { useChat } from "@/features/chat/hooks";
import { useDashboardStats } from "@/features/dashboard/hooks";
import { Bot, Sparkles, Trash2, Flame, TrendingUp } from "lucide-react";

export default function ChatPage() {
  const { messages, isLoading, sendMessage, clearChat } = useChat();
  const { data: stats } = useDashboardStats();

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-6rem)] max-h-[calc(100dvh-6rem)] pb-2">
      {/* AI Coach Header */}
      <header className="flex items-center justify-between py-2 border-b border-[#282A30] px-1 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#D4F63D] text-[#111214] flex items-center justify-center font-bold lime-glow-sm">
            <Bot className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-1.5">
              Coach IA MyTrack
              <span className="text-[10px] bg-[#D4F63D]/20 text-[#D4F63D] px-2 py-0.5 rounded-full font-bold">
                Online
              </span>
            </h1>
            <p className="text-[11px] text-[#8E929E]">
              Connaît tes données • {stats?.currentStreak ?? 4}j streak • {stats?.momentum ?? 64} momentum
            </p>
          </div>
        </div>

        <button
          onClick={clearChat}
          title="Clear chat"
          className="p-2 rounded-xl bg-[#1C1D22] hover:bg-[#252830] text-[#8E929E] hover:text-[#F87171] transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </header>

      {/* Messages Scroll Area */}
      <ChatMessageList
        messages={messages}
        isLoading={isLoading}
        onSelectSuggestion={(text) => sendMessage(text)}
      />

      {/* Bottom Area: Suggestions + Input */}
      <div className="flex-shrink-0 pt-2 border-t border-[#23242A]">
        <QuickSuggestions onSelectSuggestion={(text) => sendMessage(text)} />
        <ChatInput onSendMessage={sendMessage} isLoading={isLoading} />
      </div>
    </div>
  );
}
