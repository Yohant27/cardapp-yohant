/**
 * Tear physics ported from Kokonut UI's Tear Button
 * (c) @dorianbaffier, MIT licence, https://kokonutui.com
 *
 * The stub swings about the foot of the perforation, tears hole by hole
 * (stick-slip), then falls. Adapted for React Native: the simulation runs on
 * the UI thread in a Reanimated frame callback and the torn edges are drawn
 * as SVG paths instead of CSS clip-paths.
 */
import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { GestureType } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { Check, Scissors } from 'lucide-react-native';
import { PLATFORMS, Palette, PlatformKey } from '../lib/card';
import { PLATFORM_ICONS } from '../lib/icons';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const H = 56; // ticket height
const SW = 64; // stub width
const R = 14; // outer corner radius
const NOTCH = 7; // ticket notch radius
const ANGLE = 34; // degrees the stub swings before the last fibre gives
const HOLES = 7;
const HOLD = 0.55;
const HOLD_SHARE = 0.3;
const SWING_K = 900;
const SWING_D = 42;
const RETURN_K = 520;
const RETURN_D = 22;
const GRAVITY = 2600;
const FALL = 220;
const STEP = 1 / 120;
const RESET_AFTER = 2.4; // seconds until a fresh stub is printed
const FIBRES = [
  1.6, 0.4, 2.2, 0.9, 1.8, 0.2, 2.4, 1.1, 0.5, 2, 1.4, 0.3, 2.3, 0.8, 1.7, 0.1,
  2.1, 1.2, 0.6, 1.9,
];

const IDLE = 0;
const TEARING = 1;
const FLYING = 2;
const TORN = 3;

type Sim = {
  phase: number; angle: number; speed: number; target: number; held: number;
  grab: number; hole: number; carry: number; x: number; y: number; vx: number;
  vy: number; spin: number; pvx: number; pvy: number; auto: number;
  flying: number; reduced: number; rt: number; tornT: number;
};

function freshSim(): Sim {
  return {
    phase: IDLE, angle: 0, speed: 0, target: 0, held: 0, grab: 0, hole: 0,
    carry: 0, x: 0, y: 0, vx: 0, vy: 0, spin: 0, pvx: 0, pvy: 0, auto: 0,
    flying: 0, reduced: 0, rt: 0, tornT: 0,
  };
}

function clamp(v: number, lo: number, hi: number) {
  'worklet';
  return Math.min(Math.max(v, lo), hi);
}

/** Raw pull (0..1) to how far the tear has run, holding at each hole. */
function stickSlip(pull: number) {
  'worklet';
  const scaled = clamp(pull, 0, 1) * HOLES;
  const hole = Math.min(Math.floor(scaled), HOLES - 1);
  const f = scaled - hole;
  const given =
    f < HOLD ? (f / HOLD) * HOLD_SHARE : HOLD_SHARE + ((f - HOLD) / (1 - HOLD)) * (1 - HOLD_SHARE);
  return (hole + given) / HOLES;
}

function stepSwing(s: Sim) {
  'worklet';
  const driven = s.held === 1 || s.auto === 1;
  const k = driven ? SWING_K : RETURN_K;
  const d = driven ? SWING_D : RETURN_D;
  s.speed += ((s.target - s.angle) * k - s.speed * d) * STEP;
  s.angle += s.speed * STEP;
  const hole = Math.floor(clamp(s.angle / ANGLE, 0, 1) * HOLES);
  if (hole > s.hole) scheduleOnRN(Haptics.selectionAsync); // a tick per hole
  s.hole = hole;
  return s.angle >= ANGLE * 0.995;
}

function stepFlight(s: Sim) {
  'worklet';
  s.vy += GRAVITY * STEP;
  s.x += s.vx * STEP;
  s.y += s.vy * STEP;
  s.angle += s.spin * STEP;
  return s.y > FALL;
}

// Runs the fixed steps owed since the last frame; true once this phase is over.
function advance(s: Sim, elapsed: number) {
  'worklet';
  s.carry += elapsed;
  let finished = false;
  while (s.carry >= STEP && !finished) {
    s.carry -= STEP;
    if (s.flying === 1) finished = stepFlight(s);
    else if (s.auto === 1) {
      s.target = Math.min(s.target + STEP * 60, ANGLE * 1.05);
      finished = stepSwing(s);
    } else finished = stepSwing(s) && s.held === 1;
  }
  return finished;
}

// Body: ragged down its right edge to `tip` (px from the top), straight below.
function bodyPath(tip: number, bw: number) {
  'worklet';
  let d = `M${R} 0 L${bw} 0`;
  if (tip > 0.5) {
    const rows = Math.ceil((tip / H) * FIBRES.length);
    for (let k = 0; k <= rows; k++) {
      const y = Math.min((k / FIBRES.length) * H, tip);
      d += ` L${(bw - FIBRES[k % FIBRES.length]).toFixed(1)} ${y.toFixed(1)}`;
    }
    d += ` L${bw} ${tip.toFixed(1)}`;
  }
  return `${d} L${bw} ${H} L${R} ${H} Q0 ${H} 0 ${H - R} L0 ${R} Q0 0 ${R} 0 Z`;
}

// Stub: ragged down its left edge to `tip`, straight below.
function stubPath(tip: number) {
  'worklet';
  let d = `M${SW - R} 0 Q${SW} 0 ${SW} ${R} L${SW} ${H - R} Q${SW} ${H} ${SW - R} ${H} L0 ${H}`;
  if (tip > 0.5) {
    d += ` L0 ${tip.toFixed(1)}`;
    const rows = Math.ceil((tip / H) * FIBRES.length);
    for (let k = rows; k >= 0; k--) {
      const y = Math.min((k / FIBRES.length) * H, tip);
      d += ` L${FIBRES[k % FIBRES.length].toFixed(1)} ${y.toFixed(1)}`;
    }
  } else {
    d += ' L0 0'; // not torn yet: straight left edge up to the top corner
  }
  return `${d} Z`;
}

type Props = {
  handle: string;
  platform: PlatformKey;
  theme: Palette;
  fontFamily?: string;
  width: number;
  onTear: () => void;
  /** Where the tear opens; shown under "Opening ...". Defaults to the platform's profile URL. */
  url?: string;
  /** Display name, e.g. "Instagram" or "this link". */
  name?: string;
  /** The card's own swipe. It waits while the stub is held, so tearing never spins the card. */
  blockGesture?: GestureType;
};

export function TearButton({ handle, platform, theme: t, fontFamily, width, onTear, url, name, blockGesture }: Props) {
  const reduced = useReducedMotion();
  const sim = useSharedValue<Sim>(freshSim());
  const BW = width - SW;
  const Icon = PLATFORM_ICONS[platform];
  const label = name ?? PLATFORMS[platform].label;
  const host = (url ?? PLATFORMS[platform].url(handle)).replace(/^https?:\/\//, '') || 'Add a link in the editor';

  const confirm = () => onTear();

  const detach = (s: Sim) => {
    'worklet';
    s.held = 0;
    scheduleOnRN(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Medium);
    // The stub leaves with the swing it had, plus the hand's throw.
    const rad = (s.angle * Math.PI) / 180;
    const tangential = ((s.speed * Math.PI) / 180) * H;
    s.x = 0;
    s.y = 0;
    s.vx = Math.cos(rad) * tangential + clamp(s.pvx, -900, 900) * 0.6 + 90;
    s.vy = Math.sin(rad) * tangential + clamp(s.pvy, -900, 900) * 0.6 - 120;
    s.spin = s.speed * 0.6 + 140;
    s.flying = 1;
    s.reduced = reduced ? 1 : 0;
    s.rt = 0;
    s.phase = FLYING;
    scheduleOnRN(confirm);
  };

  useFrameCallback((frame) => {
    'worklet';
    const elapsed = Math.min((frame.timeSincePreviousFrame ?? 16) / 1000, 0.05);
    const c = sim.get();
    if (c.phase === IDLE && c.held === 0 && c.auto === 0) return; // nothing to do
    sim.modify((s) => {
      'worklet';
      if (s.phase === TORN) {
        s.tornT += elapsed;
        if (s.tornT >= RESET_AFTER) {
          const f = freshSim();
          Object.keys(f).forEach((key) => {
            (s as any)[key] = (f as any)[key];
          });
        }
        return s;
      }
      const wasFlying = s.flying === 1;
      if (wasFlying && s.reduced === 1) {
        s.rt += elapsed; // reduced motion: fade where it tore instead of falling
        if (s.rt >= 0.18) {
          s.phase = TORN;
          s.tornT = 0;
        }
        return s;
      }
      const finished = advance(s, elapsed);
      if (wasFlying) {
        if (finished) {
          s.phase = TORN;
          s.tornT = 0;
          s.carry = 0;
        }
        return s;
      }
      if (finished) {
        s.auto = 0;
        detach(s);
        return s;
      }
      if (s.held === 0 && s.auto === 0 && Math.abs(s.angle) < 0.02 && Math.abs(s.speed) < 0.05) {
        s.angle = 0;
        s.speed = 0;
        s.phase = IDLE;
      }
      return s;
    });
  });

  // The hit zone is fixed over the stub, so its x/y are measured from the
  // perforation's foot, which is the hinge: (0, H).
  const pan = useMemo(
    () => {
      const g = Gesture.Pan()
        .minDistance(0) // grabs at once, ahead of the card's own swipe
        .shouldCancelWhenOutside(false)
        .onBegin((e) => {
          sim.modify((s) => {
            'worklet';
            if (s.phase >= FLYING) return s;
            s.grab = (Math.atan2(e.y - H, e.x) * 180) / Math.PI - s.angle;
            s.held = 1;
            s.pvx = 0;
            s.pvy = 0;
            s.phase = TEARING;
            return s;
          });
        })
        .onUpdate((e) => {
          sim.modify((s) => {
            'worklet';
            if (s.held !== 1) return s;
            s.pvx = e.velocityX * 0.5;
            s.pvy = e.velocityY * 0.5;
            const raw = (Math.atan2(e.y - H, e.x) * 180) / Math.PI - s.grab;
            const pull = raw < 0 ? raw * 0.15 : raw; // pushing back only gives a little
            s.target =
              pull >= ANGLE
                ? ANGLE * 1.05
                : stickSlip(Math.max(pull, 0) / ANGLE) * ANGLE + Math.min(pull, 0);
            return s;
          });
        })
        .onFinalize(() => {
          sim.modify((s) => {
            'worklet';
            if (s.held === 1) {
              s.held = 0;
              if (s.target >= ANGLE) s.auto = 1; // pulled all the way, then let go: finish the tear
              else s.target = 0; // not torn through: the perforation holds and it swings back
            }
            return s;
          });
        });
      return blockGesture ? g.blocksExternalGesture(blockGesture) : g;
    },
    [BW, blockGesture]
  );

  const bodyProps = useAnimatedProps(() => {
    const tip = clamp(sim.get().angle / ANGLE, 0, 1) * H;
    return { d: bodyPath(tip, BW) };
  });
  const stubProps = useAnimatedProps(() => {
    const tip = clamp(sim.get().angle / ANGLE, 0, 1) * H;
    return { d: stubPath(tip) };
  });
  const stubStyle = useAnimatedStyle(() => {
    const s = sim.get();
    if (s.phase === TORN) return { opacity: 0 };
    if (s.flying === 1) {
      const fade =
        s.reduced === 1
          ? 1 - Math.min(s.rt / 0.18, 1)
          : clamp(1 - (s.y - FALL * 0.5) / (FALL * 0.5), 0, 1);
      return {
        opacity: fade,
        transform: [{ translateX: s.x }, { translateY: s.y }, { rotate: `${s.angle}deg` }],
      };
    }
    return { opacity: 1, transform: [{ rotate: `${s.angle}deg` }] };
  });

  const done = useDerivedValue(() => withTiming(sim.get().phase >= FLYING ? 1 : 0, { duration: 300 }));
  const askStyle = useAnimatedStyle(() => ({
    opacity: 1 - done.get(),
    transform: [{ translateY: done.get() * 4 }],
  }));
  const doneStyle = useAnimatedStyle(() => ({
    opacity: done.get(),
    transform: [{ translateY: (1 - done.get()) * 4 }],
  }));
  const iconStyle = useAnimatedStyle(() => ({ opacity: 1 - done.get() }));
  const checkStyle = useAnimatedStyle(() => ({ opacity: done.get() }));

  return (
    <View style={{ width, height: H }}>
      {/* Body */}
      <View style={[StyleSheet.absoluteFill, { width: BW }]}>
        <Svg width={BW} height={H} style={StyleSheet.absoluteFill}>
          <AnimatedPath animatedProps={bodyProps} fill={t.fg} />
          <Circle cx={BW} cy={0} r={NOTCH} fill={t.bg} />
          <Circle cx={BW} cy={H} r={NOTCH} fill={t.bg} />
        </Svg>
        <View style={styles.bodyRow} pointerEvents="none">
          <View style={[styles.chip, { backgroundColor: `${t.bg}24` }]}>
            <Animated.View style={[styles.chipDone, { backgroundColor: t.bg }, checkStyle]} />
            <Animated.View style={iconStyle}>
              <Icon size={16} color={t.bg} />
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, styles.tick, checkStyle]}>
              <Check size={16} color={t.fg} />
            </Animated.View>
          </View>
          <View style={styles.texts}>
            <Animated.View style={[StyleSheet.absoluteFill, styles.center, askStyle]}>
              <Text numberOfLines={1} style={[styles.title, { color: t.bg, fontFamily }]}>@{handle}</Text>
              <Text numberOfLines={1} style={[styles.sub, { color: t.bg, fontFamily }]}>
                Tear the stub to open {label}
              </Text>
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, styles.center, doneStyle]}>
              <Text numberOfLines={1} style={[styles.title, { color: t.bg, fontFamily }]}>Opening {label}</Text>
              <Text numberOfLines={1} style={[styles.sub, { color: t.bg, fontFamily }]}>{host}</Text>
            </Animated.View>
          </View>
        </View>
      </View>

      {/* Stub (swings about its bottom-left corner) */}
      <Animated.View
        pointerEvents="none"
        style={[styles.stub, { left: BW, width: SW, transformOrigin: [0, H, 0] }, stubStyle]}
      >
        <Svg width={SW} height={H} style={StyleSheet.absoluteFill}>
          <AnimatedPath animatedProps={stubProps} fill={t.fg} />
          <Line
            x1={1} y1={10} x2={1} y2={H - 10}
            stroke={t.bg} strokeOpacity={0.3} strokeWidth={2}
            strokeDasharray="0.1 5" strokeLinecap="round"
          />
          <Circle cx={0} cy={0} r={NOTCH} fill={t.bg} />
          <Circle cx={0} cy={H} r={NOTCH} fill={t.bg} />
        </Svg>
        <View style={styles.stubContent}>
          <Scissors size={16} color={t.bg} style={{ opacity: 0.65 }} />
          <Text style={[styles.stubText, { color: t.bg, fontFamily }]}>Tear</Text>
        </View>
      </Animated.View>

      {/* Fixed hit zone over the stub */}
      <GestureDetector gesture={pan}>
        <View
          style={[styles.zone, { left: BW, width: SW }, Platform.OS === 'web' ? ({ touchAction: 'none' } as any) : null]}
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Tear off the stub to open ${label} @${handle}`}
          accessibilityActions={[{ name: 'activate' }]}
          onAccessibilityAction={() =>
            sim.modify((s) => {
              'worklet';
              if (s.phase === IDLE) {
                s.auto = 1; // from a screen reader the stub tears itself
                s.target = 0;
                s.phase = TEARING;
              }
              return s;
            })
          }
        />
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  bodyRow: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  chip: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  chipDone: { ...StyleSheet.absoluteFillObject, borderRadius: 16 },
  center: { alignItems: 'flex-start', justifyContent: 'center' },
  tick: { alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1, height: 36 },
  title: { fontSize: 13.5, fontWeight: '600' },
  sub: { fontSize: 11, opacity: 0.6 },
  stub: { position: 'absolute', top: 0, height: H },
  stubContent: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 3 },
  stubText: { fontSize: 11, fontWeight: '600', opacity: 0.65 },
  zone: { position: 'absolute', top: 0, height: H },
});
