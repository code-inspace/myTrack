"use client";

import React, { useState } from "react";
import { SendHorizontal, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  isLoading: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading,
}) => {
  const [text, setText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isLoading) return;
    onSendMessage(text.trim());
    setText("");
  };

  return (
    <form onSubmit={handleSubmit} className="w-full relative mt-2">
      <div className="relative flex items-center">
        <input
          type="text"
          placeholder="Pose une question à ton coach MyTrack..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isLoading}
          className="w-full pl-4 pr-12 py-3.5 rounded-2xl bg-[#1C1D22] border border-[#282A30] focus:border-[#D4F63D] focus:ring-1 focus:ring-[#D4F63D] text-white text-sm outline-none transition-all placeholder-[#6B7280]"
        />

        <button
          type="submit"
          disabled={!text.trim() || isLoading}
          className={cn(
            "absolute right-2 p-2.5 rounded-xl transition-all flex items-center justify-center cursor-pointer",
            text.trim() && !isLoading
              ? "bg-[#D4F63D] text-black shadow-md active:scale-95"
              : "bg-[#252830] text-[#6B7280] opacity-60 cursor-not-allowed"
          )}
        >
          <SendHorizontal className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
};
