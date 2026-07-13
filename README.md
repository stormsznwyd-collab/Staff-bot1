# Staff Management Discord Bot

A staff-management bot built with Node.js, discord.js v14, and SQLite. Covers LOA management,
staff strikes, a VC-gated clock-in/out duty system, promotions, staff-hours reporting, and a
live bot status panel — all with advanced embeds, buttons, and a "Made by Foot Tickler" watermark
on every embed footer.

---

## 1. What's included

| System | Commands | Notes |
|---|---|---|
| LOA | `/loaacc`, `/loaend`, `/loalist`, `/loahistory` | Auto-creates a gold, hoisted, mentionable **Staff LOA** role |
| Strikes | `/strike`, `/strikeboard all`, `/strikeboard user` | Strike 1 / Strike 2, optional auto-role per strike level |
| Promotions | `/promote`, `/demote`, `/promohistory` | Supports up to 3 roles added/removed at once |
| Duty / clock-in | Buttons on the `/dutyboard` panel | VC-gated clock-in, 2-minute DM warning + auto clock-out |
| Staff hours | `/staffhours setrequirement`, `/staffhours run` | Per-rank hour requirements, auto weekly report + top-hours shoutout |
| Bot status | `/statuspanel` | Live uptime/ticket/LOA panel with Restart, Clear LOA, Fix Commands, Fix All Commands buttons |
| Config | `/config set\|get\|list`, `/permission add\|remove\|list` | Lets you plug in channel/role IDs and whitelist roles without touching code |
| Setup | `/setup` | One-time: creates the LOA role, seeds your duty VC + staff-hours channel IDs |

Every embed footer reads **"Made by Foot Tickler"** (with extra context appended after a `•` where relevant) — that's the bottom-left watermark you asked for; Discord always renders embed footers.

---

## 2. Project structure

```
.
├── package.json
├── .env.example
├── README.md
├── src/
│   ├── index.js              # bot entry point
│   ├── deploy-commands.js    # registers slash commands
│   ├── database/
│   │   ├── db.js             # SQLite connection + config/permission helpers
│   │   └── schema.sql        # table definitions
│   ├── handlers/
│   │   ├── commandHandler.js # loads every command file
│   │   └── eventHandler.js   # loads every event file
│   ├── services/             # all business logic lives here
│   │   ├── loaService.js
│   │   ├── strikeService.js
│   │   ├── promotionService.js
│   │   ├── dutyService.js
│   │   ├── dutyBoardService.js
│   │   ├── statusPanelService.js
│   │   ├── staffHoursService.js
│   │   ├── appealService.js
│   │   ├── cardService.js
│   │   ├── banLogService.js
│   │   ├── blacklistService.js
│   │   ├── notesService.js
│   │   ├── loaRequestService.js
│   │   └── More services as needed
│   ├── events/
│   │   ├── ready.js
│   │   ├── interactionCreate.js
│   │   └── voiceStateUpdate.js
│   ├── commands/
│   │   ├── staff/
│   │   ├── duty/
│   │   ├── admin/
│   │   ├── config/
│   │   ├── appeals/
│   │   └── ... other command folders
│   ├── assets/
│   │   └── appeals/    (card templates)
│   │   └── fonts/      (TTF fonts)
│   └── utils/
│       ├── logger.js
│       ├── embeds.js
│       ├── permissions.js
│       └── duration.js
└── data/                # created automatically: bot.sqlite + logs/
```

Adding a new command is just adding a new file to the right `commands/` subfolder — the handler picks it up automatically on next boot (or via the **Fix All Commands** button).

---

## 3. Setup

### 3.1 Discord Developer Portal
1. Go to https://discord.com/developers/applications → New Application.
2. **Bot** tab → Reset Token → copy it (this is `DISCORD_TOKEN`).
3. Under **Bot**, enable these **Privileged Gateway Intents**: `SERVER MEMBERS INTENT`, `MESSAGE CONTENT INTENT`.
4. **OAuth2 → URL Generator**: scopes `bot` + `applications.commands`. Permissions: Administrator is
   simplest while testing, or at minimum: Manage Roles, Manage Channels, Send Messages, Embed Links,
   Read Message History, Connect/View Voice Channels.
5. Copy your Application ID (`CLIENT_ID`) from the **General Information** tab.
6. Invite the bot to your server with the generated URL.

**Important:** the bot's own role must sit **above** every role it needs to assign/remove (LOA role,
strike roles, promotion/demotion roles) in Server Settings → Roles.

### 3.2 Install
```bash
git clone https://github.com/stormsznwyd-collab/Staff-bot1.git staff-bot
cd staff-bot
npm install
cp .env.example .env
```

Fill in `.env`:
```
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_id
GUILD_ID=your_server_id   # for instant command updates while testing; remove once live
```

### 3.3 Deploy commands & run
```bash
npm run deploy   # registers all slash commands
npm start        # starts the bot
```

### 3.4 In Discord
1. Run `/setup` (Administrator only). This creates the **Staff LOA** role and pre-fills channel IDs.
2. Run `/statuspanel` in the channel you want the live bot-status panel.
3. Run `/dutyboard` in the channel you want the live clock-in/out board.
4. Run `/permission add command:<name> role:<role>` for each command to whitelist staff roles.
5. Configure additional settings with `/config set`.

---

## 4. Hosting

Options, cheapest/simplest first:

- **Your own PC (free, but only online while your PC is):**
  ```bash
  npm install -g pm2
  pm2 start src/index.js --name staff-bot
  pm2 save
  pm2 startup   # follow the printed instructions so it survives reboots
  ```
- **A cheap VPS** (Hetzner, DigitalOcean, Contabo, etc. — a $4-6/mo box is plenty): same `pm2` steps as above.
- **Railway / Render** — connect the GitHub repo, set environment variables from `.env`, deploy.

---

## 5. Features

- **LOA Management**: Auto-creates staff roles, tracks leave
- **Staff Strikes**: Strike system with role assignment
- **Duty Board**: VC-gated clock-in/out with automatic warnings
- **Ban Appeals**: Themed appeal cards with dropdown workflow
- **Staff Hours**: Leaderboards and per-rank requirements
- **Live Status Panel**: Real-time uptime and stats
- **Logging & Error Handling**: Comprehensive logging to `data/logs/`

---

## 6. Support

For issues, questions, or feature requests, please open an issue on GitHub.
