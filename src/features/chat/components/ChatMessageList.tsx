"use client";

import React, { useRef, useEffect } from "react";
import { ChatMessage } from "../types";
import { Bot, User, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSelectSuggestion?: (text: string) => void;
}

export const ChatMessageList: React.FC<ChatMessageListProps> = ({
  messages,
  isLoading,
  onSelectSuggestion,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto space-y-4 py-4 px-1">
      {messages.map((msg) => {
        const isUser = msg.sender === "user";
        return (
          <div
            key={msg.id}
            className={cn(
              "flex items-start gap-3 text-sm",
              isUser ? "flex-row-reverse" : "flex-row"
            )}
          >
            {/* Avatar icon */}
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold",
                isUser
                  ? "bg-[#282A30] text-white"
                  : "bg-[#D4F63D] text-[#111214] lime-glow-sm"
              )}
            >
              {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 stroke-[2.5]" />}
            </div>

            {/* Bubble */}
            <div className="flex flex-col max-w-[82%]">
              <div
                className={cn(
                  "p-4 rounded-3xl whitespace-pre-wrap leading-relaxed shadow-sm",
                  isUser
                    ? "bg-[#252830] text-white rounded-tr-sm border border-[#343740]"
                    : "bg-[#1C1D22] text-[#E5E7EB] rounded-tl-sm border border-[#282A30]"
                )}
              >
                {msg.content}
              </div>

              {/* Dynamic suggestion chips under assistant message */}
              {!isUser && msg.suggestedActions && msg.suggestedActions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {msg.suggestedActions.map((sugg, idx) => (
                    <button
                      key={idx}
                      onClick={() => onSelectSuggestion?.(sugg)}
                      className="text-xs bg-[#252830] hover:bg-[#343740] text-[#D4F63D] px-3 py-1 rounded-full border border-[#3a3e4c] transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      {sugg}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Typing indicator */}
      {isLoading && (
        <div className="flex items-center gap-3 text-sm">
          <div className="w-8 h-8 rounded-full bg-[#D4F63D] text-black flex items-center justify-center">
            <Bot className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div className="bg-[#1C1D22] border border-[#282A30] px-4 py-3 rounded-2xl flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#D4F63D] animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-2 h-2 rounded-full bg-[#D4F63D] animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-2 h-2 rounded-full bg-[#D4F63D] animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
