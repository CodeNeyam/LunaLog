# 🌙 **LunaLog — Bound By Will**

### *Community Memory • Vibes • Journey*

---

## 🎨 PAGE 1 — INTRO

> **LunaLog** is a **Community Memory + Profile Bot**
> NOT moderation. NOT music. NOT leveling.

LunaLog quietly builds a **story of every member** in your server by tracking:

* 💬 Messages
* 🎙️ Voice sessions
* 🔗 Connections (mentions, replies, shared voice time)
* 🎭 Vibes (chat, game, movie, music)
* 📝 Personal moments you choose to save

---

## ✨ PAGE 2 — CORE FEATURES

### 🎴 Profile System

* Crew classification (🌙 Night / ☀️ Morning / ⚖️ Mixed)
* Manual + inferred vibes
* First memory in the server
* Most seen with (top connections)

### 🌙 Journey Timeline

* Joined server
* First & last message
* First & last voice session
* First & last connection
* Last seen activity

### 🎭 Vibe System

* Set your own vibe
* Automatic inference from channels + keywords
* Server-wide vibe map

### 🔗 Social Graph

* Tracks mentions, replies, VC overlap
* Ranks strongest connections

### 📝 Personal Moments

* Save your own highlights
* View & delete moments

### 🏆 Leaderboards

* Top chatters
* Top voice users
* Night crew
* Most social members

---

## 💬 PAGE 3 — SLASH COMMANDS

| Command            | What It Does                |
| ------------------ | --------------------------- |
| `/about @user`     | Show community profile card |
| `/moments [@user]` | Show journey timeline       |
| `/setvibe`         | Set your vibe               |
| `/seen @user`      | Show last activity          |
| `/link @user`      | Show connection stats       |
| `/top`             | Server leaderboards         |
| `/vibes`           | Vibe map                    |
| `/moment add`      | Save a moment               |
| `/moment list`     | List moments                |
| `/moment delete`   | Delete a moment             |

---

## 🧱 PAGE 4 — TECH STACK

* 🟢 **Node.js** 24.x
* 🔷 **TypeScript** 5.9.3
* 🤖 **discord.js** 14.25.1
* 🗄️ **better-sqlite3** 12.6.0
* 🔐 **dotenv** 17.2.3
* 🛡️ **zod** 4.3.5
* ♻️ **PM2** (background process manager)

---

## ⚙️ PAGE 5 — DISCORD SETUP

### Step 1 — Create Application

1. Go to **Discord Developer Portal**
2. Click **New Application**
3. Go to **Bot** → Click **Add Bot**

Copy:

* 🔑 **Bot Token** → `DISCORD_TOKEN`
* 🆔 **Application ID** → `CLIENT_ID`

---

## ⚡ PAGE 6 — INTENTS & PERMISSIONS

### Enable These Intents

* ✅ Server Members Intent
* ✅ Message Content Intent
* ❌ Presence Intent (not required)

### Bot Permissions

* View Channels
* Send Messages
* Embed Links
* Read Message History
* Connect (for voice visibility)

---

## 🌐 PAGE 7 — INVITE BOT

### OAuth2 → URL Generator

**Scopes**

* `bot`
* `applications.commands`

Invite the bot using the generated link.

---

## 📦 PAGE 8 — ENVIRONMENT SETUP

### Create Environment File

```powershell
copy .env.example .env
```

### Fill Values

```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_id_here
```

---

## 🏗️ PAGE 9 — INSTALL & BUILD

### Install Dependencies

```powershell
npm install
```

### Build Project

```powershell
npm run build
```

### Register Slash Commands

```powershell
npm run register-commands
```

---

## ▶️ PAGE 10 — RUN BOT

### Development Mode

```powershell
npm run dev
```

### Production Mode (Recommended)

```powershell
npm start
```

---

## 🔁 PAGE 11 — RUN IN BACKGROUND (PM2)

### Install PM2

```powershell
npm install -g pm2
```

### Start LunaLog

```powershell
pm2 start "cmd.exe" --name lunalog -- /c "npm run start"
```

### Save Process

```powershell
pm2 save
```

---

## ♻️ PAGE 12 — AUTO START ON BOOT

### Create Startup Script

Create file:

```
C:\Users\YourUser\pm2-startup.bat
```

Content:

```bat
@echo off
"C:\Users\YourUser\AppData\Roaming\npm\pm2.cmd" resurrect
```

### Task Scheduler

1. Open **Task Scheduler**
2. Create Task → Name: `PM2 Resurrect`
3. Run whether user is logged on or not
4. Run with highest privileges
5. Trigger: **At startup**
6. Action:

   * Program: `C:\Windows\System32\cmd.exe`
   * Arguments:

     ```
     /c "C:\Users\YourUser\pm2-startup.bat"
     ```

---

## 🛑 PAGE 13 — STOP EVERYTHING

```powershell
pm2 stop lunalog
pm2 delete lunalog
pm2 save
pm2 kill
```

---

## 🔒 PAGE 14 — PRIVACY

LunaLog tracks:

* Activity timestamps
* Interaction counts
* Vibes & saved moments

LunaLog does **NOT**:

* Read private messages
* Store message content
* Record voice audio

---

## 🌙 PAGE 15 — PHILOSOPHY

> **LunaLog doesn’t track activity.**
> **It tells your story inside the server.**

---

## 📜 PAGE 16 — LICENSE

MIT License
Free to use, modify, and deploy.

---

### 🌌 END

**Welcome to LunaLog — where your community becomes a story.**
