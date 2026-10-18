import React, { useState } from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import Animated, { cubicBezier } from 'react-native-reanimated';

const CSS_EASE_OUT = cubicBezier(0.23, 1, 0.32, 1);

// Press feedback: scale 0.97 on press-in, 120ms, Reanimated CSS transition (UI thread).
export function PressScale({
  onPress,
  style,
  children,
  hitSlop = 8,
}: {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  hitSlop?: number;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      hitSlop={hitSlop}
      pressRetentionOffset={20}
    >
      <Animated.View
        style={[
          style,
          {
            transform: [{ scale: pressed ? 0.97 : 1 }],
            transitionProperty: 'transform',
            transitionDuration: 120,
            transitionTimingFunction: CSS_EASE_OUT,
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}
