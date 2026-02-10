import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { getMatches } from '../api';

export default function MatchesScreen() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMatches().then(setMatches).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const renderItem = ({ item }) => (
    <View style={s.row}>
      <View>
        <Text style={s.pair}>{item.a} ↔ {item.b}</Text>
        <Text style={s.date}>{item.created_at || 'just now'}</Text>
      </View>
      <TouchableOpacity style={s.msgBtn}>
        <Text style={s.msgText}>Message</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={s.container}>
      {loading && <Text style={s.muted}>Loading...</Text>}
      {!loading && matches.length === 0 && <Text style={s.muted}>No matches yet. Start swiping!</Text>}
      <FlatList data={matches} keyExtractor={i => i.id} renderItem={renderItem} />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712', padding: 16 },
  muted: { color: '#6b7280', textAlign: 'center', marginTop: 40, fontSize: 16 },
  row: { backgroundColor: '#111827', borderRadius: 12, padding: 16, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#1f2937' },
  pair: { color: '#fff', fontWeight: '600' },
  date: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  msgBtn: { backgroundColor: '#ff6b6b', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  msgText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
