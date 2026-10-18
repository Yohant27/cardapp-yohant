import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { shareLink } from '../lib/open';
import { ChevronDown, Eye, Plus, Share2, X } from 'lucide-react-native';
import { FlipCard } from '../components/FlipCard';
import { PressScale } from '../components/PressScale';
import { AVATAR_ICONS, PLATFORM_ICONS } from '../lib/icons';
import {
  AVATARS,
  CardData,
  DEFAULT_CARD,
  FONTS,
  FontKey,
  PLATFORMS,
  PlatformKey,
  SWATCHES,
  THEMES,
  ThemeKey,
  cardSize,
  cardToLink,
  extractHandles,
  hexToHsl,
  hslToHex,
  isHex,
} from '../lib/card';

function Chip({ label, active, onPress, icon }: { label: string; active: boolean; onPress: () => void; icon?: React.ReactNode }) {
  return (
    <PressScale onPress={onPress} style={[s.chip, active && s.chipOn]}>
      {icon}
      <Text style={[s.chipText, active && s.chipTextOn]}>{label}</Text>
    </PressScale>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor="#6B7078" style={[s.input, style]} {...rest} />
    </View>
  );
}

// One draggable gradient bar (hue, saturation or lightness).
function Bar({ value, max, stops, thumb, onChange }: { value: number; max: number; stops: string[]; thumb: string; onChange: (v: number) => void }) {
  const [w, setW] = useState(0);
  const id = 'g' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const cb = useRef(onChange);
  cb.current = onChange;
  const pan = useMemo(() => {
    const set = (x: number) => w > 0 && cb.current(Math.min(Math.max(x / w, 0), 1) * max);
    return Gesture.Pan()
      .runOnJS(true)
      .minDistance(0)
      .onBegin((e) => set(e.x))
      .onUpdate((e) => set(e.x));
  }, [w, max]);
  return (
    <GestureDetector gesture={pan}>
      <View style={{ height: 30, justifyContent: 'center' }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {w > 0 && (
          <Svg width={w} height={14}>
            <Defs>
              <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
                {stops.map((c, i) => (
                  <Stop key={i} offset={i / (stops.length - 1)} stopColor={c} />
                ))}
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={w} height={14} rx={7} fill={`url(#${id})`} />
          </Svg>
        )}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: (value / max) * w - 12,
            top: 3,
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: 3,
            borderColor: '#fff',
            backgroundColor: thumb,
          }}
        />
      </View>
    </GestureDetector>
  );
}

// Swatches for quick picks, a hex box, and a slider picker for any colour.
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const [hsl, setHsl] = useState<[number, number, number]>(() => hexToHsl(value));
  useEffect(() => {
    setText(value);
    // Keep the hue when the colour came from the sliders (grey and white have no hue of their own).
    if (hslToHex(hsl[0], hsl[1], hsl[2]).toLowerCase() !== value.toLowerCase()) setHsl(hexToHsl(value));
  }, [value]);
  const slide = (next: [number, number, number]) => {
    setHsl(next);
    onChange(hslToHex(next[0], next[1], next[2]));
  };
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.label}>{label}</Text>
      <View style={s.rowWrap}>
        {SWATCHES.map((c) => (
          <PressScale
            key={c}
            onPress={() => onChange(c)}
            style={[s.dotSw, { backgroundColor: c }, value.toLowerCase() === c.toLowerCase() && s.dotSwOn]}
          >
            {null}
          </PressScale>
        ))}
      </View>
      <View style={s.row}>
        <View style={[s.preview, { backgroundColor: value }]} />
        <TextInput
          style={[s.input, { flex: 1 }]}
          value={text}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={7}
          placeholder="#RRGGBB"
          placeholderTextColor="#6B7078"
          onChangeText={(v) => {
            setText(v);
            const h = v.startsWith('#') ? v : `#${v}`;
            if (isHex(h)) onChange(h);
          }}
        />
        <Chip label={open ? 'Close' : 'Pick'} active={open} onPress={() => setOpen((o) => !o)} />
      </View>
      {open && (
        <View style={{ gap: 4 }}>
          <Text style={s.hint}>Hue</Text>
          <Bar
            value={hsl[0]}
            max={360}
            thumb={hslToHex(hsl[0], 100, 50)}
            stops={[0, 60, 120, 180, 240, 300, 360].map((h) => hslToHex(h % 360, 100, 50))}
            onChange={(h) => slide([h, hsl[1], hsl[2]])}
          />
          <Text style={s.hint}>Saturation</Text>
          <Bar
            value={hsl[1]}
            max={100}
            thumb={value}
            stops={[hslToHex(hsl[0], 0, hsl[2]), hslToHex(hsl[0], 100, hsl[2])]}
            onChange={(sat) => slide([hsl[0], sat, hsl[2]])}
          />
          <Text style={s.hint}>Lightness</Text>
          <Bar
            value={hsl[2]}
            max={100}
            thumb={value}
            stops={['#000000', hslToHex(hsl[0], hsl[1], 50), '#FFFFFF']}
            onChange={(l) => slide([hsl[0], hsl[1], l])}
          />
        </View>
      )}
    </View>
  );
}

export default function Editor() {
  const router = useRouter();
  const { width: sw } = useWindowDimensions();
  const [card, setCard] = useState<CardData>(DEFAULT_CARD);
  const [avOpen, setAvOpen] = useState(false);
  const update = (patch: Partial<CardData>) => setCard((c) => ({ ...c, ...patch }));
  const { width, height } = cardSize(card.ratio, sw);
  const found = extractHandles(card.about);

  const setLink = (i: number, patch: Partial<CardData['links'][number]>) =>
    update({ links: card.links.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#000' }}
      contentContainerStyle={{ padding: 16, gap: 22, paddingBottom: 48 }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <View style={{ alignItems: 'center', paddingVertical: 12 }}>
        <FlipCard card={card} width={width} height={height} />
      </View>

      <View style={s.section}>
        <Text style={s.heading}>Shape</Text>
        <View style={s.row}>
          <Chip label="3:2 landscape" active={card.ratio === '3:2'} onPress={() => update({ ratio: '3:2' })} />
          <Chip label="2:3 portrait" active={card.ratio === '2:3'} onPress={() => update({ ratio: '2:3' })} />
        </View>
      </View>

      <View style={s.section}>
        <Text style={s.heading}>About you</Text>
        <Field label="Name" value={card.name} maxLength={28} onChangeText={(name) => update({ name })} placeholder="Your name" />
        <Field label="Title" value={card.title} maxLength={40} onChangeText={(title) => update({ title })} placeholder="What you do" />

        <View style={{ gap: 6 }}>
          <Text style={s.label}>Avatar icon</Text>
          <PressScale onPress={() => setAvOpen((o) => !o)} style={s.dd}>
            {React.createElement(AVATAR_ICONS[card.icon], { size: 20, color: '#fff' })}
            <Text style={s.ddText}>{card.icon}</Text>
            <ChevronDown size={16} color="#9AA0A6" />
          </PressScale>
          {avOpen && (
            <View style={s.ddGrid}>
              {AVATARS.map((k) => {
                const Icon = AVATAR_ICONS[k];
                const on = card.icon === k;
                return (
                  <PressScale
                    key={k}
                    onPress={() => {
                      update({ icon: k });
                      setAvOpen(false);
                    }}
                    style={[s.ddOpt, on && s.ddOptOn]}
                  >
                    <Icon size={22} color={on ? '#111' : '#fff'} />
                  </PressScale>
                );
              })}
            </View>
          )}
        </View>

        <Field
          label="Bio (write @handles to turn them into tear-off socials)"
          value={card.about}
          maxLength={140}
          multiline
          style={{ minHeight: 76, textAlignVertical: 'top' }}
          onChangeText={(about) => update({ about })}
          placeholder="Say hi @yourhandle"
        />
        {found.map((h) => {
          const current: PlatformKey = card.handles[h] ?? 'instagram';
          return (
            <View key={h} style={{ gap: 8 }}>
              <Text style={s.label}>@{h} is on</Text>
              <View style={s.rowWrap}>
                {(Object.keys(PLATFORMS) as PlatformKey[]).map((p) => {
                  const Icon = PLATFORM_ICONS[p];
                  return (
                    <Chip
                      key={p}
                      label={PLATFORMS[p].label}
                      active={current === p}
                      icon={<Icon size={14} color={current === p ? '#111' : '#fff'} />}
                      onPress={() => update({ handles: { ...card.handles, [h]: p } })}
                    />
                  );
                })}
              </View>
              {current === 'other' && (
                <TextInput
                  style={s.input}
                  value={card.urls[h] ?? ''}
                  placeholder="example.com/your-page"
                  placeholderTextColor="#6B7078"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={150}
                  onChangeText={(u) => update({ urls: { ...card.urls, [h]: u } })}
                />
              )}
              {current === 'whatsapp' && (
                <Text style={s.hint}>Write the number with country code, like @60123456789</Text>
              )}
            </View>
          );
        })}
      </View>

      <View style={s.section}>
        <Text style={s.heading}>Links</Text>
        {card.links.map((l, i) => (
          <View key={i} style={s.row}>
            <TextInput
              placeholderTextColor="#6B7078"
              style={[s.input, { flex: 1 }]}
              value={l.label}
              maxLength={30}
              placeholder="Label"
              onChangeText={(label) => setLink(i, { label })}
            />
            <TextInput
              placeholderTextColor="#6B7078"
              style={[s.input, { flex: 1.4 }]}
              value={l.url}
              maxLength={120}
              placeholder="example.com"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={(url) => setLink(i, { url })}
            />
            <PressScale onPress={() => update({ links: card.links.filter((_, j) => j !== i) })}>
              <X size={20} color="#9AA0A6" />
            </PressScale>
          </View>
        ))}
        {card.links.length < 3 && (
          <Chip
            label="Add link"
            active={false}
            icon={<Plus size={14} color="#fff" />}
            onPress={() => update({ links: [...card.links, { label: '', url: '' }] })}
          />
        )}
      </View>

      <View style={s.section}>
        <Text style={s.heading}>Look</Text>
        <Text style={s.label}>Presets</Text>
        <View style={s.row}>
          {(Object.keys(THEMES) as ThemeKey[]).map((k) => {
            const th = THEMES[k];
            const on = card.primary.toLowerCase() === th.primary.toLowerCase() && card.secondary.toLowerCase() === th.secondary.toLowerCase();
            return (
              <PressScale
                key={k}
                onPress={() => update({ primary: th.primary, secondary: th.secondary })}
                style={[s.swatch, { backgroundColor: th.primary }, on && s.swatchOn]}
              >
                <View style={[s.dot, { backgroundColor: th.secondary }]} />
              </PressScale>
            );
          })}
        </View>
        <ColorField label="Primary colour (the card)" value={card.primary} onChange={(primary) => update({ primary })} />
        <ColorField label="Secondary colour (accents)" value={card.secondary} onChange={(secondary) => update({ secondary })} />
        <View style={s.row}>
          {(Object.keys(FONTS) as FontKey[]).map((f) => (
            <Chip key={f} label={f} active={card.font === f} onPress={() => update({ font: f })} />
          ))}
        </View>
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <Text style={s.label}>Show QR code on the card</Text>
          <Switch
            value={card.showQr}
            onValueChange={(showQr) => update({ showQr })}
            trackColor={{ false: '#2A2C31', true: '#7CF2D4' }}
          />
        </View>
      </View>

      <View style={s.row}>
        <PressScale style={[s.cta, { flex: 1 }]} onPress={() => shareLink(cardToLink(card))}>
          <Share2 size={18} color="#111" />
          <Text style={s.ctaText}>Share link</Text>
        </PressScale>
        <PressScale
          style={[s.cta, s.ctaAlt]}
          onPress={() => router.push({ pathname: '/card', params: { d: cardToLink(card).split('d=')[1] } })}
        >
          <Eye size={18} color="#fff" />
          <Text style={[s.ctaText, { color: '#fff' }]}>Viewer</Text>
        </PressScale>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  section: { gap: 12 },
  heading: { fontSize: 18, fontWeight: '700', color: '#fff' },
  label: { fontSize: 13, color: '#9AA0A6', fontWeight: '600' },
  hint: { fontSize: 12, color: '#8A8F98' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { backgroundColor: '#16171B', borderWidth: 1, borderColor: '#23252B', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: '#fff' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#16171B', borderWidth: 1, borderColor: '#23252B', borderRadius: 999, paddingHorizontal: 14, height: 36 },
  chipOn: { backgroundColor: '#fff', borderColor: '#fff' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  chipTextOn: { color: '#111' },
  swatch: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'transparent' },
  swatchOn: { borderColor: '#fff' },
  dot: { width: 14, height: 14, borderRadius: 7 },
  preview: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)' },
  dotSw: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
  dotSwOn: { borderColor: '#fff', borderWidth: 3 },
  dd: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#16171B', borderWidth: 1, borderColor: '#23252B', borderRadius: 12, paddingHorizontal: 12, height: 46 },
  ddText: { flex: 1, fontSize: 15, color: '#fff', textTransform: 'capitalize' },
  ddGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, backgroundColor: '#16171B', borderRadius: 14, padding: 8 },
  ddOpt: { width: 48, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#23252B' },
  ddOptOn: { backgroundColor: '#fff' },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 14, backgroundColor: '#fff', paddingHorizontal: 20 },
  ctaAlt: { backgroundColor: '#16171B', borderWidth: 1, borderColor: '#23252B' },
  ctaText: { color: '#111', fontSize: 15, fontWeight: '700' },
});
