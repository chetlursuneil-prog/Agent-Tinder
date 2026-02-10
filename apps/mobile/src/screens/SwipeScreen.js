import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { getProfiles, createMatch } from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEMO = [
  { id: 'demo1', skills: ['Python', 'ML'], about: 'AI researcher specializing in NLP.', price: 120 },
  { id: 'demo2', skills: ['React', 'Node.js'], about: 'Full-stack SaaS developer.', price: 95 },
  { id: 'demo3', skills: ['Solidity', 'Rust'], about: 'Smart contract auditor.', price: 200 },
  { id: 'demo4', skills: ['Design', 'UX'], about: 'Product designer for dev tools.', price: 85 },
];

export default function SwipeScreen() {
  const [profiles, setProfiles] = useState([]);
  const [idx, setIdx] = useState(0);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    getProfiles().then(d => setProfiles(d.length ? d : DEMO)).catch(() => setProfiles(DEMO));
  }, []);

  const current = profiles[idx];

  const swipe = async (dir) => {
    if (!current) return;
    if (dir === 'right') {
      try {
        const raw = await AsyncStorage.getItem('user');
        const u = raw ? JSON.parse(raw) : {};
        const data = await createMatch(u.id || 'anon', current.id);
        if (data && data.id) setMsg("💚 It's a match!");
        else if (data && data.liked) setMsg('💚 Liked! Waiting for mutual match.');
        else setMsg('💚 Liked!');
      } catch { setMsg('💚 Liked!'); }
    } else {
      setMsg('👎 Passed');
    }
    setTimeout(() => { setMsg(''); setIdx(i => i + 1); }, 500);
  };

  if (!current) {
    return (
      <View style={s.center}>
        <Text style={s.empty}>No more agents!</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.card}>
        <View style={s.tags}>
          {(current.skills || []).map(sk => (
            <Text key={sk} style={s.tag}>{sk}</Text>
          ))}
        </View>
        <Text style={s.about}>{current.about}</Text>
        {current.price && <Text style={s.price}>${current.price}/hr</Text>}
      </View>
      {msg ? <Text style={s.msg}>{msg}</Text> : null}
      <View style={s.buttons}>
        <TouchableOpacity style={[s.btn, s.btnNo]} onPress={() => swipe('left')}>
          <Text style={s.btnNoText}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, s.btnYes]} onPress={() => swipe('right')}>
          <Text style={s.btnYesText}>♥</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.counter}>{idx + 1} / {profiles.length}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712', alignItems: 'center', paddingTop: 30 },
  center: { flex: 1, backgroundColor: '#030712', justifyContent: 'center', alignItems: 'center' },
  empty: { color: '#6b7280', fontSize: 18 },
  card: { backgroundColor: '#111827', borderRadius: 16, padding: 24, margin: 16, width: '88%', borderWidth: 1, borderColor: '#1f2937' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  tag: { backgroundColor: 'rgba(255,107,107,0.15)', color: '#ff6b6b', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, fontSize: 12, fontWeight: '600', overflow: 'hidden' },
  about: { color: '#d1d5db', fontSize: 16, marginBottom: 8 },
  price: { color: '#6b7280', fontSize: 13 },
  msg: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 10 },
  buttons: { flexDirection: 'row', gap: 32, marginTop: 24 },
  btn: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', borderWidth: 2 },
  btnNo: { borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)' },
  btnYes: { borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)' },
  btnNoText: { color: '#ef4444', fontSize: 24 },
  btnYesText: { color: '#22c55e', fontSize: 24 },
  counter: { color: '#374151', marginTop: 16, fontSize: 13 },
});
