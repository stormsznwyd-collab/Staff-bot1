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
| Config | `/config set|get|list`, `/permission add|remove|list` | Lets you plug in channel/role IDs and whitelist roles without touching code |
| Setup | `/setup` | One-time: creates the LOA role, seeds your duty VC + staff-hours channel IDs |

Every embed footer reads **"Made by Foot Tickler"** (with extra context appended after a `•` where relevant) — that's the bottom-left watermark you asked for; Discord always renders embed footers in that position.

---

## 2. Project structure

```
discord-bot/
├── package.json
├── .env.example
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
│   │   └── staffHoursService.js
│   ├── events/
│   │   ├── ready.js
│   │   ├── interactionCreate.js
│   │   └── voiceStateUpdate.js
│   ├── commands/
│   │   ├── staff/    (loaacc, loaend, loalist, loahistory, strike, strikeboard, promote, demote, promohistory, staffhours)
│   │   ├── duty/     (dutyboard)
│   │   ├── admin/    (statuspanel, setup)
│   │   └── config/   (config, permission)
│   └── utils/
│       ├── logger.js
│       ├── embeds.js
│       ├── permissions.js
│       └── duration.js
└── data/                      # created automatically: bot.sqlite + logs/
```

Adding a new command is just adding a new file to the right `commands/` subfolder — the handler
picks it up automatically on next boot (or via the **Fix All Commands** button).

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
git clone <wherever you put this> staff-bot
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
1. Run `/setup` (Administrator only). This creates the **Staff LOA** role and pre-fills:
   - Your 4 duty voice channel IDs (already baked in as the default)
   - The staff-hours channel ID you gave me (`1523883591317065801`)
2. Run `/statuspanel` in the channel you want the live bot-status panel.
3. Run `/dutyboard` in the channel you want the live clock-in/out board.
4. Run `/permission add command:<name> role:<role>` for each command, to whitelist which staff
   roles can use it (e.g. `/permission add command:loaacc role:@Management`). Until you whitelist a
   role, a command is Administrator-only by default — nothing is wide open by accident.
5. Once you have them, run:
   - `/config set key:ticket_category_id value:<category id>` — powers the open-ticket count on the status panel.
   - `/config set key:top_hours_channel_id value:<channel id>` — where the "top hours" shoutout posts.
   - `/staffhours setrequirement role:<rank role> hours:<n>` — for each rank, once you're ready.
   - `/config set key:strike_role_1 value:<role id>` / `strike_role_2` — if you want strikes to auto-apply a role.

---

## 4. How the trickier pieces work

**LOA duration:** `/loaacc user:@member duration:7d reason:vacation` — `duration` accepts combos like
`1d12h`, `2w`, `30m`. Leave it off entirely for an indefinite LOA.

**Clock-in VC gate:** clock-in only succeeds if you're currently connected to one of the configured
duty voice channels (`duty_vc_ids` in config, defaulted to the 4 IDs you gave me). If you leave the VC
while clocked in, you get DM'd a 2-minute warning; rejoin in time or you're auto clocked-out (and DM'd
again to confirm it happened).

**Live panels refresh every 5 seconds, not every 1 second.** Discord rate-limits message edits — a
1-second interval would get your bot rate-limited or flagged. 5 seconds is the fastest safe interval
that still feels live.

**Restart button:** the bot calls `process.exit(0)`. For it to actually come back up, you need a
process manager watching it (see hosting section below) — the bot itself can't relaunch its own process.

**Fix Commands vs Fix All Commands:** "Fix Commands" re-registers the currently loaded slash commands
with Discord (fixes a command that's gone missing/stale in the Discord UI). "Fix All Commands" also
reloads every command file from disk first, so it also picks up new files you've added since boot.

---

## 5. Hosting (you'll need real hosting — I can't host this for you)

I can build and hand you the code, but I don't have the ability to run a persistent server myself.
Options, cheapest/simplest first:

- **Your own PC (free, but only online while your PC is):**
  ```bash
  npm install -g pm2
  pm2 start src/index.js --name staff-bot
  pm2 save
  pm2 startup   # follow the printed instructions so it survives reboots
  ```
- **A cheap VPS** (Hetzner, DigitalOcean, Contabo, etc. — a $4-6/mo box is plenty): same `pm2` steps as above.
- **Railway / Render** — connect the GitHub repo, set the same environment variables from `.env`, deploy.

Whichever you pick, `pm2` (or the host's own restart policy) is what makes the **Restart** button
actually bring the bot back — the process manager restarts it after `process.exit(0)`.

---

## 6. Still to configure (send these whenever you're ready)

- [ ] Staff role IDs to whitelist per command (`/permission add`)
- [ ] Ticket category ID (`/config set key:ticket_category_id`)
- [ ] Top-hours announcement channel ID (`/config set key:top_hours_channel_id`)
- [ ] Per-rank hour requirements (`/staffhours setrequirement`)
- [ ] Strike role IDs, if you want strikes to auto-assign a role (`/config set key:strike_role_1` / `_2`)

Everything else — LOA, strikes, duty board, promotions, status panel — is fully working out of the box.

---

## 7. Logging & error handling

- Every command is wrapped in try/catch; errors reply with a clean embed and get logged, they never
  crash the bot.
- Logs are written to `data/logs/YYYY-MM-DD.log` and mirrored to the console.
- `unhandledRejection` / `uncaughtException` are both caught at the process level and logged instead
  of crashing silently.
