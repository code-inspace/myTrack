"use client";

import { useState, useEffect } from "react";
import { ChatMessage } from "./types";
import {
  fetchDbChatMessages,
  getStoredChatMessages,
  saveStoredChatMessages,
  processUserMessage,
  DEFAULT_INITIAL_MESSAGES,
} from "./actions";
import { useAuth } from "@/providers/AuthProvider";

export function useChat() {
  const { user } = useAuth();
  const userId = user?.id || "00000000-0000-0000-0000-000000000001";

  const [messages, setMessages] = useState<ChatMessage[]>(() => getStoredChatMessages(userId));
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchDbChatMessages(userId).then(setMessages);
  }, [userId]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: "msg-user-" + Date.now(),
      sender: "user",
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    saveStoredChatMessages(newMessages, userId);
    setIsLoading(true);

    try {
      const assistantMsg = await processUserMessage(text.trim(), userId);
      const updatedMessages = [...newMessages, assistantMsg];
      setMessages(updatedMessages);
      saveStoredChatMessages(updatedMessages, userId);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: "msg-err-" + Date.now(),
        sender: "assistant",
        content: "Désolé, une erreur est survenue lors de l'analyse de tes données. Réessaie dans un instant.",
        timestamp: new Date().toISOString(),
      };
      const updatedMessages = [...newMessages, errorMsg];
      setMessages(updatedMessages);
      saveStoredChatMessages(updatedMessages, userId);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages(DEFAULT_INITIAL_MESSAGES);
    saveStoredChatMessages(DEFAULT_INITIAL_MESSAGES, userId);
  };

  return {
    messages,
    isLoading,
    sendMessage,
    clearChat,
  };
}
