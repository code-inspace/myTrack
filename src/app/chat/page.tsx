"use client";

import React from "react";
import { ChatMessageList } from "@/features/chat/components/ChatMessageList";
import { ChatInput } from "@/features/chat/components/ChatInput";
import { QuickSuggestions } from "@/features/chat/components/QuickSuggestions";
import { useChat } from "@/features/chat/hooks";
import { useDashboardStats } from "@/features/dashboard/hooks";
import { Bot, Sparkles, Trash2, Flame, TrendingUp, Trophy } from "lucide-react";

export default function ChatPage() {
  const { messages, isLoading, sendMessage, clearChat } = useChat();
  const { data: stats } = useDashboardStats();

  return (
    <div className="flex-1 flex flex-col xl:flex-row xl:gap-6 h-[calc(100vh-6rem)] max-h-[calc(100dvh-6rem)] md:h-screen md:max-h-screen pb-2 md:pb-6 w-full md:max-w-4xl xl:max-w-6xl md:mx-auto px-4 md:px-8 pt-2 md:pt-4">
      {/* Chat column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* AI Coach Header */}
        <header className="flex items-center justify-between py-3 md:py-4 border-b border-[#17181F] px-1 flex-shrink-0 select-none">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#D4F63D] text-[#111214] flex items-center justify-center font-bold lime-glow-sm shadow-md">
              <Bot className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-extrabold text-white flex items-center gap-2">
                <span>Tracky • Coach IA</span>
                <span className="text-[10px] bg-[#D4F63D]/20 text-[#D4F63D] px-2 py-0.5 rounded-full font-bold">
                  En ligne
                </span>
              </h1>
              <p className="text-xs text-[#8E929E]">
                Connaît tes données • {stats?.currentStreak ?? 0}j streak • {stats?.momentum ?? 64} momentum
              </p>
            </div>
          </div>

          <button
            onClick={clearChat}
            title="Effacer la discussion"
            className="p-2.5 rounded-xl bg-[#17181F] hover:bg-[#22242C] border border-[#282B36] text-[#8E929E] hover:text-[#F87171] transition-colors cursor-pointer"
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

      {/* Context panel — desktop only */}
      <aside className="hidden xl:flex xl:w-72 flex-shrink-0 flex-col gap-3 py-3">
        <div className="bg-[#1C1D22] border border-[#282A30] rounded-3xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-[#D4F63D]" />
            <h2 className="text-xs font-bold text-white">Contexte de Tracky</h2>
          </div>
          <p className="text-[11px] leading-relaxed text-[#8E929E]">
            Tracky voit tes habitudes, tes séries et ton momentum en temps réel. Pose-lui des
            questions concrètes sur ta progression ou demande-lui un plan d&apos;action.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div className="bg-[#1C1D22] border border-[#282A30] rounded-2xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F97316]/15 text-[#F97316] flex items-center justify-center flex-shrink-0">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <div className="text-base font-extrabold text-white leading-none">{stats?.currentStreak ?? 0}j</div>
              <div className="text-[10px] font-semibold text-[#8E929E] mt-1">Série actuelle</div>
            </div>
          </div>

          <div className="bg-[#1C1D22] border border-[#282A30] rounded-2xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#D4F63D]/15 text-[#D4F63D] flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <div className="text-base font-extrabold text-white leading-none">{stats?.momentum ?? 0}</div>
              <div className="text-[10px] font-semibold text-[#8E929E] mt-1">Momentum</div>
            </div>
          </div>

          <div className="bg-[#1C1D22] border border-[#282A30] rounded-2xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#EAB308]/15 text-[#EAB308] flex items-center justify-center flex-shrink-0">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <div className="text-base font-extrabold text-white leading-none">{stats?.bestStreak ?? 0}j</div>
              <div className="text-[10px] font-semibold text-[#8E929E] mt-1">Meilleure série</div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
