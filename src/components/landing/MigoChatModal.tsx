'use client';

import { useState } from 'react';
import { X, Send, Sparkles, RefreshCw } from 'lucide-react';

interface MigoChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  id: string;
  sender: 'migo' | 'user';
  text: string;
  timestamp: string;
}

export default function MigoChatModal({ isOpen, onClose }: MigoChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'migo',
      text: "Hi there! I'm Migo 🖐️, your smart student safety assistant powered by Savi Intelligence. How can I help you today?",
      timestamp: 'Just now',
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [typing, setTyping] = useState(false);

  if (!isOpen) return null;

  const quickQuestions = [
    "How does live ride tracking work?",
    "What is gate facial verification?",
    "How do schools get started?",
    "How does cashless payment work?",
  ];

  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend || inputValue;
    if (!text.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputValue('');
    setTyping(true);

    // Simulate AI response logic
    setTimeout(() => {
      let botAnswer = "MyEduRide is designed to give parents complete peace of mind and provide schools with effortless transport and gate management!";
      
      const lower = text.toLowerCase();
      if (lower.includes('tracking') || lower.includes('live')) {
        botAnswer = "Real-time tracking uses high-precision GPS on verified school buses and pickup escorts. Parents receive live map updates, estimated arrival times, and instant notifications when their child boards or exits.";
      } else if (lower.includes('gate') || lower.includes('facial') || lower.includes('verification')) {
        botAnswer = "Our Gate Manager system uses advanced AI facial recognition and QR code identity passes to verify authorized guardians at pickup, preventing unauthorized student drop-offs or dismissals.";
      } else if (lower.includes('school') || lower.includes('start') || lower.includes('register')) {
        botAnswer = "Schools can onboard within 24 hours! Simply click 'Get Started' or 'Book a Demo' above. Our team sets up student rosters, driver passes, and gate terminals seamlessly.";
      } else if (lower.includes('cashless') || lower.includes('payment') || lower.includes('wallet')) {
        botAnswer = "MyEduRide includes a secure in-app wallet where parents can pay transport subscriptions, manage ride bookings, and view itemized mobility payment histories cleanly.";
      }

      const migoMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'migo',
        text: botAnswer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, migoMsg]);
      setTyping(false);
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-navy-950/60 backdrop-blur-sm animate-in fade-in">
      
      {/* Sliding Drawer Container */}
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-slate-200">
          
          {/* Drawer Header */}
          <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-navy-800 text-white p-5 flex items-center justify-between border-b border-navy-700">
            <div className="flex items-center gap-3">
              <div className="relative w-11 h-11 rounded-2xl bg-white p-0.5 shadow-md flex items-center justify-center border-2 border-emerald-400">
                <img
                  src="/images/landing/migo_robot.png"
                  alt="Migo Robot Avatar"
                  className="w-full h-full object-contain"
                />
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-brand-yellow rounded-full border-2 border-navy-900" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-base font-extrabold font-poppins text-white">Migo AI Assistant</h3>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                    ONLINE
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Powered by Savi Intelligence
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Preset Quick Questions Header */}
          <div className="bg-emerald-50/70 p-3.5 border-b border-emerald-100">
            <span className="block text-[10px] font-extrabold uppercase tracking-wider text-brand-green mb-2">
              Suggested Questions
            </span>
            <div className="flex flex-wrap gap-1.5">
              {quickQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(q)}
                  className="text-left text-[11px] font-semibold bg-white hover:bg-emerald-100/60 text-navy-900 border border-emerald-200/80 px-2.5 py-1 rounded-lg transition-colors"
                >
                  💬 {q}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Messages Log */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'migo' && (
                  <div className="w-8 h-8 rounded-xl bg-white p-0.5 border border-slate-200 shadow-sm flex-shrink-0 mt-0.5">
                    <img
                      src="/images/landing/migo_robot.png"
                      alt="Migo"
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
                <div
                  className={`max-w-[82%] p-3.5 rounded-2xl text-xs font-medium leading-relaxed shadow-sm ${
                    msg.sender === 'user'
                      ? 'bg-brand-green text-white rounded-br-none'
                      : 'bg-white text-navy-900 border border-slate-200/90 rounded-bl-none'
                  }`}
                >
                  {msg.text}
                  <div
                    className={`text-[9px] mt-1 text-right font-semibold ${
                      msg.sender === 'user' ? 'text-emerald-100' : 'text-slate-400'
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            ))}

            {typing && (
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 italic p-2 bg-white rounded-xl border border-slate-200 w-fit">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-green" />
                Migo is thinking...
              </div>
            )}
          </div>

          {/* Input Box Bar */}
          <div className="p-3.5 bg-white border-t border-slate-200">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Ask Migo anything about MyEduRide..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green outline-none"
              />
              <button
                type="submit"
                className="p-2.5 rounded-xl bg-brand-green hover:bg-brand-green-dark text-white font-bold transition-all shadow-md"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>

        </div>
      </div>

    </div>
  );
}
