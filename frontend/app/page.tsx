"use client";

import { useState, useRef, useEffect } from "react";
import { marked } from "marked";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function Home() {
  const [currentPersona, setCurrentPersona] = useState("general");
  const [currentLanguage, setCurrentLanguage] = useState("English");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isShuttingDown, setIsShuttingDown] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const clearChat = () => {
    setMessages([]);
  };

  const shutdownBackend = async () => {
    if (confirm("Are you sure you want to shut down the SageLite backend server?")) {
      try {
        setIsShuttingDown(true);
        await fetch("http://localhost:8000/shutdown", { method: "POST" });
      } catch (err) {
        // Expected since the server dies immediately
      } finally {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "🛑 **Server Offline:** SageLite backend has been shut down successfully. You can close this browser tab." }
        ]);
        setIsShuttingDown(false);
      }
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || isShuttingDown) return;

    const userQuestion = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userQuestion }]);
    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          question: userQuestion, 
          persona: currentPersona, 
          language: currentLanguage 
        }),
      });

      if (!response.ok) throw new Error("Failed to reach backend server.");

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      setIsLoading(false);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });

          setMessages((prev) => {
            const lastMsg = prev[prev.length - 1];
            const updatedMessages = [...prev];
            updatedMessages[updatedMessages.length - 1] = {
              ...lastMsg,
              content: lastMsg.content + chunk,
            };
            return updatedMessages;
          });
        }
      }
    } catch (error) {
      setIsLoading(false);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ **Connection Error:** Could not reach the FastAPI server. Ensure Uvicorn is running on port 8000." },
      ]);
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-950 via-blue-950/30 to-slate-950 text-slate-100 h-screen flex overflow-hidden font-sans selection:bg-blue-600 selection:text-white">
      
      {/* LEFT SIDEBAR */}
      <aside className="w-72 bg-slate-900/80 backdrop-blur-xl border-r border-blue-950 flex flex-col justify-between hidden md:flex shadow-2xl z-20">
        <div className="p-5 flex flex-col h-full space-y-6 overflow-y-auto">
          
          {/* Brand Header */}
          <div className="flex items-center space-x-3 px-1">
            <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/25 ring-1 ring-white/20">
              S
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white">SageLite</span>
              <span className="block text-[10px] text-blue-400 font-medium tracking-widest uppercase">AI Workspace</span>
            </div>
          </div>

          {/* New Conversation Button */}
          <button 
            onClick={clearChat} 
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium py-2.5 px-4 rounded-xl transition-all duration-200 shadow-lg shadow-blue-600/20 flex items-center justify-center space-x-2 group active:scale-[0.98]"
          >
            <svg className="w-4 h-4 transition-transform group-hover:rotate-90 duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>
            <span className="text-sm">New Conversation</span>
          </button>

          {/* Language Selection */}
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">Output Language</div>
            <div className="grid grid-cols-2 gap-1.5">
              {["English", "French", "Spanish", "German"].map((lang) => {
                const isActive = currentLanguage === lang;
                return (
                  <button
                    key={lang}
                    onClick={() => setCurrentLanguage(lang)}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all border ${
                      isActive 
                        ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-950" 
                        : "bg-slate-800/40 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border-slate-700/50"
                    }`}
                  >
                    {lang === "French" ? "Français 🇫🇷" : lang === "English" ? "English 🇬🇧" : lang}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Persona Selection */}
          <div className="flex-1">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">AI Intelligence Mode</div>
            <div className="space-y-1.5">
              {[
                { id: "general", label: "🌟 General Assistant" },
                { id: "programming", label: "💻 Senior Engineer" },
                { id: "tutor", label: "🎓 Socratic Tutor" },
              ].map((p) => {
                const isActive = currentPersona === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setCurrentPersona(p.id)}
                    className={`w-full text-left p-2.5 rounded-xl transition-all duration-200 flex items-center justify-between border ${
                      isActive 
                        ? "bg-blue-600/15 border-blue-500/40 text-white shadow-sm" 
                        : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border-transparent"
                    }`}
                  >
                    <span className="text-sm font-semibold">{p.label}</span>
                    {isActive && <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer Status & Shutdown Button */}
          <div className="pt-4 border-t border-slate-800/80 space-y-3 px-1">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isShuttingDown ? "bg-red-400" : "bg-emerald-400"} opacity-75`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${isShuttingDown ? "bg-red-500" : "bg-emerald-500"}`}></span>
                </span>
                <span className="font-medium text-slate-300">{isShuttingDown ? "Shutting down..." : "Llama 3.2 Live"}</span>
              </div>
            </div>

            <button
              onClick={shutdownBackend}
              disabled={isShuttingDown}
              className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-red-300 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-98"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a9 9 0 01-1.414-14.142m0 0l2.829 2.829m-2.829-2.829L3 3" />
              </svg>
              <span>Shutdown App</span>
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CHAT AREA */}
      <main className="flex-1 flex flex-col h-full bg-slate-950/60 relative">
        <header className="h-16 border-b border-blue-950/50 flex items-center justify-between px-6 bg-slate-900/40 backdrop-blur-md z-10">
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Mode:</span>
            <span className="text-sm font-bold text-blue-400 tracking-wide uppercase bg-blue-950/60 px-3 py-1 rounded-full border border-blue-800/30">
              {currentPersona} ({currentLanguage})
            </span>
          </div>
          <div className="text-xs text-blue-300/80 bg-blue-950/40 px-3 py-1 rounded-full border border-blue-900/30 font-medium">
            RAG Vector DB Active 🟢
          </div>
        </header>

        {/* CHAT CONTAINER */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          {messages.length === 0 ? (
            <div className="max-w-xl mx-auto text-center py-20 space-y-4 animate-fadeIn">
              <div className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl mx-auto flex items-center justify-center shadow-xl shadow-blue-600/20 text-white text-2xl font-bold ring-1 ring-white/20">
                🛑
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">SageLite Desktop Workspace</h1>
              <p className="text-slate-400 text-sm leading-relaxed">
                You can now safely shut down the backend server at any time using the red button in the bottom left sidebar.
              </p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div 
                key={index} 
                className={`flex items-start space-x-3 ${msg.role === "user" ? "justify-end space-x-reverse" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center font-bold text-xs text-white shadow-md ring-1 ring-white/25 shrink-0 mt-1">
                    AI
                  </div>
                )}
                
                <div
                  className={`max-w-2xl text-sm shadow-md transition-all ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl rounded-br-sm px-5 py-3.5 shadow-blue-600/10"
                      : "bg-slate-900/90 border border-blue-900/30 text-slate-100 rounded-2xl rounded-bl-sm px-5 py-4 prose prose-invert shadow-xl"
                  }`}
                  dangerouslySetInnerHTML={
                    msg.role === "assistant"
                      ? { __html: marked.parse(msg.content || "...") as string }
                      : undefined
                  }
                >
                  {msg.role === "user" ? msg.content : null}
                </div>

                {msg.role === "user" && (
                  <div className="w-8 h-8 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center font-bold text-xs text-slate-300 shrink-0 mt-1">
                    YOU
                  </div>
                )}
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center font-bold text-xs text-white shadow-md ring-1 ring-white/25 shrink-0">
                AI
              </div>
              <div className="bg-slate-900/90 border border-blue-900/30 text-slate-200 rounded-2xl rounded-bl-sm px-5 py-4 text-sm shadow-lg flex items-center space-x-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                <span className="text-xs text-slate-400 ml-2 font-medium">Streaming...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* INPUT BAR */}
        <div className="p-4 md:p-6 bg-slate-950/80 backdrop-blur-md border-t border-blue-950/50">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={sendMessage} className="relative flex items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                disabled={isShuttingDown}
                className="w-full bg-slate-900/90 border border-blue-950 focus:border-blue-500 text-slate-100 placeholder-slate-500 text-sm rounded-2xl px-5 py-4 pr-14 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-xl transition-all disabled:opacity-50"
                autoComplete="off"
              />
              <button 
                type="submit" 
                disabled={isLoading || !input.trim() || isShuttingDown}
                className="absolute right-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 text-white p-2.5 rounded-xl transition-all duration-200 shadow-md flex items-center justify-center cursor-pointer active:scale-95"
              >
                <svg className="w-4 h-4 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19V5m7 7l-7-7-7 7"/>
                </svg>
              </button>
            </form>
            <div className="flex items-center justify-between mt-2.5 px-2 text-[11px] text-slate-400 font-medium">
              <span>SageLite v1.0 • Shutdown Hook Enabled</span>
              <span>Press <kbd className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">Enter ↵</kbd> to send</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}