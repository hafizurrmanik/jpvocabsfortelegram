# JP Vocabs — Telegram Mini App

Standalone, mobile-first vocabulary flashcards (JLPT N5 + N4). Plain HTML/CSS/JS, no build step, no backend.
Your original site files are untouched — this lives in its own folder.

## Files
- `index.html` — page shell
- `css/style.css` — styles (follows Telegram theme colours, light/dark, safe areas)
- `js/data.js` — vocabulary, copied unchanged from your original `app.js` (`ALL.N5.vocab`, `ALL.N4.vocab`)
- `js/telegram.js` — safe Telegram WebApp bridge (works without Telegram too)
- `js/app.js` — UI and logic

## Upload to GitHub
1. Open https://github.com/hafizurrmanik/learn-Japanese- → **Add file → Upload files**.
2. Drag the whole `miniapp` folder in (keep the `css/` and `js/` sub-folders).
3. Commit. Your original `index.html`, `app.js`, `style.css` stay as they are.
4. Wait ~1 minute, then open: **https://hafizurrmanik.github.io/learn-Japanese-/miniapp/**

## Connect to Telegram (BotFather)
1. Open @BotFather → `/newbot` (or pick an existing bot with `/mybots`).
2. `/mybots` → your bot → **Bot Settings → Menu Button → Configure menu button**.
3. Send the URL `https://hafizurrmanik.github.io/learn-Japanese-/miniapp/` and a button title, e.g. `JP Vocabs`.
4. Optional: `/newapp` to create a shareable Mini App link (t.me/yourbot/appname) with the same URL.
5. Never put the bot token in these files — the app does not need it.

## Test
- iPhone / Android: open your bot in Telegram → tap the menu button. Check light and dark mode (change Telegram's theme), rotate, flip/swipe cards, close and reopen (progress should remain).
- Safari / Chrome: open the GitHub Pages URL directly — it works without Telegram.
- Desktop: open `index.html` locally; use ← → arrow keys and Space.
- If you update files and Telegram still shows the old version, close the Mini App fully and reopen (WebView cache), or add `?v=2` to the BotFather URL.

## Saved data (localStorage key `jpvocabs.v1`)
Learned words, favorites, last lesson/card, per-lesson position; N5 and N4 are stored separately.
Progress is per browser/device (Telegram's WebView keeps its own storage, separate from Safari/Chrome).
