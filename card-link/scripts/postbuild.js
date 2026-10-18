// Runs on Vercel after `expo export`: copies public/ into dist/ and wires up the PWA tags.
const fs = require('fs');
const path = require('path');

const dist = 'dist';
if (fs.existsSync('public')) fs.cpSync('public', dist, { recursive: true });

const file = path.join(dist, 'index.html');
let html = fs.readFileSync(file, 'utf8');
const tags = `
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#000000">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<meta name="apple-mobile-web-app-title" content="Card Link">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<script>if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}</script>
`;
if (!html.includes('rel="manifest"')) html = html.replace('</head>', tags + '</head>');
fs.writeFileSync(file, html);
console.log('PWA files added to dist/');
