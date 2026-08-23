export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  content: string;
  timestamp: string;
  suggestedActions?: string[];
}

export interface QuickSuggestion {
  id: string;
  label: string;
  query: string;
}
