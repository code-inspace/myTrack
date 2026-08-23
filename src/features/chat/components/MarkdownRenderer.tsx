"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className,
}) => {
  if (!content) return null;

  // Split by line and process blocks
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inList = false;
  let listItems: React.ReactNode[] = [];

  const flushList = () => {
    if (inList && listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="space-y-1.5 my-2 pl-2">
          {listItems}
        </ul>
      );
      inList = false;
      listItems = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Empty lines
    if (!trimmed) {
      flushList();
      elements.push(<div key={`space-${i}`} className="h-2" />);
      continue;
    }

    // 2. Headings (### or ## or #)
    if (trimmed.startsWith("### ")) {
      flushList();
      elements.push(
        <h3
          key={`h3-${i}`}
          className="text-sm font-extrabold text-[#D4F63D] tracking-tight mt-3 mb-1 flex items-center gap-1.5"
        >
          {renderInlineMarkdown(trimmed.replace(/^###\s+/, ""))}
        </h3>
      );
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushList();
      elements.push(
        <h2
          key={`h2-${i}`}
          className="text-base font-black text-white tracking-tight mt-3.5 mb-1.5 border-b border-[#282A30] pb-1"
        >
          {renderInlineMarkdown(trimmed.replace(/^##\s+/, ""))}
        </h2>
      );
      continue;
    }

    if (trimmed.startsWith("# ")) {
      flushList();
      elements.push(
        <h1
          key={`h1-${i}`}
          className="text-lg font-black text-white tracking-tight mt-4 mb-2"
        >
          {renderInlineMarkdown(trimmed.replace(/^#\s+/, ""))}
        </h1>
      );
      continue;
    }

    // 3. Blockquotes (> Quote)
    if (trimmed.startsWith("> ")) {
      flushList();
      elements.push(
        <blockquote
          key={`quote-${i}`}
          className="border-l-2 border-[#D4F63D] bg-[#141518] px-3.5 py-2 my-2 rounded-r-xl text-xs text-[#E5E7EB] italic shadow-sm"
        >
          {renderInlineMarkdown(trimmed.replace(/^>\s+/, ""))}
        </blockquote>
      );
      continue;
    }

    // 4. Bullet lists (- item or * item)
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      inList = true;
      const itemText = trimmed.replace(/^[-*]\s+/, "");
      listItems.push(
        <li key={`li-${i}`} className="flex items-start gap-2 text-xs leading-relaxed text-[#E5E7EB]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D4F63D] mt-1.5 flex-shrink-0" />
          <div className="flex-1">{renderInlineMarkdown(itemText)}</div>
        </li>
      );
      continue;
    }

    // 5. Normal paragraphs
    flushList();
    elements.push(
      <p key={`p-${i}`} className="text-xs leading-relaxed text-[#E5E7EB]">
        {renderInlineMarkdown(trimmed)}
      </p>
    );
  }

  flushList();

  return <div className={cn("space-y-1.5 select-text", className)}>{elements}</div>;
};

/**
 * Parses inline markdown: **bold**, *italic*, `code`
 */
function renderInlineMarkdown(text: string): React.ReactNode {
  // Regex to split by bold (**text**), inline code (`code`), and italic (*text*)
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);

  return tokens.map((token, index) => {
    // Bold: **text**
    if (token.startsWith("**") && token.endsWith("**") && token.length >= 4) {
      const boldText = token.slice(2, -2);
      return (
        <strong
          key={index}
          className="font-bold text-white tracking-tight bg-white/5 px-1 py-0.5 rounded"
        >
          {boldText}
        </strong>
      );
    }

    // Inline Code: `code`
    if (token.startsWith("`") && token.endsWith("`") && token.length >= 2) {
      const codeText = token.slice(1, -1);
      return (
        <code
          key={index}
          className="font-mono text-[11px] bg-[#141518] text-[#D4F63D] px-1.5 py-0.5 rounded border border-[#282A30]"
        >
          {codeText}
        </code>
      );
    }

    // Italic: *text*
    if (token.startsWith("*") && token.endsWith("*") && token.length >= 2) {
      const italicText = token.slice(1, -1);
      return (
        <em key={index} className="italic text-[#D1D5DB]">
          {italicText}
        </em>
      );
    }

    return token;
  });
}
