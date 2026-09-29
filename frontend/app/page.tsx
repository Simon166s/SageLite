"use client";

import { useState, useRef, useEffect } from "react";
import { marked } from "marked";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Thread {
  id: number;
  title: string;
}

export default function Home() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<number | null>(null);
  const [currentPersona, setCurrentPersona] = useState("general");
  const [currentLanguage, setCurrentLanguage] = useState("English");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isShuttingDown, setIsShuttingDown] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchThreads();
  }, []);

  const fetchThreads = async () => {
    try {
      const res = await fetch("http://localhost:8000/chat/threads");
      if (res.ok) {
        const data = await res.json();
        setThreads(data);
      }
    } catch (err) {
      console.error("Could not fetch threads");
    }
  };

  const loadThread = async (id: number) => {
    setCurrentThreadId(id);
    try {
      const res = await fetch(`http://localhost:8000/chat/threads/${id}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error("Could not load thread messages");
    }
  };

  const deleteThread = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this conversation?")) return;

    try {
      const res = await fetch(`http://localhost:8000/chat/threads/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        if (currentThreadId === id) {
          startNewChat();
        }
        fetchThreads();
      }
    } catch (err) {
      console.error("Failed to delete thread", err);
    }
  };

  const startNewChat = () => {
    setCurrentThreadId(null);
    setMessages([]);
  };

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const shutdownBackend = async () => {
    if (confirm("Are you sure you want to shut down the SageLite backend server?")) {
      try {
        setIsShuttingDown(true);
        await fetch("http://localhost:8000/shutdown", { method: "POST" });
      } catch (err) {
        // Expected on immediate process termination
      } finally {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "🛑 **Server Offline:** SageLite backend has been shut down successfully." }
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
      let activeId = currentThreadId;
      if (!activeId) {
        const titleSnippet = userQuestion.length > 28 ? userQuestion.substring(0, 28) + "..." : userQuestion;
        const threadRes = await fetch("http://localhost:8000/chat/threads/new", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: titleSnippet }),
        });

        if (threadRes.ok) {
          const threadData = await threadRes.json();
          activeId = threadData.id;
          setCurrentThreadId(activeId);
          fetchThreads();
        }
      }

      const response = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          question: userQuestion, 
          persona: currentPersona, 
          language: currentLanguage,
          thread_id: activeId 
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
        { role: "assistant", content: "⚠️ **Connection Error:** Could not reach the FastAPI server." },
      ]);
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-950 via-blue-950/30 to-slate-950 text-slate-100 h-screen flex overflow-hidden font-sans selection:bg-blue-600 selection:text-white">
      
      {/* LEFT SIDEBAR */}
      <aside className="w-72 bg-slate-900/80 backdrop-blur-xl border-r border-blue-950 flex flex-col justify-between hidden md:flex shadow-2xl z-20">
        <div className="p-5 flex flex-col h-full space-y-5 overflow-y-auto">
          
          <div className="flex items-center space-x-3 px-1">
            <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/25 ring-1 ring-white/20">
              S
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white">SageLite</span>
              <span className="block text-[10px] text-blue-400 font-medium tracking-widest uppercase">SQLite Persistent</span>
            </div>
          </div>

          <button 
            onClick={startNewChat} 
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium py-2.5 px-4 rounded-xl transition-all duration-200 shadow-lg shadow-blue-600/20 flex items-center justify-center space-x-2 group active:scale-[0.98]"
          >
            <svg className="w-4 h-4 transition-transform group-hover:rotate-90 duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/>
            </svg>
            <span className="text-sm">New Conversation</span>
          </button>

          <div className="flex-1">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">Chat History</div>
            <div className="space-y-1 overflow-y-auto max-h-56 pr-1">
              {threads.length === 0 ? (
                <div className="text-xs text-slate-500 px-1 py-2">No saved chats yet.</div>
              ) : (
                threads.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => loadThread(t.id)}
                    className={`group flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all cursor-pointer ${
                      currentThreadId === t.id 
                        ? "bg-blue-600/20 text-blue-300 border border-blue-500/30 font-medium" 
                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent"
                    }`}
                  >
                    <span className="truncate flex-1 pr-2">💬 {t.title}</span>
                    <button
                      onClick={(e) => deleteThread(e, t.id)}
                      title="Delete thread"
                      className="opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/10 p-1 rounded transition-all shrink-0"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">Output Language</div>
            <div className="grid grid-cols-2 gap-1.5">
              {["English", "French", "Spanish", "German"].map((lang) => {
                const isActive = currentLanguage === lang;
                return (
                  <button
                    key={lang}
                    onClick={() => setCurrentLanguage(lang)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all border ${
                      isActive 
                        ? "bg-blue-600 text-white border-blue-500 shadow-md" 
                        : "bg-slate-800/40 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border-slate-700/50"
                    }`}
                  >
                    {lang === "French" ? "Français 🇫🇷" : lang}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">AI Mode</div>
            <div className="space-y-1">
              {[
                { id: "general", label: "🌟 General" },
                { id: "programming", label: "💻 Senior Dev" },
                { id: "tutor", label: "🎓 Tutor" },
              ].map((p) => {
                const isActive = currentPersona === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setCurrentPersona(p.id)}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-between ${
                      isActive ? "bg-blue-600/15 text-white border border-blue-500/30" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    }`}
                  >
                    <span>{p.label}</span>
                    {isActive && <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 space-y-2 px-1">
            <button
              onClick={shutdownBackend}
              disabled={isShuttingDown}
              className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-red-300 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center space-x-2 cursor-pointer"
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
            SQLite Memory Active 🟢
          </div>
        </header>

        {/* CHAT CONTAINER */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          {messages.length === 0 ? (
            <div className="max-w-xl mx-auto text-center py-20 space-y-4 animate-fadeIn">
              <div className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl mx-auto flex items-center justify-center shadow-xl shadow-blue-600/20 text-white text-2xl font-bold ring-1 ring-white/20">
                💾
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">SageLite Memory Workspace</h1>
              <p className="text-slate-400 text-sm leading-relaxed">
                Your conversations are stored in SQLite. Select past conversations to continue or hover to delete them.
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
                <span className="text-xs text-slate-400 ml-2 font-medium">Streaming & persisting...</span>
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
                placeholder="Type a message to save to SQLite database..."
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
              <span>SageLite v1.0 • Explicit Thread Binding Active</span>
              <span>Press <kbd className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">Enter ↵</kbd> to send</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}