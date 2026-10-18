import React, { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChevronsRight } from 'lucide-react-native';
import { FlipCard } from '../components/FlipCard';
import { cardSize, linkToCard } from '../lib/card';

// Viewer: opened from a shared link (https://your-site/card?d=...) or a scanned QR code.
export default function CardScreen() {
  const { d } = useLocalSearchParams<{ d?: string }>();
  const { width: sw } = useWindowDimensions();
  const card = useMemo(() => linkToCard(d), [d]);

  if (!card) {
    return (
      <View style={styles.screen}>
        <StatusBar style="light" />
        <Text style={styles.msg}>This card link is broken. Ask the sender for a new one.</Text>
        <Link href="/" style={styles.link}>
          Make your own card
        </Link>
      </View>
    );
  }

  const { width, height } = cardSize(card.ratio, sw);
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <FlipCard card={card} width={width} height={height} labelColor="#9A9DA5" />
      <View style={styles.hint}>
        <Text style={styles.hintText}>Swipe right to turn the card</Text>
        <ChevronsRight size={16} color="#9A9DA5" />
      </View>
      <Link href="/" style={styles.link}>
        Make your own card
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0E0F12', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 },
  msg: { color: '#fff', fontSize: 16, textAlign: 'center' },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hintText: { color: '#9A9DA5', fontSize: 14 },
  link: { color: '#fff', fontSize: 14, fontWeight: '600', textDecorationLine: 'underline', marginTop: 12 },
});
