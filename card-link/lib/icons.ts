import {
  AtSign, Briefcase, Camera, Code, Coffee, Cpu, Flame, Globe, Heart, Leaf, Link2,
  MessageCircle, Music, Palette, Play, Smile, Sparkles, Star, User, Zap,
} from 'lucide-react-native';
import type { AvatarKey, PlatformKey } from './card';

// Lucide dropped brand logos, so each platform gets a neutral stand-in.
export const PLATFORM_ICONS = {
  instagram: Camera,
  tiktok: Music,
  youtube: Play,
  github: Code,
  x: AtSign,
  linkedin: Briefcase,
  whatsapp: MessageCircle,
  other: Link2,
} satisfies Record<PlatformKey, unknown>;

// Avatar choices shown in the editor dropdown.
export const AVATAR_ICONS = {
  user: User, smile: Smile, heart: Heart, star: Star,
  zap: Zap, flame: Flame, sparkles: Sparkles, leaf: Leaf,
  coffee: Coffee, globe: Globe, palette: Palette, cpu: Cpu,
  camera: Camera, music: Music, code: Code, briefcase: Briefcase,
} satisfies Record<AvatarKey, unknown>;
