# file: README.md
# 🌙 LunaLog — Bound By Will

LunaLog is a **Community Memory + Profile** bot (NOT moderation, NOT music, NOT leveling).
It tracks moments and patterns automatically, and provides these slash commands:

- `/about user:@User`
- `/moments [user:@User]`
- `/setvibe chat game movie music`

---

## Setup (Windows)

### 1) Create a Discord application + bot
1. Go to Discord Developer Portal → New Application
2. Create a Bot (Add Bot)
3. Copy:
   - **Bot Token** → `DISCORD_TOKEN`
   - **Application ID** → `CLIENT_ID`

### 2) Enable privileged intents
In the Bot settings, enable:
- **Server Members Intent**
- **Message Content Intent**
- **Presence is NOT required**
Also ensure:
- **Voice States** events are enabled (Voice intent is handled by Gateway Intents)

### 3) Invite the bot to your server
OAuth2 → URL Generator:
- Scopes: `bot`, `applications.commands`
- Bot permissions: minimal is fine (Read Messages, View Channels, Send Messages, Embed Links, Read Message History; plus Connect/View Channels for voice tracking visibility)

### 4) Configure environment
Copy `.env.example` → `.env` and fill values.

### 5) Install, build, register commands, start
```powershell
npm install
npm run build
npm run register-commands
npm start