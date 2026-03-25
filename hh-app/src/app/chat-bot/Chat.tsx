"use client";

import { useState } from "react";
import { AIMessage, UserMessage, MessageBar, ChatScroller, RefreshButton } from "@/app/chat-bot";
import { Card } from "../components/card";

interface ChatMessage {
  id: number;
  sender: "user" | "ai";
  text: string;
}

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Simulate AI response
  const sendMessage = () => {
    if (!input.trim() || isLoading) return;

    const newUserMessage: ChatMessage = {
      id: Date.now(),
      sender: "user",
      text: input.trim(),
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setInput("");
    setIsLoading(true); // 🔹 disable message bar

    // Simulate AI reply after delay
    setTimeout(() => {
      const aiReply: ChatMessage = {
        id: Date.now() + 1,
        sender: "ai",
        text: generateAIResponse(newUserMessage.text),
      };
      setMessages((prev) => [...prev, aiReply]);
      setIsLoading(false); // 🔹 re-enable after AI reply
    }, 800);
  };

  const generateAIResponse = (text: string) => {
    // Replace this with a real API call later (e.g., OpenAI, LangChain)
    return `You said: "${text}". I'm an AI, how can I help further?`;
  };

  const handleRefresh = () => {
    setMessages([]);
    setIsLoading(false);
  };

  return (
    <Card>
      <div className="relative text-right">
      <RefreshButton onClick={handleRefresh} />

      <ChatScroller>
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-8 text-sm">
            Start chatting with our AI below 💬
          </div>
        )}

        {messages.map((msg) =>
          msg.sender === "user" ? (
            <UserMessage key={msg.id} text={msg.text} />
          ) : (
            <AIMessage key={msg.id} text={msg.text} />
          )
        )}
      </ChatScroller>

      <div className="p-3 border-t">
        <MessageBar
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onSend={sendMessage}
        />
      </div>
      </div>
    </Card>
  );
}
