import React, { useState, useCallback, useEffect, useRef } from 'react';
import '../styles/Chatbot.css';

const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_CONTEXT = `You are KisaanConnect's helpful assistant for Indian farmers and consumers.
Help with: crop pricing, selling strategies, platform navigation, farming tips, and order queries.
Keep answers short, practical, and friendly. Use simple language.`;

const timestamp = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const INITIAL_MESSAGES = [
  { text: 'Hello! How can I help you today?', isBot: true, time: timestamp() }
];

const Chatbot = () => {
  const [isOpen,     setIsOpen]     = useState(false);
  const [messages,   setMessages]   = useState(INITIAL_MESSAGES);
  const [input,      setInput]      = useState('');
  const [isTyping,   setIsTyping]   = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') setIsOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

  const sendToGemini = useCallback(async (userText) => {
    if (!GEMINI_API_KEY) {
      return "API key not configured. Please contact support.";
    }
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: SYSTEM_CONTEXT },
            { text: `User: ${userText}` }
          ]
        }]
      })
    });

    if (!response.ok) throw new Error('API error');
    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text
      || "I'm sorry, I couldn't process that. Please try again.";
  }, []);

  const handleSend = useCallback(async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isTyping) return;

    setMessages(prev => [...prev, { text, isBot: false, time: timestamp() }]);
    setInput('');
    setIsTyping(true);

    try {
      const reply = await sendToGemini(text);
      setMessages(prev => [...prev, { text: reply, isBot: true, time: timestamp() }]);
    } catch {
      setMessages(prev => [...prev, {
        text: "Sorry, I'm having trouble connecting. Please try again.",
        isBot: true,
        time: timestamp()
      }]);
    } finally {
      setIsTyping(false);
    }
  }, [input, isTyping, sendToGemini]);

  return (
    <div className="chatbot-container">
      {isOpen && (
        <div className="chatbot-window" role="dialog" aria-label="KisaanConnect Support Chat">

          <div className="chatbot-header">
            <h3>KisaanConnect Support</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="close-button"
              aria-label="Close chat"
            >×</button>
          </div>

          <div className="messages-container">
            {messages.map((msg, i) => (
              <div key={i} className={`message ${msg.isBot ? 'bot' : 'user'}`}>
                <span className="message-text">{msg.text}</span>
                <span className="message-time">{msg.time}</span>
              </div>
            ))}
            {isTyping && (
              <div className="message bot typing" aria-live="polite">
                <span className="typing-indicator">
                  <span /><span /><span />
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSend} className="input-container">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Type your message..."
              className="message-input"
              disabled={isTyping}
              aria-label="Chat message input"
            />
            <button
              type="submit"
              className="send-button"
              disabled={!input.trim() || isTyping}
            >
              Send
            </button>
          </form>

        </div>
      )}

      <button
        className="chatbot-toggle"
        onClick={() => setIsOpen(prev => !prev)}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {isOpen ? '×' : '💬'}
      </button>
    </div>
  );
};

export default Chatbot;