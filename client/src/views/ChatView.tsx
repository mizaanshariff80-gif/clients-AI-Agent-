import { useState, useRef, useEffect } from "react";
import type { Agent, ChatMessage } from "../types";
import { AGENT_DEFS } from "../store/appStore";
import { useVoice } from "../hooks/useVoice";

interface Props {
  agents: Agent[];
  activeAgentId: string;
  chatMessages: Record<string, ChatMessage[]>;
  onSendMessage: (content: string, agentId: string) => void;
  onSelectAgent: (id: string) => void;
  onClose: () => void;
}

function AgentTab({ agent, active, onClick }: { agent: Agent; active: boolean; onClick: () => void }) {
  const def = AGENT_DEFS.find(d => d.id === agent.id);
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 border-b-2 transition-colors whitespace-nowrap ${
        active ? "border-indigo-500 text-white" : "border-transparent text-slate-500 hover:text-slate-300"
      }`}
    >
      <div
        className="w-6 h-6 rounded flex items-center justify-center text-xs flex-shrink-0"
        style={{ backgroundColor: `${agent.color}25`, border: `1px solid ${agent.color}40` }}
      >
        {def?.icon}
      </div>
      <div className="text-left">
        <div className="text-xs font-medium">{agent.name}</div>
        <div className="text-[8px] text-slate-600 uppercase tracking-wider">{agent.role}</div>
      </div>
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
        agent.status === "working" ? "status-dot-working working-pulse" :
        agent.status === "waiting" ? "status-dot-waiting" : "status-dot-idle"
      }`} />
    </button>
  );
}

function MessageBubble({ msg, agentColor }: { msg: ChatMessage; agentColor: string }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3 animate-slide-in`}>
      {!isUser && (
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs mr-2 flex-shrink-0 mt-0.5"
          style={{ backgroundColor: `${agentColor}20`, border: `1px solid ${agentColor}40` }}
        >
          🤖
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-indigo-600/30 border border-indigo-500/30 text-white"
            : "bg-navy-600 border border-white/8 text-slate-200"
        }`}
        style={!isUser ? { borderColor: `${agentColor}15` } : {}}
      >
        <div className="whitespace-pre-wrap">{msg.content}</div>
        <div className="text-[9px] mt-2 opacity-40 font-mono">
          {new Date(msg.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}

function VoiceWaveform({ active, color }: { active: boolean; color: string }) {
  return (
    <div className="flex items-end gap-[3px] h-5">
      {[3, 6, 9, 7, 11, 8, 5, 10, 6, 4].map((h, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full transition-all"
          style={{
            height: active ? h * 2 : 4,
            backgroundColor: active ? color : "#374151",
            animation: active ? `working-pulse ${0.4 + i * 0.07}s ease-in-out infinite alternate` : "none",
            animationDelay: `${i * 0.05}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function ChatView({ agents, activeAgentId, chatMessages, onSendMessage, onSelectAgent, onClose }: Props) {
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prevMsgCountRef = useRef(0);

  const activeAgent = agents.find(a => a.id === activeAgentId);
  const messages = chatMessages[activeAgentId] || [];
  const agentColor = activeAgent?.color || "#8b5cf6";
  const def = AGENT_DEFS.find(d => d.id === activeAgentId);

  const { isListening, isSpeaking, voiceEnabled, setVoiceEnabled, transcript, startListening, stopListening, speak, stopSpeaking, isSupported } =
    useVoice({ agentId: activeAgentId });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setIsTyping(activeAgent?.status === "working");
  }, [activeAgent?.status]);

  // Auto-speak new agent messages
  useEffect(() => {
    if (!voiceEnabled) return;
    const count = messages.length;
    if (count > prevMsgCountRef.current) {
      const newest = messages[count - 1];
      if (newest?.role === "assistant") speak(newest.content);
    }
    prevMsgCountRef.current = count;
  }, [messages, voiceEnabled, speak]);

  // Put live transcript into input while listening
  useEffect(() => {
    if (transcript) setInput(transcript);
  }, [transcript]);

  function handleSend() {
    const content = input.trim();
    if (!content) return;
    setInput("");
    onSendMessage(content, activeAgentId);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleMic() {
    if (isListening) {
      stopListening();
    } else {
      startListening((text) => {
        setInput(text);
        // Auto-send after voice input
        if (text.trim()) {
          setTimeout(() => {
            setInput("");
            onSendMessage(text.trim(), activeAgentId);
          }, 300);
        }
      });
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-navy-800">
      {/* Agent Tabs */}
      <div className="flex items-center border-b border-white/5 overflow-x-auto flex-shrink-0 px-3 bg-navy-700">
        {agents.map(agent => (
          <AgentTab key={agent.id} agent={agent} active={agent.id === activeAgentId} onClick={() => onSelectAgent(agent.id)} />
        ))}
        <div className="ml-auto flex items-center gap-2 px-2">
          {/* Voice toggle */}
          {isSupported && (
            <button
              onClick={() => { setVoiceEnabled(v => !v); stopSpeaking(); }}
              title={voiceEnabled ? "Voice on — click to mute" : "Voice off — click to enable"}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono transition-colors ${
                voiceEnabled ? "text-indigo-400 bg-indigo-500/10" : "text-slate-600 hover:text-slate-400"
              }`}
            >
              {voiceEnabled ? "🔊" : "🔇"} {voiceEnabled ? "Voice On" : "Voice Off"}
            </button>
          )}
          <button onClick={onClose} className="px-3 py-2 text-slate-500 hover:text-slate-300 transition-colors text-lg" title="Close chat">×</button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-6">
              <div className="orb-container">
                <div className="orb-ring orb-ring-1" />
                <div className="orb-ring orb-ring-2" />
                <div className="orb-core" />
                <div className="absolute bottom-[-12px] flex items-end gap-0.5">
                  {[3, 5, 4, 6, 4, 5, 3].map((h, i) => (
                    <div key={i} className="w-0.5 rounded-full bg-indigo-400/60" style={{ height: h * 2 }} />
                  ))}
                </div>
              </div>
              <div>
                <h2 className="text-white text-xl font-semibold text-center mb-1">
                  Talk to the {activeAgent?.name || "Agent"}
                </h2>
                <p className="text-slate-500 text-sm text-center">
                  {activeAgentId === "ceo"
                    ? "Send a command and the CEO will route tasks to the entire team."
                    : `Direct message to ${activeAgent?.name} — ${activeAgent?.role}`}
                </p>
                {isSupported && (
                  <p className="text-slate-600 text-xs text-center mt-2">
                    🎤 Click the mic to speak · 🔊 Agent replies are read aloud
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div>
              <div className="text-center mb-6">
                <div
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs"
                  style={{ backgroundColor: `${agentColor}15`, border: `1px solid ${agentColor}25` }}
                >
                  <span style={{ color: agentColor }}>{def?.icon}</span>
                  <span style={{ color: agentColor }}>{activeAgent?.name}</span>
                  <span className="text-slate-600">#{activeAgentId}-channel · {activeAgent?.role}</span>
                </div>
              </div>
              {messages.map(msg => (
                <MessageBubble key={msg.id} msg={msg} agentColor={agentColor} />
              ))}
              {isTyping && (
                <div className="flex items-center gap-2 text-slate-500 text-xs mb-3 animate-fade-in">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs" style={{ backgroundColor: `${agentColor}20` }}>
                    {def?.icon}
                  </div>
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-500 working-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                    ))}
                  </div>
                  <span className="text-[10px]">{activeAgent?.name} is thinking...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Speaking indicator */}
        {isSpeaking && (
          <div className="flex items-center justify-center gap-3 py-2 border-t border-white/5 bg-navy-700/50">
            <VoiceWaveform active={true} color={agentColor} />
            <span className="text-[10px] text-slate-400 font-mono" style={{ color: agentColor }}>
              {activeAgent?.name} speaking...
            </span>
            <button onClick={stopSpeaking} className="text-[10px] text-slate-600 hover:text-slate-400 underline">stop</button>
          </div>
        )}

        {/* Input */}
        <div className="px-8 pb-6 pt-3 flex-shrink-0">
          {/* Listening status */}
          {isListening && (
            <div className="flex items-center justify-center gap-3 mb-3 py-2 px-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="w-2 h-2 rounded-full bg-red-400 working-pulse" />
              <VoiceWaveform active={true} color="#f87171" />
              <span className="text-xs text-red-400 font-mono">Listening… speak now</span>
            </div>
          )}

          <div className="flex items-end gap-3 bg-navy-600 border border-white/10 rounded-xl px-4 py-3 focus-within:border-indigo-500/40 transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${activeAgent?.name || "Agent"}… Enter to send, Shift+Enter for newline`}
              rows={1}
              className="flex-1 bg-transparent text-slate-200 text-sm resize-none focus:outline-none placeholder-slate-600 min-h-[24px] max-h-32"
            />
            <div className="flex items-center gap-2 flex-shrink-0">
              {isSupported && (
                <button
                  onMouseDown={handleMic}
                  title={isListening ? "Stop listening" : "Hold to speak"}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                    isListening
                      ? "bg-red-500/20 border border-red-500/50 text-red-400 scale-110"
                      : "bg-navy-700 border border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20"
                  }`}
                >
                  {isListening ? (
                    <VoiceWaveform active={true} color="#f87171" />
                  ) : (
                    <span className="text-base">🎤</span>
                  )}
                </button>
              )}
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-30"
                style={{
                  backgroundColor: input.trim() ? `${agentColor}30` : undefined,
                  color: input.trim() ? agentColor : "#6b7280",
                  border: `1px solid ${input.trim() ? `${agentColor}50` : "transparent"}`
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
