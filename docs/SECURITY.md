# Security model

QR Conquest has no usernames and no passwords beyond the site administrator's.
Everything else is a QR code. That is a deliberate consequence of who plays:
the game is aimed at children, so the design goes out of its way to hold as
little about a player as it can. There are no player accounts to register, no
email addresses to collect and no credentials to store for anybody but the host
and the administrator.

This page sets out what that means: what counts as a credential, what the API
will and will not serve, and the one place where the model is knowingly weak.

## Three tiers

| Tier | Credential | How it is held |
|------|------------|----------------|
| Site administrator | `SITE_ADMIN_PASSWORD`, sent as a bearer token | An environment variable on the server; nothing is stored per-administrator |
| Host | A `qr_code` to enrol with, and a `host_id` the device keeps afterwards | In the host's browser storage, after scanning their secret link |
| Player | The team QR code they scanned, plus a `player_id` the device keeps | In the player's browser storage |

Host access can be time-limited with an expiry date, and both host secrets can be
replaced at once with **Rotate**.

## What the design holds to

**Credentials stay out of shared payloads.** A host's `host_id`, a team's QR code
and a player's id are credentials, so none of them appear in the game payload
that any caller can read. A game's id is a random UUID rather than a guessable
code, so the payload cannot be reached by walking the id space either - but it
is still scoped as though it could be, because that id travels to every player
device that scans in.

**Credentials stay out of URLs.** A host identifies itself with an `X-Host-ID`
header rather than a `?host_id=` query string or an id in the path, either of
which would be recorded in server and proxy access logs, in browser history, and
in the `Referer` header sent to anything the page links out to. Writes carry
their host id in the JSON body, which is not logged.

**A host addresses only its own data.** The endpoints a host uses live under
`/api/host/...` and carry no id at all - the header names whose question bank or
games are being read, so there is no id in the path that could disagree with the
credential, and nothing to guess but the credential itself. An unknown host id is
refused exactly like a missing one, so the API cannot be used to test whether a
host id is real. The remaining `/api/hosts/<host_id>/...` routes are the site
administrator's, authorised by the admin bearer token, where the id names which
record to manage rather than who is asking.

**A scan is proved by the code, not the id.** Joining a team, capturing a base
and collecting one in the bonus round are things a player earns by being handed a
team sheet or finding a base marker, so those endpoints carry the scanned QR code
and check it against the row the id in the path names. The id on its own proves
nothing: team ids and base ids travel in the game payload every player device
reads, so an id-only endpoint could be driven from an armchair by anyone already
in the game - one team's players could sign themselves onto another, and any base
on the map could be taken without walking to it.

A base capture needs the code **and** the GPS fix: the code proves the player
found the marker, the position proves they are standing at it now, and neither
substitutes for the other. Games set to let players pick their own team are the
one exception on joining - choosing from a list is the intended way in there,
though a code sent anyway is still checked. Bases the host scans back in during
the bonus round are not covered, because the host can read every code from its
own game payload and a check would add nothing.

**Credentials can be rotated.** Rotating a host replaces both the enrolment QR
code and the stored `host_id`, because replacing only the code would leave a
leaked id working forever. The host's games and question bank move across
unchanged.

## Known limitation: the enrolment link is a URL

A host enrols by opening `/?id=<qr_code>` - scanned from a printed code, or
followed from the secret link. The credential is therefore *in a URL*, which is
exactly what the rules above avoid everywhere else.

This is inherent to QR-based enrolment: with no usernames or passwords, the link
has to carry the secret, because the link **is** the credential. It is a
deliberate trade - hosts set up by pointing a camera at a poster instead of
managing accounts - and it is worth knowing where that secret can end up:

- **The host's browser history.** The app calls `history.replaceState` as soon as
  it reads the parameter, so the `?id=` entry is replaced rather than left
  behind, but a browser that syncs history across devices may already have taken
  a copy.
- **Server and proxy access logs.** `GET /?id=<qr_code>` and the
  `GET /api/qr-codes/<qr_code>/status` that follows it both appear in full in
  ordinary access logs. Anyone who can read those logs can enrol as that host. If
  you keep logs, treat them as holding credentials: restrict who can read them,
  and keep them no longer than you need.
- **Wherever the link was sent.** A secret link pasted into email or a group chat
  stays there, readable by anyone with access to that thread, long after the game
  ends.

`Referrer-Policy: no-referrer` is set on the page, so the credential is never
sent onward in a `Referer` header. Browsers already withhold it cross-origin by
default; the explicit policy makes that a guarantee rather than a default.

None of this is fixed by the routing rules above, and it cannot be while
enrolment stays QR-only. What makes it survivable is that the exposure is
**recoverable**: use **Rotate** to retire a link that has been over-shared or an
id that may have been read from a log, and set expiry dates so a forgotten link
stops working on its own.

## Data protection

- **Input validation** on every API input, and parameterised queries throughout,
  so a game or team name cannot reach the database as SQL.
- **HTTPS is required in practice**: browsers will not give a page the camera or
  precise location without it.
- **No personal data in anonymous responses.** Player code names, team QR codes
  and host ids are served only to the game's own host.

## Privacy

- **Players are told before they are asked.** A short privacy notice - written to
  be read by a ten-year-old, five points, no legal vocabulary - appears in full
  on the join page, and as a modal for anyone whose device is about to be asked
  for a position without having been through it. Nothing calls `watchPosition` or
  `getCurrentPosition` until it has been acknowledged on that device, so the
  notice cannot end up behind the browser's own location prompt. A **Privacy**
  link in the footer reopens it at any time.

  It is transparency, not consent: acknowledging it records nothing on the
  server, and it does not replace the privacy notice a deployment has to publish
  for itself - see [Legal responsibilities](COMPLIANCE.md).

- **Location data.** Only the newest fix per player is stored - never a route -
  and it is served exclusively to that game's host. Every stored position is
  deleted the moment the game ends.

- **Player code names** are generated by the server as an `adjective-animal`
  handle. Players never type one, so no player's real name is in the app. The
  handle is there to tell one player from another - on a host's roster, and in
  any debugging or investigation after the fact - rather than to identify a
  person. A new one is issued every time a device joins a game, and the device's
  stored player id is cleared at the same time, so nothing on the server ties a
  player's rows in one game to their rows in another.

- **Announcements** are written by the host for everyone in the game. The
  game-wide socket carries no announcement text - anyone who knows a game's id
  can listen to it, so the socket only says that something new exists and each
  player fetches the text from their own endpoint. A withdrawn announcement is
  soft-deleted: nothing serves it again, but the deployment can still answer for
  what was sent.

- **Retention.** Games are short - usually under two hours - and the data is
  treated as ephemeral. Ending a game clears the personal data play needed; the
  whole game is deleted after `GAME_RETENTION_DAYS`, sweeper-driven and
  automatic.

- **Third parties.** In normal play the only external request is to
  OpenStreetMap for map tiles, which is why the privacy notice names them and
  says what their servers can tell from the request. The opt-in debug console
  (`DEBUG_FEATURES`) also pulls Eruda from a CDN when a developer asks for it.

## Reporting a problem

If you have found a flaw in a running deployment, use the address it publishes
behind **Report abuse** - that reaches the administrator who can act on it. If
you have found one in the code, open an issue on the repository.
