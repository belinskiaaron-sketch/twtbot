# Claude AI iOS Showcase

A React Native (Expo) app demonstrating Claude's core capabilities on iOS.

## Capabilities

| Tab | What it shows |
|-----|---------------|
| **Chat** | Multi-turn conversation, context-aware replies, starter prompts |
| **Analyze** | Sentiment score, key themes, tone, readability — rendered as cards |
| **Generate** | Tweet / Headline / Story / Email / Bio — mode-picker + example topics |
| **Code** | Explain / Review / Convert / Document — monospace editor, language picker |

## Quick start

```bash
cd ios-showcase
npm install
# copy and fill in your key, or enter it in-app
cp .env.example .env
npm start          # opens Expo DevTools
```

Press `i` to open in the iOS Simulator, or scan the QR code with **Expo Go** on a real device.

## API key

The app prompts for your Anthropic API key on each screen if it isn't pre-seeded via `EXPO_PUBLIC_ANTHROPIC_API_KEY`. The key is stored only in component state — never persisted to disk or transmitted anywhere except the Anthropic API.

## Tech stack

- **Expo SDK 51** + **Expo Router** (file-based navigation)
- **React Native 0.74** + TypeScript
- `expo-blur` for the translucent iOS tab bar
- `expo-linear-gradient` for capability card backgrounds
- `expo-haptics` for success feedback on generation
- Direct `fetch` calls to `api.anthropic.com/v1/messages`
