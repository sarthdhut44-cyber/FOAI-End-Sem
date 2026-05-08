import { Bot, Loader2, MessageCircle, Send, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { askHuggingFace } from "../api";
import { CHAT_CACHE_KEY, loadJson, saveJson } from "../utils";

function localAnswer(question, context) {
  const q = question.toLowerCase();
  if (q.includes("iss") || q.includes("location") || q.includes("latitude") || q.includes("longitude")) {
    if (!context.iss?.current) return "I do not have ISS position data yet.";
    return `The ISS is at latitude ${context.iss.current.lat.toFixed(4)} and longitude ${context.iss.current.lon.toFixed(4)} near ${context.iss.place}. Its calculated speed is ${Math.round(context.iss.speed).toLocaleString()} km/h.`;
  }
  if (q.includes("speed")) {
    return `The current calculated ISS speed is ${Math.round(context.iss?.speed || 0).toLocaleString()} km/h, based on the latest two dashboard positions.`;
  }
  if (q.includes("astronaut") || q.includes("people") || q.includes("space")) {
    const names = context.astronauts.people.map((person) => person.name).join(", ");
    return `The dashboard currently shows ${context.astronauts.count} people in space${names ? `: ${names}` : "."}`;
  }
  if (q.includes("news") || q.includes("article") || q.includes("summary")) {
    const summaries = context.news.slice(0, 5).map((article) => `${article.title} (${article.source})`).join("; ");
    return `The dashboard has ${context.news.length} articles. Top stories: ${summaries || "no articles are loaded yet."}`;
  }
  return "I can only answer from the dashboard data: ISS position/speed, astronauts in space, and loaded news articles.";
}

export default function Chatbot({ context }) {
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(() =>
    loadJson(CHAT_CACHE_KEY, [
      {
        role: "assistant",
        content: "Ask me about the ISS, astronauts in space, or the news currently loaded on this dashboard."
      }
    ])
  );

  const dashboardContext = useMemo(() => context, [context]);

  async function sendMessage(event) {
    event.preventDefault();
    const content = input.trim();
    if (!content || typing) return;
    const nextMessages = [...messages, { role: "user", content }].slice(-30);
    setMessages(nextMessages);
    setInput("");
    setTyping(true);
    try {
      const hfAnswer = await askHuggingFace(nextMessages, dashboardContext);
      const reply = hfAnswer || localAnswer(content, dashboardContext);
      const updated = [...nextMessages, { role: "assistant", content: reply }].slice(-30);
      setMessages(updated);
      saveJson(CHAT_CACHE_KEY, updated);
    } catch {
      const updated = [...nextMessages, { role: "assistant", content: localAnswer(content, dashboardContext) }].slice(-30);
      setMessages(updated);
      saveJson(CHAT_CACHE_KEY, updated);
    } finally {
      setTyping(false);
    }
  }

  function clearChat() {
    const reset = [{ role: "assistant", content: "Chat cleared. I still only answer from the dashboard data." }];
    setMessages(reset);
    saveJson(CHAT_CACHE_KEY, reset);
  }

  return (
    <>
      <button className="chat-fab" onClick={() => setOpen((value) => !value)} aria-label="Open dashboard chatbot">
        {open ? <X /> : <MessageCircle />}
      </button>
      {open && (
        <aside className="chat-window">
          <header>
            <div>
              <Bot size={20} />
              <strong>Dashboard AI</strong>
            </div>
            <button onClick={clearChat} aria-label="Clear chat">
              <Trash2 size={18} />
            </button>
          </header>
          <div className="messages">
            {messages.map((message, index) => (
              <div className={`message ${message.role}`} key={`${message.role}-${index}`}>
                {message.content}
              </div>
            ))}
            {typing && (
              <div className="message assistant typing">
                <Loader2 size={16} className="spin" />
                Thinking from dashboard data...
              </div>
            )}
          </div>
          <form onSubmit={sendMessage}>
            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about ISS or news" />
            <button type="submit" aria-label="Send message">
              <Send size={18} />
            </button>
          </form>
        </aside>
      )}
    </>
  );
}
