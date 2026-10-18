import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: '#000' },
          headerTintColor: '#fff',
          contentStyle: { backgroundColor: '#000' },
        }}>
        <Stack.Screen name="index" options={{ title: 'Your card' }} />
        <Stack.Screen
          name="card"
          options={{ title: '', headerTransparent: true, headerTintColor: '#fff' }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
