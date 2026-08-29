#!/usr/bin/env python3
"""Fill a local QR Conquest server with a demo game worth looking at.

Manual testing needs a game that has been running for a while - teams with
players, bases in several hands, a scoreboard that is not all zeroes - and
clicking one together takes twenty minutes every time. This does it in a second,
against a server running on localhost, and writes a JSON file naming everything
it made so a person (or tools/capture-screenshots.py) can drive the result.

    python flask_app.py &                     # in one terminal
    python tools/seed-demo-game.py            # in another

It creates, through the ordinary API:

  - a host account, and a question bank of seven questions in two categories
  - "Riverside Park Challenge": 3 teams, 6 bases, 8 players, 5 captures,
    one host announcement, a last known position per player, bonus round armed
  - "Quiz Trail: Nature and History": 2 teams, 3 bases, quiz capture on

Scores accrue per interval of holding a base, so a game seconds old scores
nothing. To give it a history the script then reaches past the API and edits
the SQLite file directly, backdating the start time and the captures, and
handing one quiz base to a team with a shield on it. That is the one thing here
no deployment should ever do; pass --no-backdate to skip it and keep every
write to the API.

Everything it writes goes into one server, one database file, and is undone by
deleting qr_game.db.
"""

import argparse
import json
import os
import sqlite3
import sys
import time
import urllib.error
import urllib.request
import uuid

QUESTIONS = [
    {"text": "Which tree does an acorn come from?", "type": "mc",
     "options": ["Oak", "Birch", "Willow"], "correct": 0, "category": "Nature",
     "explanation": "Acorns are the seed of the oak."},
    {"text": "A heron is a kind of fish.", "type": "tf", "correct": False,
     "category": "Nature", "explanation": "A heron is a bird that eats fish."},
    {"text": "How many legs does a spider have?", "type": "mc",
     "options": ["Six", "Eight", "Ten"], "correct": 1, "category": "Nature"},
    {"text": "Which of these is a deciduous tree?", "type": "mc",
     "options": ["Scots pine", "Silver birch", "Yew"], "correct": 1,
     "category": "Nature"},
    {"text": "The Great Fire of London happened in 1666.", "type": "tf",
     "correct": True, "category": "History",
     "explanation": "It began in a bakery on Pudding Lane."},
    {"text": "Who was the first person to walk on the Moon?", "type": "mc",
     "options": ["Yuri Gagarin", "Neil Armstrong", "Buzz Aldrin"], "correct": 1,
     "category": "History"},
    {"text": "Victorian mills were powered mainly by steam.", "type": "tf",
     "correct": True, "category": "History"},
]

TEAMS = [("Red Falcons", "bg-red-500"),
         ("Blue Herons", "bg-blue-500"),
         ("Green Foxes", "bg-green-500")]

# Offsets in degrees from the centre point, roughly 50-200 m out
BASES = [("Bandstand", 0.0006, 0.0009),
         ("Boathouse Steps", -0.0009, 0.0016),
         ("Oak Avenue", 0.0013, -0.0007),
         ("Cafe Corner", -0.0005, -0.0014),
         ("North Gate", 0.0019, 0.0004),
         ("Cricket Pavilion", -0.0016, -0.0002)]

PLAYER_SPREAD = [(0.0004, 0.0007), (-0.0007, 0.0013), (0.0011, -0.0005),
                 (-0.0003, -0.0011), (0.0016, 0.0002), (-0.0013, 0.0001),
                 (0.0002, 0.0004), (-0.0004, 0.0008)]

# base index -> team index. Leaves one base uncaptured, which is what a game in
# progress usually looks like.
CAPTURES = [(0, 0), (1, 0), (2, 1), (3, 1), (4, 2)]

ANNOUNCEMENT = ("The cafe is closed today, so the Cafe Corner base has moved to "
                "the bench by the gate. We finish at 3pm sharp.")


class Api:
    def __init__(self, base_url):
        self.base_url = base_url.rstrip("/")

    def __call__(self, method, path, body=None, headers=None):
        data = json.dumps(body).encode() if body is not None else None
        request = urllib.request.Request(self.base_url + path, data=data,
                                         method=method)
        request.add_header("Content-Type", "application/json")
        for key, value in (headers or {}).items():
            request.add_header(key, value)
        try:
            with urllib.request.urlopen(request) as response:
                raw = response.read().decode()
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as error:
            sys.exit(f"{method} {path} failed: {error.code} "
                     f"{error.read().decode()[:300]}")
        except urllib.error.URLError as error:
            sys.exit(f"Could not reach {self.base_url}: {error.reason}\n"
                     f"Is the server running?")


def code():
    """A stand-in for a printed code: the generator makes 11 characters too."""
    return uuid.uuid4().hex[:11]


def build_main_game(api, host, centre, phone):
    lat, lng = centre

    game_id = api("POST", "/api/games", {
        "host_id": host["id"], "name": "Riverside Park Challenge",
        "capture_radius_meters": 25, "points_interval_seconds": 15,
        "bonus_round_enabled": True, "host_phone": phone,
    })["game_id"]

    teams = []
    for name, colour in TEAMS:
        qr = code()
        team = api("POST", f"/api/games/{game_id}/teams",
                   {"name": name, "color": colour, "qr_code": qr,
                    "host_id": host["id"]})
        teams.append({"id": team["team_id"], "qr": qr, "name": name})

    bases = []
    for name, d_lat, d_lng in BASES:
        qr = code()
        base = api("POST", f"/api/games/{game_id}/bases",
                   {"name": name, "latitude": lat + d_lat,
                    "longitude": lng + d_lng, "qr_code": qr,
                    "host_id": host["id"]})
        bases.append({"id": base["base_id"], "qr": qr, "name": name,
                      "lat": lat + d_lat, "lng": lng + d_lng})

    players = []
    for team, count in zip(teams, (3, 3, 2)):
        for _ in range(count):
            player = api("POST", f"/api/teams/{team['id']}/join",
                         {"qr_code": team["qr"]})
            players.append({"id": player["player_id"],
                            "name": player["player_name"],
                            "team": team["id"]})

    api("POST", f"/api/games/{game_id}/start", {"host_id": host["id"]})

    for base_index, team_index in CAPTURES:
        base, team = bases[base_index], teams[team_index]
        player = next(p for p in players if p["team"] == team["id"])
        api("POST", f"/api/bases/{base['id']}/capture",
            {"player_id": player["id"], "latitude": base["lat"],
             "longitude": base["lng"], "qr_code": base["qr"]})

    api("POST", f"/api/games/{game_id}/announcements",
        {"host_id": host["id"], "body": ANNOUNCEMENT})

    for player, (d_lat, d_lng) in zip(players, PLAYER_SPREAD):
        api("POST", f"/api/players/{player['id']}/position",
            {"latitude": lat + d_lat, "longitude": lng + d_lng, "accuracy": 8})

    return {"id": game_id, "teams": teams, "bases": bases, "players": players}


def build_quiz_game(api, host, centre):
    lat, lng = centre
    game_id = api("POST", "/api/games", {
        "host_id": host["id"], "name": "Quiz Trail: Nature and History",
        "capture_radius_meters": 25, "points_interval_seconds": 15,
        "quiz_enabled": True, "active_categories": ["Nature", "History"],
        "max_shield": 5, "cooldown_seconds": 30,
    })["game_id"]

    teams = []
    for name, colour in TEAMS[:2]:
        qr = code()
        team = api("POST", f"/api/games/{game_id}/teams",
                   {"name": name, "color": colour, "qr_code": qr,
                    "host_id": host["id"]})
        teams.append({"id": team["team_id"], "qr": qr, "name": name})

    bases = []
    for name, d_lat, d_lng in BASES[:3]:
        qr = code()
        base = api("POST", f"/api/games/{game_id}/bases",
                   {"name": name, "latitude": lat + d_lat,
                    "longitude": lng + d_lng, "qr_code": qr,
                    "host_id": host["id"]})
        bases.append({"id": base["base_id"], "qr": qr, "name": name,
                      "lat": lat + d_lat, "lng": lng + d_lng})

    players = []
    for team in teams:
        player = api("POST", f"/api/teams/{team['id']}/join",
                     {"qr_code": team["qr"]})
        players.append({"id": player["player_id"],
                        "name": player["player_name"], "team": team["id"]})

    api("POST", f"/api/games/{game_id}/start", {"host_id": host["id"]})
    return {"id": game_id, "teams": teams, "bases": bases, "players": players}


def backdate(db_path, main, quiz):
    """Give the games a past, by editing the database the server owns.

    Nothing in the API can say "this capture happened forty minutes ago", and a
    game with no history shows a scoreboard of zeroes. This is a demo-data
    shortcut and nothing else - see the module docstring.
    """
    if not os.path.exists(db_path):
        sys.exit(f"No database at {db_path}. Pass --db, or --no-backdate to "
                 f"leave the games as they are.")

    now = int(time.time())
    conn = sqlite3.connect(db_path)
    conn.execute("UPDATE games SET start_time = ? WHERE id = ?",
                 (now - 2700, main["id"]))
    for seconds_ago, (base_index, _) in zip((2400, 2100, 1500, 900, 400),
                                            CAPTURES):
        conn.execute("UPDATE captures SET capture_time = ? WHERE base_id = ?",
                     (now - seconds_ago, main["bases"][base_index]["id"]))
    conn.execute("UPDATE announcements SET sent_at = ? WHERE game_id = ?",
                 (now - 1200, main["id"]))

    # One quiz base held by the second team, with a shield to wear down, so a
    # player scanning it meets a defended base rather than a neutral one.
    conn.execute("UPDATE games SET start_time = ? WHERE id = ?",
                 (now - 1200, quiz["id"]))
    conn.execute("UPDATE bases SET owner_team_id = ?, shield = 3 WHERE id = ?",
                 (quiz["teams"][1]["id"], quiz["bases"][0]["id"]))
    conn.execute("INSERT INTO captures (id, base_id, team_id, capture_time) "
                 "VALUES (?, ?, ?, ?)",
                 (str(uuid.uuid4()), quiz["bases"][0]["id"],
                  quiz["teams"][1]["id"], now - 900))
    conn.commit()
    conn.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--base-url", default="http://127.0.0.1:5000",
                        help="where the server is listening "
                             "(default: %(default)s)")
    parser.add_argument("--admin-password",
                        default=os.environ.get("SITE_ADMIN_PASSWORD"),
                        help="the site admin password the server was started "
                             "with (default: $SITE_ADMIN_PASSWORD)")
    parser.add_argument("--db", default="qr_game.db",
                        help="the server's SQLite file, for backdating "
                             "(default: %(default)s)")
    parser.add_argument("--out", default="demo-game.json",
                        help="where to write the ids and codes it created "
                             "(default: %(default)s)")
    parser.add_argument("--centre", default="55.94190,-3.19180",
                        help="lat,lng the bases are placed around "
                             "(default: %(default)s)")
    parser.add_argument("--phone", default="07700 900123",
                        help="host contact number published to players")
    parser.add_argument("--no-backdate", action="store_true",
                        help="skip the direct database edits, leaving both "
                             "games freshly started and scoreless")
    args = parser.parse_args()

    if not args.admin_password:
        sys.exit("Set SITE_ADMIN_PASSWORD or pass --admin-password.")

    try:
        lat, lng = (float(part) for part in args.centre.split(","))
    except ValueError:
        sys.exit("--centre wants lat,lng, for example 55.94190,-3.19180")

    api = Api(args.base_url)
    admin = {"Authorization": "Bearer " + args.admin_password}

    host = api("POST", "/api/hosts", {"name": "Riverside Youth Club"}, admin)
    api("POST", "/api/host/questions/bulk", {"questions": QUESTIONS},
        {"X-Host-ID": host["id"]})

    main_game = build_main_game(api, host, (lat, lng), args.phone)
    quiz_game = build_quiz_game(api, host, (lat, lng))

    if not args.no_backdate:
        backdate(args.db, main_game, quiz_game)

    seed = {"base_url": api.base_url, "host": host, "centre": [lat, lng],
            "game": main_game, "quiz_game": quiz_game}
    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump(seed, handle, indent=2)

    print(f"Host:        {host['name']}")
    print(f"  enrol at   {api.base_url}/?id={host['qr_code']}")
    print(f"Game:        {main_game['id']}  (Riverside Park Challenge)")
    for team in main_game["teams"]:
        print(f"  join {team['name']:<13} {api.base_url}/?id={team['qr']}")
    print(f"Quiz game:   {quiz_game['id']}  (Quiz Trail: Nature and History)")
    for team in quiz_game["teams"]:
        print(f"  join {team['name']:<13} {api.base_url}/?id={team['qr']}")
    print(f"\nWritten to {args.out}")


if __name__ == "__main__":
    main()
