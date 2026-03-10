import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, Send, Bot, User, Volume2, VolumeX } from 'lucide-react';
import { chatWithNourix } from '../services/gemini';
import Markdown from 'react-markdown';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'nourix';
}

export default function NourixAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', text: "Hey! I'm Nourix, your best friend. I'm here to listen and help you through whatever's on your mind—whether it's stress, anxiety, or just a rough day. How are you really feeling right now?", sender: 'nourix' }
  ]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), text, sender: 'user' };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await chatWithNourix(text);
      const nourixMsg: Message = { id: (Date.now() + 1).toString(), text: response || "I'm sorry, I couldn't process that.", sender: 'nourix' };
      setMessages(prev => [...prev, nourixMsg]);
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsTyping(false);
    }
  };

  const toggleVoice = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert("Voice recognition not supported in this browser.");
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      handleSend(transcript);
    };

    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-[32px] border border-black/5 overflow-hidden shadow-sm">
      <div className="p-6 border-bottom border-black/5 flex items-center gap-3 bg-zinc-50">
        <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
          <Bot size={24} />
        </div>
        <div>
          <h3 className="font-bold text-zinc-900">Nourix AI Assistant</h3>
          <p className="text-xs text-emerald-600 font-medium">Online & Ready to help</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] p-4 rounded-2xl ${
              msg.sender === 'user' 
                ? 'bg-zinc-900 text-white rounded-tr-none' 
                : 'bg-zinc-100 text-zinc-800 rounded-tl-none'
            }`}>
              <div className="prose prose-sm prose-zinc dark:prose-invert">
                <Markdown>{msg.text}</Markdown>
              </div>
            </div>
          </motion.div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-zinc-100 p-4 rounded-2xl rounded-tl-none flex gap-1">
              <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-zinc-50 border-t border-black/5">
        <div className="flex gap-2">
          <button
            onClick={toggleVoice}
            className={`p-3 rounded-xl transition-all ${
              isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-zinc-500 hover:text-emerald-600 border border-black/5'
            }`}
          >
            <Mic size={20} />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend(input)}
            placeholder="Ask Nourix anything..."
            className="flex-1 bg-white border border-black/5 rounded-xl px-4 py-2 outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
          />
          <button
            onClick={() => handleSend(input)}
            className="p-3 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-all"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
