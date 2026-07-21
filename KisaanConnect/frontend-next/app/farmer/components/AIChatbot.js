'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import * as aiApi from '../../../lib/aiApi';

const SUGGESTIONS = [
  'Why are my tomato leaves turning yellow?',
  'Best time to plant onions?',
  'How to control pests on wheat naturally?',
];

export default function AIChatbot() {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Namaste! Ask me anything about farming - crops, pests, soil, water, or selling. You can ask in Hindi, Marathi, or English.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = useCallback(async (text) => {
    const question = (text != null ? text : input).trim();
    if (!question || loading) return;

    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    setInput('');
    setLoading(true);
    try {
      const res = await aiApi.askAssistant(question);
      setMessages((prev) => [...prev, { role: 'assistant', text: res.answer || 'Sorry, no answer.' }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div style={styles.wrap}>
      <h2 style={styles.title}>Ask the Farming Assistant</h2>

      <div style={styles.chatBox}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              ...styles.bubble,
              ...(m.role === 'user' ? styles.user : styles.assistant),
            }}
          >
            {m.text}
          </div>
        ))}
        {loading && <div style={{ ...styles.bubble, ...styles.assistant }}>Thinking...</div>}
        <div ref={endRef} />
      </div>

      <div style={styles.suggestions}>
        {SUGGESTIONS.map((s) => (
          <button key={s} style={styles.chip} onClick={() => send(s)} disabled={loading}>
            {s}
          </button>
        ))}
      </div>

      <div style={styles.inputRow}>
        <textarea
          style={styles.input}
          rows={2}
          value={input}
          placeholder="Type your farming question..."
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={loading}
        />
        <button style={styles.sendBtn} onClick={() => send()} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}

const styles = {
  wrap: { maxWidth: 700, margin: '0 auto' },
  title: { textAlign: 'center', color: '#2e7d32', marginBottom: 16 },
  chatBox: { border: '1px solid #ddd', borderRadius: 8, padding: 16, height: 360,
    overflowY: 'auto', background: '#fafafa', display: 'flex', flexDirection: 'column', gap: 10 },
  bubble: { padding: '10px 14px', borderRadius: 12, maxWidth: '80%', whiteSpace: 'pre-wrap', lineHeight: 1.4 },
  user: { alignSelf: 'flex-end', background: '#2e7d32', color: '#fff' },
  assistant: { alignSelf: 'flex-start', background: '#fff', border: '1px solid #e0e0e0', color: '#333' },
  suggestions: { display: 'flex', flexWrap: 'wrap', gap: 8, margin: '12px 0' },
  chip: { padding: '6px 12px', borderRadius: 16, border: '1px solid #2e7d32',
    background: '#fff', color: '#2e7d32', cursor: 'pointer', fontSize: 13 },
  inputRow: { display: 'flex', gap: 8 },
  input: { flex: 1, padding: 10, borderRadius: 8, border: '1px solid #ccc', resize: 'none', fontFamily: 'inherit', fontSize: 14 },
  sendBtn: { padding: '0 22px', borderRadius: 8, border: 'none', background: '#2e7d32',
    color: '#fff', cursor: 'pointer', fontWeight: 600 },
};
