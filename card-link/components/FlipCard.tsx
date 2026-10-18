/**
 * Flip physics ported from Kokonut UI's Card Flip ("Flick Card")
 * (c) @dorianbaffier, MIT licence, https://kokonutui.com
 *
 * Drag turns the card 0.6deg per px, a spring lands it on a face, and a hard
 * flick can carry it further. It swells toward you at 90deg, casts a floor
 * shadow and catches a sweep of light. Ported to Reanimated: the web version's
 * stacked-slice edge needs translateZ, which React Native lacks, so it is left out.
 */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import QRCode from 'react-native-qrcode-svg';
import { ArrowUpRight, ChevronsRight, Link2, RotateCw } from 'lucide-react-native';
import {
  CardData, FONTS, PLATFORMS, cardToLink, cardUrl, extractHandles, onColor, palette, safeUrl,
} from '../lib/card';
import { AVATAR_ICONS } from '../lib/icons';
import { openLink } from '../lib/open';
import { PressScale } from './PressScale';
import { TearButton } from './TearButton';

const DEG_PER_PX = 0.6;
const STIFFNESS = 170;
const DAMPING = 20;
const PROJECTION = 0.22; // seconds of release velocity used to pick the landing face
const FLICK_SPEED = 450; // deg/s: a faster release always turns at least one face
const MAX_HALF_TURNS = 6;
const LIFT_SCALE = 0.05; // stands in for the web version's translateZ lift

function sideOf(a: number) {
  'worklet';
  const n = Math.round(a / 180);
  return (((n % 2) + 2) % 2) === 1;
}
function nearestFace(a: number) {
  'worklet';
  return Math.round(a / 180) * 180;
}

type Props = { card: CardData; width: number; height: number; labelColor?: string };

export function FlipCard({ card, width, height, labelColor = '#7B7F88' }: Props) {
  const t = palette(card.primary, card.secondary);
  const fontFamily = FONTS[card.font];
  const reduced = useReducedMotion();
  const angle = useSharedValue(0);
  const startA = useSharedValue(0);
  const tgt = useSharedValue(0);

  // Which face is up, as React state, so pointer events never depend on animated props (they don't apply on web).
  const [isBack, setIsBack] = useState(false);
  useAnimatedReaction(
    () => sideOf(angle.get()),
    (now, prev) => {
      if (now !== prev) scheduleOnRN(setIsBack, now);
    }
  );

  // Point the spring at a face; a tick when the side changes.
  const aim = (target: number, velocity: number) => {
    'worklet';
    if (sideOf(target) !== sideOf(tgt.get())) {
      scheduleOnRN(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Light);
    }
    tgt.set(target);
    angle.set(
      withSpring(
        target,
        { stiffness: STIFFNESS, damping: DAMPING, mass: 1, velocity, reduceMotion: ReduceMotion.System },
        (finished) => {
          if (finished) {
            const f = sideOf(target) ? 180 : 0; // park on 0 or 180 so the numbers never grow
            angle.set(f);
            tgt.set(f);
          }
        }
      )
    );
  };

  const makePan = () =>
    Gesture.Pan()
      .activeOffsetX([-6, 6])
      .failOffsetY([-14, 14])
      .onStart(() => {
        startA.set(angle.get());
        angle.set(angle.get()); // catches the card mid-spring
      })
      .onUpdate((e) => {
        angle.set(startA.get() + e.translationX * DEG_PER_PX); // one to one: the card stays under the finger
      })
      .onEnd((e) => {
        const v = e.velocityX * DEG_PER_PX;
        const from = nearestFace(startA.get());
        let target = nearestFace(angle.get() + v * PROJECTION);
        if (Math.abs(v) > FLICK_SPEED && target === from) target = from + 180 * Math.sign(v);
        const limit = MAX_HALF_TURNS * 180;
        target = Math.max(from - limit, Math.min(from + limit, target));
        aim(target, v);
      });

  // A tap on the front pushes the half you pressed away from you.
  // Memoised so a re-render never swaps the gesture objects mid-drag.
  const frontGesture = useMemo(
    () =>
      Gesture.Race(
        makePan(),
        Gesture.Tap()
          .maxDistance(4)
          .onEnd((e, ok) => {
            if (ok) aim(nearestFace(tgt.get()) + 180 * (e.x > width / 2 ? 1 : -1), 0);
          })
      ),
    [width]
  );
  const backGesture = useMemo(() => makePan(), []);

  const useTurnStyle = (offset: number) =>
    useAnimatedStyle(() => {
      const a = angle.get();
      // Hide the face that points away. backfaceVisibility alone flickers on Android and some browsers.
      const shown = sideOf(a) === (offset === 180) ? 1 : 0;
      if (reduced) return { opacity: shown };
      const turn = Math.abs(Math.sin((a * Math.PI) / 180));
      return {
        opacity: shown,
        transform: [{ perspective: 1100 }, { scale: 1 + turn * LIFT_SCALE }, { rotateY: `${a + offset}deg` }],
      };
    });
  const frontStyle = useTurnStyle(0);
  const backStyle = useTurnStyle(180);

  const shadowStyle = useAnimatedStyle(() => {
    const rad = (angle.get() * Math.PI) / 180;
    const turn = Math.abs(Math.sin(rad));
    const facing = Math.abs(Math.cos(rad));
    return {
      opacity: 1 - turn * 0.45,
      transform: [{ scaleX: 0.16 + 0.84 * facing }, { scaleY: 1 - turn * 0.12 }],
    };
  });
  const shadeStyle = useAnimatedStyle(() => ({
    opacity: Math.abs(Math.sin((angle.get() * Math.PI) / 180)) * 0.14,
  }));
  const bandStyle = useAnimatedStyle(() => {
    const sin = Math.sin((angle.get() * Math.PI) / 180);
    return {
      opacity: Math.abs(sin) * 0.12,
      transform: [{ translateX: sin * 1.4 * (width / 3) }, { rotate: '18deg' }],
    };
  });

  const link = cardToLink(card);
  const qrSize = Math.round(Math.min(width, height) * 0.34);
  const handles = extractHandles(card.about).map((h) => ({ h, p: card.handles[h] ?? 'instagram' }));
  const face = [styles.face, { width, height, backgroundColor: t.bg }];
  const Avatar = AVATAR_ICONS[card.icon];

  const light = (
    <>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, shadeStyle]} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.lightWrap]}>
        <Animated.View style={[{ width: width / 3, height: height * 2.2, backgroundColor: '#fff' }, bandStyle]} />
      </View>
    </>
  );

  return (
    <View style={{ alignItems: 'center', gap: 34 }}>
      <View style={{ width, height }}>
        <Animated.View pointerEvents="none" style={[styles.floor, shadowStyle]} />

        {/* FRONT */}
        <GestureDetector gesture={frontGesture}>
          <Animated.View pointerEvents={isBack ? 'none' : 'auto'} style={[face, styles.front, frontStyle]}>
            <View style={styles.topRow}>
              <View style={[styles.avatar, { backgroundColor: t.accent }]}>
                <Avatar size={24} color={onColor(t.accent)} />
              </View>
              {card.showQr && link.length <= 1200 ? (
                <View style={styles.qr}>
                  <QRCode value={link} size={qrSize} ecl="L" color="#000" backgroundColor="#fff" />
                </View>
              ) : null}
            </View>
            <View style={{ paddingRight: 28 }}>
              <Text numberOfLines={2} style={[styles.name, { color: t.fg, fontFamily }]}>
                {card.name || 'Your name'}
              </Text>
              <Text numberOfLines={2} style={[styles.title, { color: t.muted, fontFamily }]}>
                {card.title || 'What you do'}
              </Text>
            </View>
            <View style={styles.flipHint}>
              <ChevronsRight size={20} color={t.muted} />
            </View>
            {light}
          </Animated.View>
        </GestureDetector>

        {/* BACK */}
        <GestureDetector gesture={backGesture}>
          <Animated.View pointerEvents={isBack ? 'auto' : 'none'} style={[face, backStyle]}>
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 12 }}>
              {!!card.about && (
                <Text numberOfLines={4} style={{ color: t.fg, fontFamily, fontSize: 14, lineHeight: 20 }}>
                  {card.about.split(/(@[A-Za-z0-9_.]{2,30})/g).map((part, i) =>
                    part.startsWith('@') ? (
                      <Text key={i} style={{ color: t.accent, fontWeight: '700' }}>{part}</Text>
                    ) : (
                      part
                    )
                  )}
                </Text>
              )}
              {card.links
                .filter((l) => l.url.trim())
                .map((l, i) => (
                  <PressScale
                    key={i}
                    onPress={() => openLink(safeUrl(l.url))}
                    style={[styles.linkRow, { borderColor: t.muted }]}
                  >
                    <Link2 size={16} color={t.accent} />
                    <Text numberOfLines={1} style={{ flex: 1, color: t.fg, fontFamily, fontSize: 14, fontWeight: '600' }}>
                      {l.label || l.url}
                    </Text>
                    <ArrowUpRight size={16} color={t.muted} />
                  </PressScale>
                ))}
              {handles.map(({ h, p }) => {
                const url = cardUrl(card, h, p);
                return (
                  <TearButton
                    key={h}
                    handle={h}
                    platform={p}
                    theme={t}
                    fontFamily={fontFamily}
                    width={width - 40}
                    url={url}
                    name={p === 'other' ? 'this link' : PLATFORMS[p].label}
                    onTear={() => openLink(url)}
                    blockGesture={backGesture}
                  />
                );
              })}
            </ScrollView>
            {light}
          </Animated.View>
        </GestureDetector>
      </View>

      <PressScale onPress={() => aim(nearestFace(tgt.get()) + 180, 0)} style={styles.flipBtn}>
        <RotateCw size={16} color={labelColor} />
        <Text style={{ color: labelColor, fontSize: 13, fontWeight: '600' }}>Turn card</Text>
      </PressScale>
    </View>
  );
}

const styles = StyleSheet.create({
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: 24,
    backfaceVisibility: 'hidden',
    overflow: 'hidden',
  },
  floor: {
    position: 'absolute',
    left: '8%',
    right: '8%',
    bottom: -4,
    height: 6,
    borderRadius: 3,
    boxShadow: '0px 12px 14px 6px rgba(0,0,0,0.3)',
  },
  lightWrap: { alignItems: 'center', justifyContent: 'center' },
  front: { padding: 20, justifyContent: 'space-between' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  qr: { backgroundColor: '#fff', padding: 6, borderRadius: 10 },
  name: { fontSize: 28, fontWeight: '700', lineHeight: 32 },
  title: { fontSize: 15, marginTop: 4 },
  flipHint: { position: 'absolute', right: 16, bottom: 16 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  flipBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10 },
});
