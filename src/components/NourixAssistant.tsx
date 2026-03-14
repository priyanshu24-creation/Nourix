import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Mic, Send, Bot } from 'lucide-react';
import Markdown from 'react-markdown';
import { chatWithNourix } from '../services/gemini';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'nourix';
}

const initialMessages: Message[] = [
  {
    id: '1',
    text: "Hey, I'm Nourix. I am here to listen, support you, and help you think through whatever is on your mind. How are you feeling right now?",
    sender: 'nourix',
  },
];

export default function NourixAssistant() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg: Message = { id: Date.now().toString(), text: trimmed, sender: 'user' };
    const history = messages.map((message) => ({
      role: message.sender === 'user' ? 'user' : 'assistant',
      content: message.text,
    }));

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    setErrorMessage('');

    try {
      const response = await chatWithNourix(trimmed, history);
      const nourixMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: response || "I'm sorry, I couldn't process that.",
        sender: 'nourix',
      };
      setMessages((prev) => [...prev, nourixMsg]);
    } catch (error) {
      console.error('Chat error:', error);
      const nextError =
        error instanceof Error ? error.message : 'Nourix is temporarily unavailable.';
      setErrorMessage(nextError);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: `I'm having trouble replying right now. ${nextError}`,
          sender: 'nourix',
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const toggleVoice = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Voice recognition not supported in this browser.');
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      void handleSend(transcript);
    };

    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  };

  return (
    <div className="flex h-[600px] flex-col overflow-hidden rounded-[32px] border border-black/5 bg-white shadow-sm">
      <div className="border-bottom flex items-center gap-3 border-black/5 bg-zinc-50 p-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
          <Bot size={24} />
        </div>
        <div>
          <h3 className="font-bold text-zinc-900">Nourix AI Assistant</h3>
          <p className="text-xs font-medium text-emerald-600">Online and ready to help</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-6">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl p-4 ${
                msg.sender === 'user'
                  ? 'rounded-tr-none bg-zinc-900 text-white'
                  : 'rounded-tl-none bg-zinc-100 text-zinc-800'
              }`}
            >
              <div className="prose prose-sm prose-zinc">
                <Markdown>{msg.text}</Markdown>
              </div>
            </div>
          </motion.div>
        ))}
        {isTyping ? (
          <div className="flex justify-start">
            <div className="flex gap-1 rounded-2xl rounded-tl-none bg-zinc-100 p-4">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:0.2s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:0.4s]" />
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-black/5 bg-zinc-50 p-4">
        {errorMessage ? (
          <p className="mb-3 text-sm font-medium text-red-500">{errorMessage}</p>
        ) : null}
        <div className="flex gap-2">
          <button
            onClick={toggleVoice}
            className={`rounded-xl p-3 transition-all ${
              isListening
                ? 'animate-pulse bg-red-500 text-white'
                : 'border border-black/5 bg-white text-zinc-500 hover:text-emerald-600'
            }`}
          >
            <Mic size={20} />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void handleSend(input);
              }
            }}
            placeholder="Ask Nourix anything..."
            className="flex-1 rounded-xl border border-black/5 bg-white px-4 py-2 outline-none transition-all focus:ring-1 focus:ring-emerald-500"
          />
          <button
            onClick={() => void handleSend(input)}
            className="rounded-xl bg-zinc-900 p-3 text-white transition-all hover:bg-zinc-800"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
