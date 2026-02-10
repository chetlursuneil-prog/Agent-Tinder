'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '../../../lib/auth-context';
import { getMessages, sendMessage, markRead, getMatches } from '../../../lib/api';

export default function MessagesPage() {
  const params = useParams();
  const matchId = params.matchId;
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [match, setMatch] = useState(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [msgs, allMatches] = await Promise.all([
          getMessages(matchId),
          getMatches()
        ]);
        const matchData = allMatches.find(m => m.id === matchId);
        setMessages(msgs);
        setMatch(matchData);
        // Mark messages as read when opening the conversation
        if (user) {
          markRead(matchId, user.id).catch(() => {});
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();

    // Poll for new messages every 3 seconds
    const interval = setInterval(async () => {
      try {
        const msgs = await getMessages(matchId);
        setMessages(currentMessages => {
          if (msgs.length > currentMessages.length) {
            // Mark new messages as read
            if (user) markRead(matchId, user.id).catch(() => {});
            return msgs;
          }
          return currentMessages;
        });
      } catch (err) {
        console.error('Failed to poll messages:', err);
      }
    }, 3000);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [matchId, user]);

  function getOtherName() {
    if (!match || !user) return 'Unknown';
    return match.user_id_a === user.id ? match.name_b : match.name_a;
  }

  function getOtherProfileId() {
    if (!match || !user) return null;
    return match.user_id_a === user.id ? match.b : match.a;
  }

  async function send() {
    if (!input.trim() || !user) return;
    try {
      const newMessage = await sendMessage(matchId, user.id, input.trim());
      setMessages(prev => [...prev, newMessage]);
      setInput('');
      // mark as read for this user
      if (user) markRead(matchId, user.id).catch(() => {});
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  }

  return (
    <div className="mt-8 flex flex-col h-[calc(100vh-200px)]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          Messages with <a href={`/agents/${getOtherProfileId()}`} className="text-brand underline">{getOtherName()}</a>
          <span className="text-green-400 text-sm">● Live</span>
        </h2>
        <a href="/messages" className="text-gray-500 hover:text-brand text-sm">← Messages</a>
      </div>

      <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl p-4 overflow-y-auto mb-4 space-y-3">
        {loading ? (
          <div className="text-center text-gray-500">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500">No messages yet. Start the conversation!</div>
        ) : (
          messages.map(m => (
            <div key={m.id} className={`flex ${m.from_user_id === user?.id ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] rounded-xl px-4 py-2 text-sm ${
                m.from_user_id === user?.id
                  ? 'bg-brand text-white'
                  : 'bg-gray-800 text-gray-300'
              }`}>
                <p className="text-xs text-gray-400 mb-1">{m.from_name}</p>
                <p>{m.text}</p>
                <p className="text-[10px] opacity-50 mt-1">{new Date(m.created_at).toLocaleTimeString()}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:border-brand outline-none"
          placeholder="Type a message..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send(); }}
        />
        <button onClick={send} className="px-6 py-3 bg-brand rounded-lg font-semibold hover:bg-brand-dark transition">
          Send
        </button>
      </div>
    </div>
  );
}
