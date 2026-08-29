# Troubleshooting

Grouped by who hits the problem. Player problems are usually the phone; host
problems are usually a rule the game is enforcing; deployment problems are
usually the way the app is being served.

## Players

**The camera will not open.**
Browsers only hand the camera to a secure page, so the site has to be on HTTPS
(or `localhost`). If it is, the permission was probably declined once - reset it
in the browser's site settings and reload. Failing that, the scanner has a box
underneath it to type the code's value in by hand; codes printed with **Show
URL** carry that value under the code.

**A code will not scan.**
Get more light on it, hold the phone steady and a hand's width away, and check
the code itself is not creased, wet or behind reflective glass. A code that has
been damaged past reading is a host problem - they can restore the base onto a
fresh code.

**A capture will not register.**
Three things have to line up: the right code, a game that is running, and your
position inside the capture radius. Give the GPS a few seconds to settle, and
stand at the base rather than across the path from it. Under tree cover or
between tall buildings a phone can be tens of metres out; ask your host to widen
the capture radius if a base is in a bad spot.

Installing the game to your home screen when the browser offers gets you steadier
positioning than a browser tab.

**The map is grey but the game still works.**
Map pictures come from OpenStreetMap over the internet. On a patchy connection
they are the first thing to go. Bases, scores and captures come from the game
server, so the game keeps working - you are just navigating without a backdrop.

**"You are offline".**
The app says so when the phone loses its connection, and picks up again by
itself. Captures made while offline do not register; scan again once you are
back.

## Hosts

**The game will not start.**
- At least two teams have to exist.
- With quiz capture on, at least one selected category has to contain at least
  one active question.
- Your host access has to be valid - if it has expired, your site administrator
  can extend or rotate it.

**A QR code is refused when I scan it.**
Each code can be one thing at a time. The message says whether it is already a
team, a base or a host. Ending a game releases all of its codes for reuse, and
deleting a team nobody joined frees that team's code immediately.

**A player cannot join.**
Players can join at any point until the game ends - joining late is fine. If a
join fails, check the code is the team's code from *this* game, and that the game
has not already ended. Re-scanning after a refresh clears most of it.

**A base is in the wrong place.**
**Edit** the base and correct its position, or delete and re-add it by scanning a
code where the base actually stands. GPS at the moment of the original scan is
what set it, so a base created while walking past can end up in a hedge.

**A base code has been stolen or destroyed.**
Delete the base to take it out of play, then use **Show deleted** and **Restore**
when you have a replacement code: scan the new code and the base comes back with
its captures and points intact.

**Scores look wrong.**
Points accrue per interval of holding, not per capture, so a team that took one
base early can be ahead of a team that took three late. The interval is in the
game settings.

**I cannot delete a game.**
Once a player has joined, the game holds their data and its own history, and only
a site administrator can delete it. Ending the game is what closes it down.

## Site administrators and deployments

**The admin panel hangs, or the page never finishes loading.**
On a host that answers one request at a time (uWSGI on shared hosting), a client
that is holding a connection open starves everything else. Set
`LIVE_EVENT_SOCKET=off` so clients stop attempting a WebSocket that cannot work
there - see [Deployment](DEPLOYMENT.md#on-a-host-that-serves-one-request-at-a-time).

**Live capture notifications are slow.**
Without the WebSocket, events ride the five-second game poll, so they arrive a
moment later. That is the expected behaviour with `LIVE_EVENT_SOCKET=off`, and
the fallback whenever a socket cannot be held open.

**No "Report abuse" link appears anywhere.**
No address is configured. Set one under **Site Settings** in the admin panel, or
in `ABUSE_CONTACT_EMAIL`.

**The privacy notice quotes the wrong retention period, or the reporting address
is stale.**
Both are stamped into the page shell as the app serves it. If `/` is being served
as a static file - a PythonAnywhere static mapping, an nginx `try_files`, a CDN
in front of the app - none of that stamping happens. View source on the homepage:
`window.QRC_ASSET_VERSION` should carry a number rather than `""`. See
[Deployment](DEPLOYMENT.md#serve-indexhtml-through-the-app-not-as-a-static-file).

**Clients are running old JavaScript after a deploy.**
Asset URLs are stamped with the newest modification time under `static/`, so this
usually means the shell is not coming from the app (see above). A hard reload, or
clearing the site's data, fixes an individual device. There is no service worker
to unregister.

**Where the errors are.**
- Server: the process output. Running `python flask_app.py` directly starts
  Flask's development server, which already includes the debugger and the
  reloader; under Gunicorn or uWSGI, look at that server's log.
- Client: the browser console (F12 on a desktop). The Network tab shows each API
  call and its response.
- On a phone, set `DEBUG_FEATURES=true` on a test deployment to get an on-screen
  console.
