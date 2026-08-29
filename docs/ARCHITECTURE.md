# Architecture

QR Conquest is a single Flask application over SQLite, serving a vanilla
JavaScript client. There is no build step needed to run it, no message broker,
and no external service beyond the map tiles.

One constraint shapes a lot of the design: the players are children. There are
no player accounts - no usernames, passwords or email addresses - players are
issued a server-generated code name rather than asked for one, and a game's data
is treated as ephemeral, because a game lasts an hour or two and little of it
matters afterwards. Where a decision below looks like it is throwing data away,
that is why.

## The server

`flask_app.py` holds the whole server: the schema, every endpoint, the live-event
plumbing and the retention sweeper.

- **Database**: SQLite, with tables for hosts, games, teams, players, bases,
  captures, questions, answer_sessions, announcements and site_settings.
- **Authentication**: a bearer token for the site administrator, QR codes for
  hosts and players. See [Security model](SECURITY.md).

### Live events

Base captures, quiz outcomes, bonus collections and announcements reach every
player in a game by one of two routes:

1. **A WebSocket** (`flask-sock`, at `/ws/games/<game_id>`) pushes them the
   moment they happen.
2. **The game poll.** Where a socket cannot be held open - the client's network,
   or a host like uWSGI that gives flask-sock no socket to take over - the same
   events ride along on the client's five-second poll of the game, out of a short
   in-memory buffer the server keeps per game.

Each event carries a sequence number, so a client with both routes working
announces it once. `LIVE_EVENT_SOCKET=off` skips the socket entirely; nothing is
lost but a few seconds of latency.

Because the buffer and the socket registry live in process memory, the app runs
as a single worker process.

### Quiz capture

An optional per-game mode. GPS proximity opens a scan session of server-marked
questions; correct answers reduce, capture, neutralise or reinforce a base's
shield atomically, and wrong answers apply a game-wide cooldown to that player.
The correct answer never leaves the server.

### Player identity

A player is a row created when a device scans into a team: a UUID the device
keeps in `localStorage`, and an `adjective-animal` code name the server picks
(`generate_player_name`), unique within that game. Nothing is asked of the
player, and a name supplied by a modified client is ignored. The code name
exists so a host's roster can distinguish players and so an investigation after
the event has something to refer to - it is deliberately not an identity.

`players.id` is a primary key, so an id belongs to one game only; the client
clears its stored player id when it scans into a different game
(`clearGameState`), and the new join gets a fresh id and a fresh code name.
Nothing on the server links a player across games.

### Player positions

Players post their latest GPS fix while they play - one every 15 seconds at most.
Only the newest fix per player is stored, never a route, and it is served
exclusively to that game's host, so teams cannot track each other. Ending a game
deletes every stored position outright: the server stops accepting updates and
clears the last fix.

### Retention

A game is tidied when it ends and purged `GAME_RETENTION_DAYS` later (30 by
default). Games run for an hour or two, so the window is sized for someone
asking questions after the event rather than for keeping anything. The tidy
clears what only mattered during play - every player's last GPS fix, and any
quiz cooldown still running - while keeping the record a complaint would be
answered from: generated code names, team membership and join times, the
capture timeline, quiz sessions, and every word the host wrote, withdrawn
announcements included. The purge then deletes the game and all of it.
A background sweeper runs hourly, so a restarted server never sits on expired
data.

### Game export

`GET /api/games/<id>/export` returns the whole record of one game as a single
JSON file. It takes the admin bearer token, not a host id - a host cannot export.
Credentials are deliberately left out: no host ids, and none of the QR codes that
enrol a host, join a team or mark a base.

### Announcements

One-way, one-to-many messages from a host to everyone in their game. There is no
player-to-host, host-to-team or host-to-player channel, by design. Announcement
text is never put on the shared game socket - anyone who knows a game's id can
listen to it - so the socket only says that something new exists and players
fetch the text from their own endpoint. A read marker per player drives the
unread count. A host can withdraw one they sent: a soft delete, so the row stays
with the time it was withdrawn and nothing serves it again.

### Abuse reporting

A single site-wide contact address, taken from `ABUSE_CONTACT_EMAIL` unless a
site administrator has overridden it in `site_settings`. It is injected into the
page shell alongside the debug flag, so the reporting link renders with the first
paint and needs no credential. The shell is stamped once, at load, and only by
the app - so the client also asks `GET /api/public-settings` after first paint
and corrects itself if the two disagree. That covers a tab left open across a
change of address, and a deployment serving `index.html` as a static file, where
the shell would arrive with its defaults and no reporting route at all. The same
endpoint carries the retention period the privacy notice quotes, for the same
reason.

### Game ids and payload scoping

A game is keyed by a random UUID. Nobody has to read the id out - the host
names the game, and players reach it by scanning a QR code - so it is not shown
anywhere in the UI.

The game payload is fetched without a credential, so the anonymous view carries
no player names or ids and none of the QR codes that join a team, whatever the id
in the path. A host sending its own host id in the `X-Host-ID` header gets those
fields for its own game.

### Game deletion

A host can only delete a game no player has joined. After that the game holds
other people's data, and deleting it takes the site administrator's bearer token
- the same endpoint, authorised differently.

### The bonus round

An optional post-game phase (game status `bonus`) where base-holding scores
freeze and teams collect base QR codes. A GPS-verified player scan marks a base
collected; a host scan confirms its return and awards fixed bonus points per base
(auto-sized when the round starts, so last place collecting everything would
win). The host can scan in any base - one that was never marked collected, or a
deleted one - to clear it from the map without awarding points.

## The client

Plain JavaScript, no framework, no bundler. The page shell is `static/index.html`
and the server rewrites it as it serves it.

| File | Responsibility | Contains |
|------|----------------|----------|
| `core.js` | API and state | Authentication state, QR handling, game APIs, polling, the live socket |
| `ui.js` | Player UI | Landing page, game view, map, scanner, announcements panel, privacy notice, abuse reporting, PWA plumbing |
| `host.js` | Host UI | Host panel, team and base forms, game settings, question bank |
| `site-admin.js` | Admin UI | Admin login, host management, game management, site settings |
| `dev-gps.js` | Developer tooling | GPS simulator and simulated scans; inert unless `DEBUG_FEATURES` is set |

UI files call the API through `core.js`; `core.js` reaches back into the UI
through `window.functionName`.

Notable pieces:

- **PWA**: installable, which is what gets the steadier GPS an installed app
  receives.
- **Maps**: Leaflet, with bases as circles in their owner's colour, the viewer's
  own position as a black arrowhead, and - for hosts, behind a "Show players"
  toggle - each player's last known position as a pin in their team colour.
- **Polling**: the game payload every 5 seconds, announcements every 10, player
  positions (hosts only) every 15.
- **App menu**: one button at the top right of every page holding the routes that
  are not for players - the host menu and site administration - with Privacy and
  Report abuse repeated beneath them, so reporting something does not mean
  scrolling a map to reach the footer. Built as a modal: full-width rows are a
  better tap target on a phone than a dropdown.
- **Privacy notice**: shown in full on the join page and as a modal before the
  browser is ever asked for a position. Quotes the deployment's own
  `GAME_RETENTION_DAYS`.
- **Host contact number**: an optional per-game number, shown to that game's
  players as a `tel:` link. Deliberately kept out of the game payload, which
  takes no credential: the host reads their own number there, players get it from
  `/api/players/<id>/announcements`, which is keyed on a player id, and nobody
  else is served it at all.

## Keeping clients up to date

The page shell is served with `Cache-Control: no-store`, and every asset URL in
it - the app's own scripts and stylesheet as well as the vendored libraries -
carries a `?v=` stamp taken from the newest modification time under `static/`. A
deploy changes that stamp, so the next page load asks for new files rather than
reusing whatever the browser already has.

This matters because the app is a long-lived page on phones that are rarely
closed. Without the stamp a host could sit on a months-old `core.js`, calling
endpoints the server has since moved, and see an unexplained error rather than
anything that says "your app is out of date". If a client still looks stale after
a deploy, a hard reload (or clearing the site's data) is enough - there is no
service worker to unregister.

## Front-end libraries

Tailwind, Leaflet, Lucide, jsQR and QRCode.js are served from `static/libs/`
rather than a CDN. Players are usually outdoors on patchy mobile data, and a
blocked or slow CDN previously took the styling, the map or the QR scanner down
with it. The only third-party request left in normal play is the OpenStreetMap
tiles the map needs - which is why the privacy notice names OpenStreetMap and
says what their servers can tell from the request. The vendored copies are
committed, so running the app still takes nothing more than Python.

| Library | Vendored as | Version |
|---------|-------------|---------|
| Tailwind CSS | `static/libs/tailwind.css` (prebuilt) | 3.4.19 |
| Leaflet | `static/libs/leaflet.js`, `leaflet.css`, `images/` | 1.9.4 |
| Lucide icons | `static/libs/lucide.min.js` | 1.34.0 |
| QRCode.js | `static/libs/qrcode.min.js` | 1.0.0 |
| jsQR | `static/libs/jsQR.js` | vendored before the tooling existed |

Tailwind used to run from the Play CDN, which compiled classes in the browser on
every page load; it is now built ahead of time into a stylesheet of about 29 KB.
**After adding new Tailwind classes to the front end, rebuild it:**

```bash
npm install       # dev tooling only - not needed to run the game
npm run build:css
```

The build scans `static/*.html`, `static/*.js` and `static/code-generator/*.html`
for class names (see `tools/tailwind.config.js`), so a class has to appear as a
literal string somewhere in the source. Team colours are additionally safelisted,
because they are stored per team in the database.

To upgrade a library, bump its version in `package.json` and run `npm run
vendor`, which recopies the files and rebuilds the stylesheet.

## The app icon

The logo in `static/icons/` is a castle keep whose walls enclose a real QR code -
the module pattern is the genuine version-2 QR for `QRCONQUEST` at the highest
error-correction level, so it carries a real code's irregular clustering rather
than a hand-drawn grid, and the gate is punched out of it on module boundaries.
It is drawn in the game's own purple with the gold used for flags elsewhere in
the app, and nothing in it relies on the page behind it, so it reads on a light
or a dark background equally well.

`static/icons/icon.svg` is the source; `tools/generate-icon.py` draws it
(`pip install segno`). The two PNGs are rendered from that SVG on a `#F5F3FF`
field, sized so the keep stays inside a maskable icon's safe zone - the recipe is
in the script's docstring.

## The QR code system

- **Host enrolment**: a unique secret link per host account.
- **Team codes**: a UUID linking to one team in one game.
- **Base codes**: a UUID linking to one physical location in one game.
- **URL format**: `https://yoursite.example/?id=<code>`.
- **Sent with the action, not just resolved once**: scanning a code looks up what
  it points at, and the code then travels with the join or capture request
  itself, so the server can confirm the scan really happened. See
  [Security model](SECURITY.md).

## Development setup

1. Fork and branch.
2. Run the app locally with `DEBUG_FEATURES=true` and use the GPS simulator -
   see [Deployment](DEPLOYMENT.md#testing-without-a-park) - to play through
   joining, capture, quiz sessions and the bonus round without leaving your desk.
3. Test all three roles: player, host and site administrator.
4. Rebuild the stylesheet if you added Tailwind classes.
5. Open a pull request describing what changed and how you exercised it.

### Demo data

Clicking a testable game together by hand takes twenty minutes, so there is a
seeder:

```bash
SITE_ADMIN_PASSWORD=devpass python flask_app.py &
SITE_ADMIN_PASSWORD=devpass python tools/seed-demo-game.py
```

It creates a host, a question bank, a running game with three teams, six bases,
eight players and a scoreboard with a history, and a second game with quiz
capture on. It prints the URLs that enrol the host and join each team - open one
in a browser and you are in a game that looks like a real one. Everything it
makes lives in `qr_game.db`, so deleting that file undoes it.

Backdating the captures - which is what makes the scoreboard non-zero - is the
one thing the seeder does behind the API's back, by writing to the SQLite file
directly. `--no-backdate` keeps every write on the API.

### Regenerating the screenshots

The images in `docs/images/` are taken from that seeded game by driving a real
browser:

```bash
pip install playwright && playwright install chromium
SITE_ADMIN_PASSWORD=devpass python tools/capture-screenshots.py
```

It writes all seventeen under the names the documentation expects, moving the
game into its bonus round and ending the quiz game partway through to reach the
states the later shots need. Re-seed a fresh database before running it again.
`--only <shot>` re-takes one, and `--tiles` lets OpenStreetMap load into the
maps, which the committed images deliberately leave out.

If you change a screen the documentation illustrates, re-take its screenshot in
the same commit. That is the whole reason the script is in the repository.

## Known limitations

- Single server instance; no clustering. The live-event buffer and socket
  registry are per-process.
- SQLite, so not suited to high concurrency.
- Error handling is basic in places, and reads better in the console than on the
  screen.
- Abuse reporting is a published email address, not an in-app report form, and a
  site administrator's moderation tools stop at exporting or deleting a whole
  game. A host can withdraw their own announcements; nobody else can. See
  [Legal responsibilities](COMPLIANCE.md).
- Game customisation is limited to the settings listed in
  [Hosting a game](HOSTING.md#game-settings).
- No game history or analytics beyond the export.
