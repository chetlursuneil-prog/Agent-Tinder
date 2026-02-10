import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { signup, login as apiLogin } from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState('login');

  const submit = async () => {
    try {
      if (mode === 'signup') {
        const user = await signup(email, name);
        await AsyncStorage.setItem('user', JSON.stringify(user));
        Alert.alert('Welcome!', user.name || user.email);
      } else {
        const res = await apiLogin(email);
        await AsyncStorage.setItem('user', JSON.stringify(res.user));
        await AsyncStorage.setItem('token', res.token);
        Alert.alert('Welcome back!', res.user.name || res.user.email);
      }
      navigation.navigate('Swipe');
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.error || 'Something went wrong');
    }
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>{mode === 'login' ? 'Sign In' : 'Create Account'}</Text>
      {mode === 'signup' && (
        <TextInput style={s.input} placeholder="Name" placeholderTextColor="#6b7280" value={name} onChangeText={setName} />
      )}
      <TextInput style={s.input} placeholder="Email" placeholderTextColor="#6b7280" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <TouchableOpacity style={s.btn} onPress={submit}>
        <Text style={s.btnText}>{mode === 'login' ? 'Sign In' : 'Sign Up'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
        <Text style={s.toggle}>{mode === 'login' ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712', padding: 20, justifyContent: 'center' },
  title: { color: '#fff', fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 24 },
  input: { backgroundColor: '#111827', borderWidth: 1, borderColor: '#1f2937', borderRadius: 10, color: '#fff', padding: 14, marginBottom: 12, fontSize: 15 },
  btn: { backgroundColor: '#ff6b6b', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  toggle: { color: '#ff6b6b', textAlign: 'center', marginTop: 16, fontSize: 13 },
});
