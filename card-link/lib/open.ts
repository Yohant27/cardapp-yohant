import { Linking, Platform, Share } from 'react-native';

/** Opens a link on native and web. On web, falls back to navigating if the browser blocks the new tab. */
export function openLink(url?: string) {
  if (!url) return;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const w = window.open(url, '_blank');
    if (w) w.opener = null;
    else window.location.assign(url); // popup blocked (the tear fires after the drag, not on a click)
    return;
  }
  Linking.openURL(url).catch(() => {});
}

/** Share a link: the phone share sheet where it exists, otherwise copy it to the clipboard. */
export async function shareLink(url: string) {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    try {
      if (navigator.share) {
        await navigator.share({ url });
        return;
      }
      await navigator.clipboard.writeText(url);
      window.alert('Link copied. Paste it anywhere to share your card.');
    } catch {
      // share sheet closed, or the clipboard is blocked: nothing more to do
    }
    return;
  }
  await Share.share({ message: url });
}
