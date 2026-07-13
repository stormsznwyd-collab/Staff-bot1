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

---

## 8. Ban Appeal System (new)

A full ban-appeal workflow with four themed cards (matching the SnoopLife designs) driven by a
single **staff status dropdown**: **In Progress → Accepted / Denied / Anti-Cheat**. Whatever status
staff pick, the member is DM'd the matching card automatically.

### Commands
| Command | Who | What it does |
|---|---|---|
| `/appealpanel` | Admin | Posts a public **Submit Ban Appeal** button. Users click → fill a form (ban reason, appeal, evidence). |
| `/banappeal open user:@x [ban_reason] [appeal] [evidence]` | Staff | Opens a case and posts the **management panel + dropdown** for staff to decide. |
| `/banappeal anticheat user:@x [detection] [appealable]` | Staff | Instantly issues an anti-cheat ban card and DMs the user. |
| `/banappeal status user:@x` | Staff | Shows a user's latest appeal + current status. |
| `/banappeal list` | Staff | Lists all pending appeals. |

### The dropdown
Every appeal management message carries a dropdown with four options — **In Progress / Pending**,
**Accepted**, **Denied**, **Anti-Cheat Ban**. Selecting one:
1. Updates the case status in the database.
2. DMs the member the matching themed card (`Hello @user, …`), with case ID, reviewer, and status bar.
3. Rewrites the management panel to show the new status and who set it.
Denials automatically stamp a **reapply cooldown** (default 7 days) that blocks new submissions until it expires.

### Built-in safeguards
- **Duplicate block** — a user can't submit a second appeal while one is pending.
- **Cooldown block** — after a denial, new appeals are blocked until the cooldown passes.
- **Closed-DM handling** — if the member's DMs are closed, staff get told the notice couldn't be delivered.

### Config keys
```
/config set key:appeal_channel_id       value:<channel id>   # where appeals/panels are posted for staff
/config set key:appeal_cooldown_days     value:7              # reapply cooldown after a denial (default 7)
/config set key:appeal_ping_role_id      value:<role id>      # optional: role pinged on each new appeal
# optional card artwork — drop in the 4 PNGs as image URLs to reproduce the exact card graphics:
/config set key:appeal_banner_pending    value:<image url>
/config set key:appeal_banner_accepted   value:<image url>
/config set key:appeal_banner_denied     value:<image url>
/config set key:appeal_banner_anticheat  value:<image url>
```

**Note on the artwork:** Discord embeds can't render the custom fonts, gradients, and bat/skyline graphics
natively, so the themed cards use a matching colour bar + author block + fields. If you want the exact
card art from your image, host each of the four PNGs and set the `appeal_banner_*` keys above — the bot
will drop the art in as the embed image beneath the text.

### Setup
1. `/config set key:appeal_channel_id value:<your appeals-review channel id>`
2. `/permission add command:banappeal role:@Staff`
3. `/appealpanel` in your public appeals channel (for the submit button).

---

## 9. Personalized Appeal Card Images (exact-art mode)

The appeal DMs can look **exactly like the SnoopLife cards** (graffiti wordmark, glow, bats, skyline)
instead of plain embeds. This works by generating an image per message: the bot loads the card
template art and **draws the real username onto it** (`Hello Slatt_Mike,`), then posts the PNG.

### Enable it
```bash
npm install @napi-rs/canvas
```
That's it. On the next start the bot auto-detects the package and switches appeal DMs from embeds to
card images. If the package isn't installed, everything still works — it just falls back to the themed
embeds. Toggle per-server with:
```
/config set key:appeal_use_cards value:false   # force embeds even if canvas is installed
```

### What ships by default
- `src/assets/appeals/{accepted,denied,anticheat,submitted}.png` — the four card templates.
- `src/assets/fonts/body.ttf` + `body-bold.ttf` — the font used to draw the username.
- `src/assets/appeals/layout.json` — where the name is drawn on each card.

### Make it pixel-perfect to YOUR art
The bundled templates already have the body text baked in, so the bot only redraws the
`Hello {user},` line over the placeholder. For the cleanest result:
1. Replace the four PNGs in `src/assets/appeals/` with your own card art.
2. Drop your real body font into `src/assets/fonts/body.ttf` / `body-bold.ttf` so the drawn
   username matches the card's font exactly.
3. Adjust `layout.json` per card:
   - `cover` — the box painted over the baked `Hello {user},` line.
   - `bgSample` — a clean background pixel the bot samples to refill that box.
   - `pos` — top-left where `Hello NAME,` is redrawn.
   - `fontSize`, `hello`, `name` — text size and colours (`rgb(r,g,b)`).

The username auto-shrinks to fit if it's long, so it never overflows the card.

> Tip: if you export templates **without** the `Hello {user},` line baked in (just a clean gap),
> set `cover` to that gap and the redraw will be seamless on every name.

---

## 10. Additional Commands (new)

Twelve commands across self-service, duty, records, and bans.

### Self-service
| Command | Who | What |
|---|---|---|
| `/mystats` | Staff | Your own hours, strikes, LOA and rank history in one card (ephemeral). |
| `/roster` | Staff | Staff grouped by rank with live status — 🟢 on duty · ☕ break · 🌴 LOA · ⚪ offline. Needs `rank_role_ids`. |
| `/loarequest [duration] [reason]` | Staff | Request an LOA; a lead approves/denies via button, which then activates the LOA automatically. |

### Duty
| Command | Who | What |
|---|---|---|
| `/leaderboard [period]` | Staff | Ranked duty-hours board over 7/14/30 days. |
| `/shifts [user]` | Staff | Recent clock-in/out sessions with worked time (defaults to you). |
| `/forceclockout user` | Admin | Manually close a stuck duty session. |

### Records
| Command | Who | What |
|---|---|---|
| `/strikeremove user [number]` | Staff | Remove a strike (and its role); fills the gap where strikes could only be added. |
| `/note add\|list\|remove` | Staff | Informal notes below the strike threshold. |
| `/record user` | Staff | Combined staff file: strikes + notes + LOA + promotions + 30-day hours. |

### Bans
| Command | Who | What |
|---|---|---|
| `/banlog add\|view` | Staff | Record bans so appeals can reference them. `/banappeal open` now auto-fills the ban reason from the latest log entry. |
| `/appealhistory user` | Staff | Full per-user ban-appeal history. |
| `/blacklist add\|remove\|check\|list` | Staff | Persistent server blacklist registry. |

### New config keys
```
/config set key:rank_role_ids            value:<roleId1>,<roleId2>,…   # roster order, highest → lowest
/config set key:loa_request_channel_id   value:<channel id>            # where /loarequest posts for approval
/config set key:loa_request_ping_role_id value:<role id>               # optional lead ping on new requests
```

### Whitelist the new commands
```
/permission add command:mystats role:@Staff
/permission add command:roster role:@Staff
/permission add command:loarequest role:@Staff
/permission add command:leaderboard role:@Staff
/permission add command:shifts role:@Staff
/permission add command:strikeremove role:@Staff
/permission add command:note role:@Staff
/permission add command:record role:@Staff
/permission add command:banlog role:@Staff
/permission add command:appealhistory role:@Staff
/permission add command:blacklist role:@Staff
# /forceclockout is Admin-only by default
```
