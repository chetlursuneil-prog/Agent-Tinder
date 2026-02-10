import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import SwipeScreen from './src/screens/SwipeScreen';
import MatchesScreen from './src/screens/MatchesScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import LoginScreen from './src/screens/LoginScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#111827' },
          headerTintColor: '#fff',
          tabBarStyle: { backgroundColor: '#111827', borderTopColor: '#1f2937' },
          tabBarActiveTintColor: '#ff6b6b',
          tabBarInactiveTintColor: '#6b7280',
        }}
      >
        <Tab.Screen name="Swipe" component={SwipeScreen} options={{ tabBarLabel: '🔥 Swipe' }} />
        <Tab.Screen name="Matches" component={MatchesScreen} options={{ tabBarLabel: '💬 Matches' }} />
        <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: '👤 Profile' }} />
        <Tab.Screen name="Login" component={LoginScreen} options={{ tabBarLabel: '🔑 Login' }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
