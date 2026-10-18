# Card Link

A Linktree-style app built around a flip card. Pick a 3:2 or 2:3 card, make it yours, and share it by link or QR code.

- **Flip:** drag the card to turn it. A spring lands it on a face, a hard flick can spin it further, and it lifts toward you, casts a floor shadow and catches a sweep of light. Ported from Kokonut UI's Card Flip.
- **Tear to open:** write `@handle` in your bio and it becomes a ticket on the back. Grab the stub and tear it off the ticket to open that profile. The tear physics are ported from Kokonut UI's Tear Button.
- **Customise:** 3:2 or 2:3, primary and secondary colours (presets, swatches or any hex), three fonts, a Lucide avatar icon, up to three links, optional QR code.
- **Socials:** Instagram, TikTok, YouTube, GitHub, X, LinkedIn, WhatsApp (write `@60123456789`), or Other with any link you type in.
- **Stack:** Expo, Expo Router, Reanimated 4, Gesture Handler, Lucide icons.

## Run it
```bash
npm install
npx expo install --fix   # aligns every package to your Expo SDK
npx expo start
```
Judge the animation feel on a real device or release build, not Expo Go.

## Deploy to Vercel
Import the repo in Vercel. No local setup is needed. `vercel.json` makes Vercel run `npx expo install --fix` (so every package matches the Expo version) and then `npx expo export -p web`, serves the `dist` folder, and rewrites routes so `/card` links load.

## Project layout
```
app/          screens: index.tsx (editor), card.tsx (viewer), _layout.tsx
components/   FlipCard, TearButton, PressScale
lib/          card data, themes, link encoding, icon maps, link opener
```

## Notes
- The shared link and QR carry the card data itself (no backend). For short, easy-to-scan QR codes, change
  `cardToLink` / `linkToCard` in `lib/card.ts` to use a short hosted id.
- Lucide has no brand logos, so socials use neutral icons (`lib/icons.ts`).

## Using Kokonut's original Card Flip on a web project
Kokonut's component is DOM and Tailwind based, so it cannot run inside this Expo app; the app uses a port of its physics instead.
In a React project with shadcn and Tailwind set up:
```bash
npx shadcn@latest add https://kokonutui.com/r/card-flip.json
```
```tsx
import CardFlip from "@/components/kokonutui/card-flip";

<CardFlip
  axis="y"                       // "y" spins like a coin, "x" tumbles top over bottom
  front={<div className="p-5">Front</div>}
  back={<div className="p-5">Back</div>}
  onFlippedChange={(flipped) => console.log(flipped)}
/>
```
Other props: `flipped` / `defaultFlipped` (controlled or uncontrolled), `label`, `className`, `faceClassName`.

## Credits
The tear interaction (stick-slip perforation, swing, fall) and the card flip (drag, spring, lift, light) are ported from the Kokonut UI Tear Button and Card Flip by @dorianbaffier, MIT licence, https://kokonutui.com.

## Share links and install as an app
- Share links and QR codes are https links to this site (`/card?d=...`), so they open in Chrome or Safari with nothing installed.
- On the website the link uses the site's own address. In a native build, set `EXPO_PUBLIC_WEB_URL` (for example `https://your-app.vercel.app`).
- `public/manifest.json`, the icons and `public/index.html` make the site installable (Android: Chrome menu > Install app. iPhone: Safari Share > Add to Home Screen).
