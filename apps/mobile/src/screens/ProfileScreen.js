import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { createProfile } from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ProfileScreen() {
  const [user, setUser] = useState(null);
  const [skills, setSkills] = useState('');
  const [about, setAbout] = useState('');
  const [price, setPrice] = useState('');

  useEffect(() => {
    AsyncStorage.getItem('user').then(raw => { if (raw) setUser(JSON.parse(raw)); });
  }, []);

  const save = async () => {
    if (!user) return Alert.alert('Please log in first');
    try {
      const arr = skills.split(',').map(s => s.trim()).filter(Boolean);
      await createProfile(user.id, arr, about, parseFloat(price) || null);
      Alert.alert('Profile saved!');
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed');
    }
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>Your Profile</Text>
      {!user && <Text style={s.muted}>Sign in from the Login tab first.</Text>}
      {user && (
        <>
          <Text style={s.label}>Signed in as {user.name || user.email}</Text>
          <TextInput style={s.input} placeholder="Skills (comma separated)" placeholderTextColor="#6b7280" value={skills} onChangeText={setSkills} />
          <TextInput style={[s.input, { height: 80 }]} placeholder="About you" placeholderTextColor="#6b7280" value={about} onChangeText={setAbout} multiline />
          <TextInput style={s.input} placeholder="Hourly rate ($)" placeholderTextColor="#6b7280" value={price} onChangeText={setPrice} keyboardType="numeric" />
          <TouchableOpacity style={s.btn} onPress={save}><Text style={s.btnText}>Save Profile</Text></TouchableOpacity>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712', padding: 20 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  label: { color: '#9ca3af', marginBottom: 12 },
  muted: { color: '#6b7280', marginTop: 30 },
  input: { backgroundColor: '#111827', borderWidth: 1, borderColor: '#1f2937', borderRadius: 10, color: '#fff', padding: 12, marginBottom: 12, fontSize: 15 },
  btn: { backgroundColor: '#ff6b6b', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
