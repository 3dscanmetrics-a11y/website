'use client';

import { useState } from 'react';
import { Bot, X, Send, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMsg })
      });
      const data = (await res.json()) as { text?: string; actionTaken?: boolean };
      
      setMessages(prev => [...prev, { role: 'assistant', content: data.text || 'Action completed.' }]);
      
      if (data.actionTaken) {
        // If the AI modified the database, refresh the current page to show the new data
        router.refresh();
      }
      } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error communicating with AI.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 right-4 md:bottom-6 md:right-6 p-4 bg-cyan-500 hover:bg-cyan-600 text-white rounded-full shadow-2xl transition-transform hover:scale-110 z-50 flex items-center justify-center"
        >
          <Bot className="w-6 h-6" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-20 left-3 right-3 md:left-auto md:bottom-6 md:right-6 md:w-96 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
          <div className="bg-gray-900 p-4 flex justify-between items-center">
            <div className="flex items-center text-white">
              <Bot className="w-5 h-5 mr-2 text-cyan-400" />
              <h3 className="font-semibold text-sm">CRM Assistant</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="h-[50dvh] max-h-96 p-4 overflow-y-auto bg-gray-50 flex flex-col space-y-4 text-sm">
            <div className="bg-cyan-50 border border-cyan-100 text-cyan-900 p-3 rounded-lg rounded-tl-none self-start max-w-[85%]">
              Hello Director. How can I assist you with the CRM today? Try asking me to log an expense or summarize our revenue.
            </div>
            {messages.map((m, i) => (
              <div key={i} className={`p-3 rounded-lg max-w-[85%] ${m.role === 'user' ? 'bg-gray-900 text-white rounded-tr-none self-end' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none self-start'}`}>
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="bg-white border border-gray-200 text-gray-500 p-3 rounded-lg rounded-tl-none self-start flex items-center">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Thinking...
              </div>
            )}
          </div>

          <div className="p-3 bg-white border-t border-gray-100 flex items-center">
            <input 
              type="text" 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Command the AI..."
              className="flex-1 px-3 py-3 md:py-2 text-base md:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            <button onClick={handleSend} disabled={loading} className="ml-2 p-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
