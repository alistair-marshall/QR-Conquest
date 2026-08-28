from flask import Flask, request, jsonify, send_from_directory, Response
from flask_sock import Sock
import hmac
import sqlite3
import threading
import uuid
import time
import json
import csv
import io
from datetime import datetime, timezone
import os
import math
import random
import re
from functools import wraps
from collections import deque

app = Flask(__name__, static_folder='static')
sock = Sock(app)

# ==========================================================
# Site Admin Authentication Setup
# ==========================================================

# Get admin password from environment
SITE_ADMIN_PASSWORD = os.environ.get('SITE_ADMIN_PASSWORD')

# Exit if SITE_ADMIN_PASSWORD is not set
if not SITE_ADMIN_PASSWORD:
    print("ERROR: SITE_ADMIN_PASSWORD environment variable must be set")
    print("Run: export SITE_ADMIN_PASSWORD=your_secure_password")
    exit(1)

# Debug features (mobile console viewer, manual GPS coordinate entry) are
# hidden unless explicitly enabled on the server via this environment variable.
DEBUG_FEATURES = os.environ.get('DEBUG_FEATURES', '').strip().lower() in ('1', 'true', 'yes', 'on')

# The live-events WebSocket. On by default; set LIVE_EVENT_SOCKET to a false
# value on a host that cannot carry a WebSocket at all - uWSGI, which is what
# shared hosting like PythonAnywhere runs, gives flask-sock no socket to take
# over, so every client's attempt fails and is retried for the life of the
# page. Nothing is lost by switching it off: the same events reach clients on
# their five-second poll of the game, just up to five seconds later.
LIVE_EVENT_SOCKET = os.environ.get('LIVE_EVENT_SOCKET', 'on').strip().lower() \
    not in ('0', 'false', 'no', 'off')

# Address players and hosts can use to report abusive content (an announcement,
# a game, team or base name) or complain about the service. Set the default here;
# a site administrator can override it from the admin panel without a restart.
# When neither is set, the app shows no reporting route at all.
ABUSE_CONTACT_EMAIL = os.environ.get('ABUSE_CONTACT_EMAIL', '').strip()

# ==========================================================
# Retention
# ==========================================================

# How long a finished game is kept before every trace of it is deleted. A
# deployment is the data controller for what it stores (see
# docs/COMPLIANCE.md) and needs a retention rule it can point at; thirty days
# is long enough for a complaint about a game to reach the deployment and be
# answered from the record, and short enough that nothing accumulates.
# Override only if your own retention schedule says something different.
DEFAULT_GAME_RETENTION_DAYS = 30


def _read_retention_days():
    raw = os.environ.get('GAME_RETENTION_DAYS', '').strip()
    if not raw:
        return DEFAULT_GAME_RETENTION_DAYS

    try:
        days = int(raw)
    except ValueError:
        days = 0

    if days < 1:
        print(f'WARNING: ignoring GAME_RETENTION_DAYS={raw!r} - it must be a '
              f'whole number of days, 1 or more. Using '
              f'{DEFAULT_GAME_RETENTION_DAYS}.')
        return DEFAULT_GAME_RETENTION_DAYS

    return days


GAME_RETENTION_DAYS = _read_retention_days()
GAME_RETENTION_SECONDS = GAME_RETENTION_DAYS * 24 * 60 * 60

# How often the background sweeper looks for games that have aged out. The
# window is measured in days, so checking hourly is far more often than it
# needs to be - it just means a restarted server never sits on expired data
# waiting for a daily tick.
RETENTION_SWEEP_INTERVAL_SECONDS = 60 * 60

# True when the caller presented the site admin password as a bearer token.
# Endpoints that are a host's own but need an admin escape hatch check this
# themselves; everything admin-only uses the decorator below.
def request_is_site_admin():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return False

    token = auth_header.split(' ')[1]

    return hmac.compare_digest(token, SITE_ADMIN_PASSWORD)

# Admin authentication decorator
def require_site_admin(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not request_is_site_admin():
            return jsonify({'error': 'Unauthorized'}), 401

        return f(*args, **kwargs)
    return decorated_function

# ==========================================================
# Host Authentication
# ==========================================================

# A host id is a bearer credential: whoever holds one can run that host's games.
# URLs are recorded in places request bodies are not - server and proxy access
# logs, browser history, and the Referer header sent to any third party the page
# links out to - so a host identifies itself in this header rather than in a
# query string. Writes carry their host id in the JSON body, which is not logged.
HOST_ID_HEADER = 'X-Host-ID'


def request_host_id():
    """The host id the caller is identifying itself with, or None."""
    host_id = request.headers.get(HOST_ID_HEADER)
    host_id = host_id.strip() if host_id else ''

    return host_id or None


# Endpoints under /api/host serve a host its own data, so the header is the
# whole of the authorisation: there is no id in the path that could disagree
# with it, and nothing to guess but the credential itself. An unknown id is
# answered the same way as a missing one, so the endpoint cannot be used to
# test whether a host id exists.
def require_host(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        host_id = request_host_id()
        if not host_id:
            return jsonify({'error': 'Host ID required'}), 401

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM hosts WHERE id = ?', (host_id,))
        host = cursor.fetchone()
        conn.close()

        # Every unknown id gets this same answer, so the response cannot be
        # used to tell a real host id from an invented one. It is also what a
        # host whose credentials were rotated away sees, so it says what to do.
        if not host:
            return jsonify({'error': 'Host sign-in is no longer valid. Scan your host QR code again.'}), 401

        return f(host_id, *args, **kwargs)
    return decorated_function

# ==========================================================
# Game Identifiers
# ==========================================================

# A game's id is handed to every player device that scans into it, and it
# names the game in API paths and on the game socket. Earlier versions used a
# friendly "adjective-noun" code, which was short enough for anyone outside
# the game to guess their way into its payload. Games are identified by a
# random UUID instead; the host-chosen game name is what people read and say
# out loud, so nothing is lost by the id being unmemorable.
def generate_game_id():
    """Generate an unguessable id for a new game"""
    return str(uuid.uuid4())


# ==========================================================
# Player Names
# ==========================================================

# Players are never asked for a name. A name a player types is content one
# user writes and another reads, which is the thing that pulls a deployment
# into moderation duties, and in practice it is usually a child's real first
# name sitting on a host's roster. Every player is handed an
# "adjective-animal" name instead: memorable enough for a host to call out
# across a field, and personal data about nobody.
PLAYER_NAME_ADJECTIVES = [
    'quiet', 'brave', 'swift', 'clever', 'sunny', 'jolly', 'keen', 'bold',
    'calm', 'eager', 'gentle', 'happy', 'jaunty', 'lively', 'merry', 'nimble',
    'plucky', 'proud', 'rapid', 'sharp', 'spry', 'sturdy', 'tidy', 'witty',
    'cheery', 'breezy', 'chirpy', 'daring', 'dapper', 'fearless', 'fleet',
    'hardy', 'mighty', 'noble', 'perky', 'polite', 'ready', 'sleek',
    'steady', 'zesty'
]

PLAYER_NAME_ANIMALS = [
    'badger', 'otter', 'heron', 'falcon', 'marten', 'weasel', 'hedgehog',
    'squirrel', 'kestrel', 'puffin', 'seal', 'stoat', 'wren', 'robin',
    'magpie', 'osprey', 'beaver', 'lynx', 'hare', 'fox', 'dormouse', 'shrew',
    'newt', 'toad', 'adder', 'pike', 'salmon', 'trout', 'curlew', 'lapwing',
    'skylark', 'raven', 'rook', 'jackdaw', 'buzzard', 'harrier', 'merlin',
    'bittern', 'gannet', 'dolphin'
]

def generate_player_name(cursor, game_id):
    """Give a joining player an adjective-animal name nobody else in the game
    is using. Names only have to be unique within a game - one host reads them
    off one roster, and that is the only place a clash would confuse anyone."""
    cursor.execute('''
    SELECT p.name FROM players p
    JOIN teams t ON p.team_id = t.id
    WHERE t.game_id = ?
    ''', (game_id,))
    taken = {row['name'] for row in cursor.fetchall()}

    combinations = [f'{adjective}-{animal}'
                    for adjective in PLAYER_NAME_ADJECTIVES
                    for animal in PLAYER_NAME_ANIMALS]
    random.shuffle(combinations)

    for name in combinations:
        if name not in taken:
            return name

    # Every combination is in use - it would take a 1600-player game, but the
    # join must not fail over it, so keep going with a numbered suffix
    suffix = 2
    while True:
        for name in combinations:
            numbered = f'{name}-{suffix}'
            if numbered not in taken:
                return numbered
        suffix += 1


# ==========================================================
# Database Setup and Initialization
# ==========================================================

# Database setup
def get_db_connection():
    # A busy timeout lets concurrent writers (e.g. simultaneous quiz answers
    # against the same base) queue briefly for SQLite's write lock instead of
    # failing immediately with "database is locked".
    conn = sqlite3.connect('qr_game.db', timeout=10)
    conn.row_factory = sqlite3.Row
    return conn

# Initialize database
def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Create tables
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS hosts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        qr_code TEXT UNIQUE NOT NULL,
        expiry_date INTEGER,  -- NULL means never expires
        creation_date INTEGER NOT NULL
    )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS games (
            id TEXT PRIMARY KEY,
            host_id TEXT NOT NULL,
            name TEXT NOT NULL,
            start_time INTEGER,
            end_time INTEGER,
            status TEXT NOT NULL,
            capture_radius_meters INTEGER DEFAULT 15,
            points_interval_seconds INTEGER DEFAULT 15,
            auto_start_time INTEGER,
            game_duration_minutes INTEGER,
            join_method TEXT DEFAULT 'team_qr',
            created_time INTEGER NOT NULL,
            quiz_enabled INTEGER DEFAULT 0,
            active_categories TEXT DEFAULT '[]',
            max_shield INTEGER DEFAULT 5,
            cooldown_seconds INTEGER DEFAULT 30,
            bonus_round_enabled INTEGER DEFAULT 0,
            bonus_points_per_base INTEGER,
            bonus_start_time INTEGER,
            FOREIGN KEY (host_id) REFERENCES hosts (id)
        )
        ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        qr_code TEXT UNIQUE,
        FOREIGN KEY (game_id) REFERENCES games (id)
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL,
        name TEXT NOT NULL,
        join_time INTEGER NOT NULL,
        cooldown_until INTEGER,
        last_latitude REAL,
        last_longitude REAL,
        last_accuracy REAL,
        last_position_time INTEGER,
        announcements_read_at INTEGER,
        FOREIGN KEY (team_id) REFERENCES teams (id)
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS bases (
        id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        name TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        qr_code TEXT UNIQUE,
        deleted_at INTEGER DEFAULT NULL,
        shield INTEGER DEFAULT 0,
        owner_team_id TEXT,
        collected_by_team_id TEXT,
        collected_at INTEGER,
        returned_at INTEGER,
        FOREIGN KEY (game_id) REFERENCES games (id),
        FOREIGN KEY (owner_team_id) REFERENCES teams (id),
        FOREIGN KEY (collected_by_team_id) REFERENCES teams (id)
    )
    ''')

    # team_id is nullable: a NULL entry marks a neutralisation event on the
    # ownership timeline (Section 8) - the base stops scoring for anyone
    # until the next capture.
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS captures (
        id TEXT PRIMARY KEY,
        base_id TEXT NOT NULL,
        team_id TEXT,
        capture_time INTEGER NOT NULL,
        FOREIGN KEY (base_id) REFERENCES bases (id),
        FOREIGN KEY (team_id) REFERENCES teams (id)
    )
    ''')

    # Host-level, reusable-across-games question bank
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        host_id TEXT NOT NULL,
        text TEXT NOT NULL,
        type TEXT NOT NULL,
        options TEXT,
        correct_option_id TEXT NOT NULL,
        explanation TEXT,
        category TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (host_id) REFERENCES hosts (id)
    )
    ''')

    # One row per scan; tracks the run of questions following that scan
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS answer_sessions (
        id TEXT PRIMARY KEY,
        player_id TEXT NOT NULL,
        base_id TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        served_question_ids TEXT NOT NULL DEFAULT '[]',
        active INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (player_id) REFERENCES players (id),
        FOREIGN KEY (base_id) REFERENCES bases (id)
    )
    ''')

    # Announcements the host broadcasts to everyone in their game. There is
    # deliberately no reply channel and no way to address one team or player:
    # a private line between an adult host and a child player is the risk this
    # design avoids carrying (see docs/COMPLIANCE.md)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS announcements (
        id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        body TEXT NOT NULL,
        sent_at INTEGER NOT NULL,
        deleted_at INTEGER DEFAULT NULL,
        FOREIGN KEY (game_id) REFERENCES games (id)
    )
    ''')

    cursor.execute('''
    CREATE INDEX IF NOT EXISTS idx_announcements_game_time
    ON announcements (game_id, sent_at)
    ''')

    # Site-wide settings a site administrator can change at runtime, so the
    # deployment does not have to be restarted to correct something like the
    # published abuse-reporting address
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS site_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
    )
    ''')

    # Migrate databases created before an announcement could be withdrawn
    cursor.execute('PRAGMA table_info(announcements)')
    announcement_columns = [row['name'] for row in cursor.fetchall()]
    if 'deleted_at' not in announcement_columns:
        cursor.execute('ALTER TABLE announcements ADD COLUMN deleted_at INTEGER DEFAULT NULL')

    # An unreleased first cut of this feature stored two-way host/player
    # messages. It never shipped, but drop the table so private messages are
    # not left sitting in a database that was run from that branch
    cursor.execute('DROP TABLE IF EXISTS messages')

    # Migrate databases created before the deleted_at column existed
    cursor.execute('PRAGMA table_info(bases)')
    base_columns = [row['name'] for row in cursor.fetchall()]
    if 'deleted_at' not in base_columns:
        cursor.execute('ALTER TABLE bases ADD COLUMN deleted_at INTEGER DEFAULT NULL')
    if 'shield' not in base_columns:
        cursor.execute('ALTER TABLE bases ADD COLUMN shield INTEGER DEFAULT 0')
    if 'collected_by_team_id' not in base_columns:
        cursor.execute('ALTER TABLE bases ADD COLUMN collected_by_team_id TEXT')
    if 'collected_at' not in base_columns:
        cursor.execute('ALTER TABLE bases ADD COLUMN collected_at INTEGER')
    if 'returned_at' not in base_columns:
        cursor.execute('ALTER TABLE bases ADD COLUMN returned_at INTEGER')
    if 'owner_team_id' not in base_columns:
        cursor.execute('ALTER TABLE bases ADD COLUMN owner_team_id TEXT')
        # Backfill from existing capture history so ownership doesn't
        # regress for games that predate this column
        cursor.execute('''
            UPDATE bases SET owner_team_id = (
                SELECT team_id FROM captures
                WHERE captures.base_id = bases.id
                ORDER BY capture_time DESC LIMIT 1
            )
        ''')

    # Migrate databases created before the join_method column existed
    cursor.execute('PRAGMA table_info(games)')
    game_columns = [row['name'] for row in cursor.fetchall()]
    if 'join_method' not in game_columns:
        cursor.execute("ALTER TABLE games ADD COLUMN join_method TEXT DEFAULT 'team_qr'")
    if 'quiz_enabled' not in game_columns:
        cursor.execute('ALTER TABLE games ADD COLUMN quiz_enabled INTEGER DEFAULT 0')
    if 'active_categories' not in game_columns:
        cursor.execute("ALTER TABLE games ADD COLUMN active_categories TEXT DEFAULT '[]'")
    if 'max_shield' not in game_columns:
        cursor.execute('ALTER TABLE games ADD COLUMN max_shield INTEGER DEFAULT 5')
    if 'cooldown_seconds' not in game_columns:
        cursor.execute('ALTER TABLE games ADD COLUMN cooldown_seconds INTEGER DEFAULT 30')
    if 'bonus_round_enabled' not in game_columns:
        cursor.execute('ALTER TABLE games ADD COLUMN bonus_round_enabled INTEGER DEFAULT 0')
    if 'bonus_points_per_base' not in game_columns:
        cursor.execute('ALTER TABLE games ADD COLUMN bonus_points_per_base INTEGER')
    if 'bonus_start_time' not in game_columns:
        cursor.execute('ALTER TABLE games ADD COLUMN bonus_start_time INTEGER')

    # Migrate databases created before players.cooldown_until existed
    cursor.execute('PRAGMA table_info(players)')
    player_columns = [row['name'] for row in cursor.fetchall()]
    if 'cooldown_until' not in player_columns:
        cursor.execute('ALTER TABLE players ADD COLUMN cooldown_until INTEGER')

    # Migrate databases created before players reported their last known
    # position (only the latest fix is kept - no route history)
    if 'last_latitude' not in player_columns:
        cursor.execute('ALTER TABLE players ADD COLUMN last_latitude REAL')
    if 'last_longitude' not in player_columns:
        cursor.execute('ALTER TABLE players ADD COLUMN last_longitude REAL')
    if 'last_accuracy' not in player_columns:
        cursor.execute('ALTER TABLE players ADD COLUMN last_accuracy REAL')
    if 'last_position_time' not in player_columns:
        cursor.execute('ALTER TABLE players ADD COLUMN last_position_time INTEGER')

    # Migrate databases created before players tracked which announcements
    # they had already read
    if 'announcements_read_at' not in player_columns:
        cursor.execute('ALTER TABLE players ADD COLUMN announcements_read_at INTEGER')

    # Migrate databases where captures.team_id was NOT NULL, so
    # neutralisation events (NULL team_id) can be recorded
    cursor.execute('PRAGMA table_info(captures)')
    capture_columns = {row['name']: row for row in cursor.fetchall()}
    if capture_columns.get('team_id') and capture_columns['team_id']['notnull']:
        cursor.execute('ALTER TABLE captures RENAME TO captures_old')
        cursor.execute('''
        CREATE TABLE captures (
            id TEXT PRIMARY KEY,
            base_id TEXT NOT NULL,
            team_id TEXT,
            capture_time INTEGER NOT NULL,
            FOREIGN KEY (base_id) REFERENCES bases (id),
            FOREIGN KEY (team_id) REFERENCES teams (id)
        )
        ''')
        cursor.execute('''
            INSERT INTO captures (id, base_id, team_id, capture_time)
            SELECT id, base_id, team_id, capture_time FROM captures_old
        ''')
        cursor.execute('DROP TABLE captures_old')

    conn.commit()
    conn.close()

init_db()


# ==========================================================
# Site Settings
# ==========================================================

# Deliberately permissive: enough to catch a typo or a pasted sentence, but
# not an attempt to police the RFC. Angle brackets and quotes are excluded so
# the value is safe to drop into the page and into a mailto: link.
EMAIL_PATTERN = re.compile(r"^[^@\s<>\"'`]+@[^@\s<>\"'`.]+(\.[^@\s<>\"'`.]+)+$")

ABUSE_CONTACT_SETTING = 'abuse_contact_email'


def get_site_setting(key):
    """Return a site setting's stored value, or None if it has never been set."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT value FROM site_settings WHERE key = ?', (key,))
    row = cursor.fetchone()
    conn.close()
    return row['value'] if row else None


def set_site_setting(key, value):
    """Store a site setting, or clear it when value is empty so the
    environment variable's default applies again."""
    conn = get_db_connection()
    cursor = conn.cursor()
    if value:
        cursor.execute('''
            INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value,
                                           updated_at = excluded.updated_at
        ''', (key, value, int(time.time())))
    else:
        cursor.execute('DELETE FROM site_settings WHERE key = ?', (key,))
    conn.commit()
    conn.close()


def get_abuse_contact_email():
    """The address players are pointed at to report content or complain.

    An administrator's override wins over the ABUSE_CONTACT_EMAIL environment
    variable; with neither set the app shows no reporting route.
    """
    override = get_site_setting(ABUSE_CONTACT_SETTING)
    if override:
        return override
    return ABUSE_CONTACT_EMAIL


def is_valid_email(value):
    return bool(value) and len(value) <= 254 and bool(EMAIL_PATTERN.fullmatch(value))


# Checked once at startup rather than on every page render, and a bad value is
# dropped rather than served: it would end up in the page shell and in a
# mailto: link, and a typo there is worse than showing no route at all
if ABUSE_CONTACT_EMAIL and not is_valid_email(ABUSE_CONTACT_EMAIL):
    print('WARNING: ABUSE_CONTACT_EMAIL is not a valid email address - ignoring it')
    print('No abuse reporting route will be shown unless one is set in the admin panel')
    ABUSE_CONTACT_EMAIL = ''


# ==========================================================
# Retention - tidying an ended game, and purging an old one
# ==========================================================

# Two things happen to a game's personal data, at two different times.
#
# The moment a game ends, everything that only mattered while it was being
# played is cleared: every player's last known GPS position, and the quiz
# cooldown that was counting down when the whistle went. A position is the
# sharpest piece of personal data the app holds - it says where an
# identifiable person, quite possibly a child, was standing at a given minute
# - and once nobody is playing there is no purpose left to keep it for. The
# record of what happened is kept: generated player names, who was on which
# team and when they joined, the capture timeline, the quiz sessions, and
# every word of free text the host wrote, withdrawn announcements included.
# That is what a complaint weeks later has to be answered from, and none of it
# tracks anyone.
#
# Thirty days after the game ends, the rest goes too - see purge_game_data.

# What an ended game stops needing. Written once here so the end-of-game path
# and the sweeper below can never clear different sets of columns.
_TIDY_PLAYER_COLUMNS = """
    last_latitude = NULL,
    last_longitude = NULL,
    last_accuracy = NULL,
    last_position_time = NULL,
    cooldown_until = NULL
"""

_PLAYER_HAS_TIDYABLE_DATA = """
    (last_latitude IS NOT NULL OR last_longitude IS NOT NULL
     OR last_accuracy IS NOT NULL OR last_position_time IS NOT NULL
     OR cooldown_until IS NOT NULL)
"""


def tidy_ended_game(cursor, game_id):
    """Clear the personal data an ended game no longer needs.

    Called on every path that takes a game to 'ended' - the host ending it,
    the admin ending it on the host's behalf, and the scheduled end that fires
    when someone next reads the game. Safe to run again on a game already
    tidied: it matches nothing and reports 0.

    Returns the number of players whose data was cleared.
    """
    cursor.execute(f"""
    UPDATE players
    SET {_TIDY_PLAYER_COLUMNS}
    WHERE team_id IN (SELECT id FROM teams WHERE game_id = ?)
      AND {_PLAYER_HAS_TIDYABLE_DATA}
    """, (game_id,))

    return cursor.rowcount


def purge_game_data(cursor, game_id):
    """Delete a game and everything hanging off it. Caller owns the
    transaction.

    This is the only place the cascade is written down, so a table added to a
    game cannot be forgotten by one caller and remembered by another. Both
    ways a game is removed - a site admin deleting it, and the retention
    sweeper reaching its purge date - come through here.

    Returns a count per table for reporting.
    """
    counts = {}

    # Counted before they are deleted; nothing here is used to decide what to
    # delete, only to report what was
    cursor.execute("""
    SELECT COUNT(*) FROM answer_sessions
    WHERE player_id IN (
        SELECT id FROM players
        WHERE team_id IN (SELECT id FROM teams WHERE game_id = ?)
    )
    """, (game_id,))
    counts['answer_sessions'] = cursor.fetchone()[0]

    cursor.execute("""
    SELECT COUNT(*) FROM captures
    WHERE base_id IN (SELECT id FROM bases WHERE game_id = ?)
    """, (game_id,))
    counts['captures'] = cursor.fetchone()[0]

    cursor.execute("""
    SELECT COUNT(*) FROM players
    WHERE team_id IN (SELECT id FROM teams WHERE game_id = ?)
    """, (game_id,))
    counts['players'] = cursor.fetchone()[0]

    cursor.execute('SELECT COUNT(*) FROM bases WHERE game_id = ?', (game_id,))
    counts['bases'] = cursor.fetchone()[0]

    cursor.execute('SELECT COUNT(*) FROM teams WHERE game_id = ?', (game_id,))
    counts['teams'] = cursor.fetchone()[0]

    cursor.execute('SELECT COUNT(*) FROM announcements WHERE game_id = ?', (game_id,))
    counts['announcements'] = cursor.fetchone()[0]

    # Children first, so a failure part-way through never leaves a row
    # pointing at something that is gone
    cursor.execute("""
    DELETE FROM answer_sessions
    WHERE player_id IN (
        SELECT id FROM players
        WHERE team_id IN (SELECT id FROM teams WHERE game_id = ?)
    )
    """, (game_id,))

    cursor.execute('DELETE FROM announcements WHERE game_id = ?', (game_id,))

    cursor.execute("""
    DELETE FROM captures
    WHERE base_id IN (SELECT id FROM bases WHERE game_id = ?)
    """, (game_id,))

    cursor.execute("""
    DELETE FROM players
    WHERE team_id IN (SELECT id FROM teams WHERE game_id = ?)
    """, (game_id,))

    cursor.execute('DELETE FROM teams WHERE game_id = ?', (game_id,))
    cursor.execute('DELETE FROM bases WHERE game_id = ?', (game_id,))
    cursor.execute('DELETE FROM games WHERE id = ?', (game_id,))

    return counts


def game_purge_time(end_time):
    """When a game that ended at end_time is deleted, or None if it has not
    ended yet."""
    return end_time + GAME_RETENTION_SECONDS if end_time else None


def sweep_retention():
    """Enforce the retention rule across the whole database.

    Runs on startup and hourly after that. Three passes:

    1. Tidy any ended game still holding positions. The end-of-game path does
       this already, so this catches games that ended before the tidy-up
       existed, and anything a crash left half-done.
    2. Tidy stale positions in a game that never ended. A game runs for hours;
       a fix older than the whole retention window is not where anybody is now
       under any reading, and a game left running forever must not be a way to
       keep tracking data forever.
    3. Purge games that ended longer ago than the retention window.

    Returns (tidied_players, purged_games).
    """
    now = int(time.time())
    cutoff = now - GAME_RETENTION_SECONDS

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute('BEGIN')

        cursor.execute(f"""
        UPDATE players
        SET {_TIDY_PLAYER_COLUMNS}
        WHERE team_id IN (
            SELECT t.id FROM teams t
            JOIN games g ON t.game_id = g.id
            WHERE g.status = 'ended'
        )
          AND {_PLAYER_HAS_TIDYABLE_DATA}
        """)
        tidied = cursor.rowcount

        cursor.execute(f"""
        UPDATE players
        SET {_TIDY_PLAYER_COLUMNS}
        WHERE last_position_time IS NOT NULL AND last_position_time < ?
        """, (cutoff,))
        tidied += cursor.rowcount

        # A game with no end_time never ended, so its clock has not started.
        # Those are the site admin's to end or delete; the sweeper only takes
        # their positions away, above.
        cursor.execute("""
        SELECT id, name FROM games
        WHERE status = 'ended' AND end_time IS NOT NULL AND end_time <= ?
        """, (cutoff,))
        expired = cursor.fetchall()

        for game in expired:
            counts = purge_game_data(cursor, game['id'])
            print(f'Retention: purged game {game["id"]} ("{game["name"]}") - '
                  f'ended more than {GAME_RETENTION_DAYS} days ago; removed '
                  + ', '.join(f'{value} {table}' for table, value in sorted(counts.items())))

        cursor.execute('COMMIT')
    except sqlite3.Error as e:
        cursor.execute('ROLLBACK')
        conn.close()
        # A sweep that fails is not fatal - the next one an hour from now
        # tries again against the same unchanged data
        print(f'WARNING: retention sweep failed: {e}')
        return 0, 0

    conn.close()

    if tidied:
        print(f'Retention: cleared stored positions for {tidied} player(s) in ended or stale games')

    return tidied, len(expired)


def retention_sweeper():
    while True:
        try:
            sweep_retention()
        except Exception as e:
            # The sweeper is the only thing enforcing the retention rule, so
            # it must not be the kind of thread that dies quietly once and
            # leaves data sitting there for the life of the process
            print(f'WARNING: retention sweep raised {type(e).__name__}: {e}')

        time.sleep(RETENTION_SWEEP_INTERVAL_SECONDS)


# Werkzeug's auto-reloader runs this module in two processes when the app is
# started with `python flask_app.py`: a supervising parent that never serves a
# request, and the child that does. Only the child sets WERKZEUG_RUN_MAIN, so
# this skips the parent and starts one sweeper per serving process. Under
# Gunicorn (__name__ is the module name, not '__main__') it always starts.
if __name__ != '__main__' or os.environ.get('WERKZEUG_RUN_MAIN'):
    threading.Thread(target=retention_sweeper, daemon=True,
                     name='retention-sweeper').start()


# ==========================================================
# WebSocket Support - Live Game Notifications
# ==========================================================

# Connected WebSocket clients, keyed by game ID. Broadcasts happen from HTTP
# request threads while connections live on their own threads, so all access
# to the registry goes through the lock.
ws_clients = {}
ws_clients_lock = threading.Lock()

@sock.route('/ws/games/<game_id>')
def game_events_socket(ws, game_id):
    with ws_clients_lock:
        ws_clients.setdefault(game_id, set()).add(ws)
    try:
        # Clients only listen; keep receiving so we notice the disconnect
        while True:
            if ws.receive() is None:
                break
    finally:
        with ws_clients_lock:
            clients = ws_clients.get(game_id)
            if clients:
                clients.discard(ws)
                if not clients:
                    del ws_clients[game_id]


# Recent events per game, for the clients that are not holding a socket open.
# A WebSocket is the fast path, not the only one: a client that has none (its
# browser refused, its network dropped it, or the deployment cannot carry one
# at all) reads the same events off its five-second poll of the game, so a
# capture still raises a notification rather than silently moving the score.
#
# Every event gets a sequence number, so a client can say what it has already
# seen, and a socket and a poll delivering the same event are recognised as
# one thing. Held in memory only: this is a few seconds of catch-up, not a
# record of the game - the database is that.
GAME_EVENT_BUFFER_SIZE = 200        # events kept per game
GAME_EVENT_BUFFER_SECONDS = 600     # how long a game's buffer outlives its last event
GAME_EVENT_MAX_AGE_SECONDS = 120    # older than this and it is not news any more

game_events = {}
game_event_seq = 0
game_events_lock = threading.Lock()


def _prune_game_events(now):
    """Drop buffers for games nothing has happened in for a while. Called with
    the lock held."""
    cutoff = now - GAME_EVENT_BUFFER_SECONDS
    for game_id in [gid for gid, buf in game_events.items()
                    if not buf or buf[-1][1] < cutoff]:
        del game_events[game_id]


def record_game_event(game_id, payload):
    """Stamp an event with its sequence number and buffer it. Returns the
    stamped payload, which is what goes out on the socket too, so both routes
    carry the same number."""
    global game_event_seq

    now = time.time()
    with game_events_lock:
        game_event_seq += 1
        stamped = dict(payload, seq=game_event_seq)

        buf = game_events.get(game_id)
        if buf is None:
            buf = game_events[game_id] = deque(maxlen=GAME_EVENT_BUFFER_SIZE)
        buf.append((game_event_seq, now, stamped))

        _prune_game_events(now)

    return stamped


def current_game_event_seq():
    """The sequence number a client should start from when it has seen
    nothing yet."""
    with game_events_lock:
        return game_event_seq


def game_events_since(game_id, since_seq):
    """Events this game has seen since since_seq, and the sequence number the
    caller should send next time. Anything older than a couple of minutes is
    left out - a notification about something that happened while the phone was
    in a pocket is noise, and the poll carries the current state regardless."""
    cutoff = time.time() - GAME_EVENT_MAX_AGE_SECONDS

    with game_events_lock:
        buf = game_events.get(game_id) or ()
        events = [payload for seq, at, payload in buf
                  if seq > since_seq and at >= cutoff]
        return events, game_event_seq


def broadcast_game_event(game_id, payload):
    """Buffer an event for the polling clients, and send it to every client
    subscribed to this game's socket."""
    message = json.dumps(record_game_event(game_id, payload))
    with ws_clients_lock:
        clients = list(ws_clients.get(game_id, ()))
    for client in clients:
        try:
            client.send(message)
        except Exception:
            # Dead connection; its handler thread will clean it up
            pass


# API Routes

# Create a new game
@app.route('/api/health-check')
def health_check():
    return jsonify({"status": "ok", "message": "API is working"}), 200

# ==========================================================
# API Routes - Host Management (Site Admin)
# ==========================================================

@app.route('/api/hosts', methods=['GET'])
@require_site_admin
def get_hosts():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM hosts ORDER BY creation_date DESC')
    hosts = cursor.fetchall()

    result = []
    for host in hosts:
        result.append({
            'id': host['id'],
            'name': host['name'],
            'qr_code': host['qr_code'],
            'expiry_date': host['expiry_date'],
            'creation_date': host['creation_date']
        })

    conn.close()
    return jsonify(result)

@app.route('/api/hosts', methods=['POST'])
@require_site_admin
def create_host():
    data = request.json
    if not data or 'name' not in data:
        return jsonify({'error': 'Host name is required'}), 400

    host_id = str(uuid.uuid4())
    qr_code = str(uuid.uuid4())
    name = data['name']
    expiry_date = data.get('expiry_date')  # Can be None
    creation_date = int(time.time())

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute('''
        INSERT INTO hosts (id, name, qr_code, expiry_date, creation_date)
        VALUES (?, ?, ?, ?, ?)
        ''', (host_id, name, qr_code, expiry_date, creation_date))

        conn.commit()
    except sqlite3.Error as e:
        conn.close()
        return jsonify({'error': f'Database error: {str(e)}'}), 500

    conn.close()

    return jsonify({
        'id': host_id,
        'name': name,
        'qr_code': qr_code,
        'expiry_date': expiry_date,
        'creation_date': creation_date
    }), 201

@app.route('/api/hosts/<host_id>', methods=['PUT'])
@require_site_admin
def update_host(host_id):
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if host exists
    cursor.execute('SELECT * FROM hosts WHERE id = ?', (host_id,))
    host = cursor.fetchone()

    if not host:
        conn.close()
        return jsonify({'error': 'Host not found'}), 404

    # Update fields
    name = data.get('name', host['name'])
    expiry_date = data.get('expiry_date')

    try:
        cursor.execute('''
        UPDATE hosts
        SET name = ?, expiry_date = ?
        WHERE id = ?
        ''', (name, expiry_date, host_id))

        conn.commit()
    except sqlite3.Error as e:
        conn.close()
        return jsonify({'error': f'Database error: {str(e)}'}), 500

    conn.close()

    return jsonify({
        'id': host_id,
        'name': name,
        'qr_code': host['qr_code'],
        'expiry_date': expiry_date,
        'creation_date': host['creation_date']
    })

@app.route('/api/hosts/<host_id>', methods=['DELETE'])
@require_site_admin
def delete_host(host_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if host exists
    cursor.execute('SELECT * FROM hosts WHERE id = ?', (host_id,))
    host = cursor.fetchone()

    if not host:
        conn.close()
        return jsonify({'error': 'Host not found'}), 404

    # Check if host has any games
    cursor.execute('SELECT COUNT(*) FROM games WHERE host_id = ?', (host_id,))
    game_count = cursor.fetchone()[0]

    if game_count > 0:
        conn.close()
        return jsonify({'error': 'Cannot delete host with existing games. Delete the host\'s games first.'}), 400

    try:
        cursor.execute('DELETE FROM hosts WHERE id = ?', (host_id,))
        conn.commit()
    except sqlite3.Error as e:
        conn.close()
        return jsonify({'error': f'Database error: {str(e)}'}), 500

    conn.close()

    return jsonify({'success': True})

# Rotate a host's credentials
#
# A host holds two secrets: the qr_code its device scans to enrol, and the
# host_id that device stores and then sends on every request afterwards.
# Replacing only the QR code would leave a leaked host_id working forever, so
# rotation replaces both. Every device signed in as this host is signed out,
# and the host gets back in by scanning the new QR code.
#
# The host's games and question bank are carried across rather than lost: the
# new row is written first, the child rows are repointed at it, and only then
# does the old row go, so nothing is ever orphaned mid-rotation.
@app.route('/api/hosts/<host_id>/rotate-credentials', methods=['POST'])
@require_site_admin
def rotate_host_credentials(host_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM hosts WHERE id = ?', (host_id,))
    host = cursor.fetchone()

    if not host:
        conn.close()
        return jsonify({'error': 'Host not found'}), 404

    new_id = str(uuid.uuid4())
    new_qr = str(uuid.uuid4())

    try:
        cursor.execute('''
        INSERT INTO hosts (id, name, qr_code, expiry_date, creation_date)
        VALUES (?, ?, ?, ?, ?)
        ''', (new_id, host['name'], new_qr, host['expiry_date'], host['creation_date']))

        cursor.execute('UPDATE games SET host_id = ? WHERE host_id = ?', (new_id, host_id))
        cursor.execute('UPDATE questions SET host_id = ? WHERE host_id = ?', (new_id, host_id))
        cursor.execute('DELETE FROM hosts WHERE id = ?', (host_id,))

        conn.commit()
    except sqlite3.Error as e:
        conn.rollback()
        conn.close()
        return jsonify({'error': f'Database error: {str(e)}'}), 500

    conn.close()

    return jsonify({
        'id': new_id,
        'name': host['name'],
        'qr_code': new_qr,
        'expiry_date': host['expiry_date'],
        'creation_date': host['creation_date']
    })

# ==========================================================
# API Routes - Game Management
# ==========================================================

# How new players (without a team) can join a game when scanning a base:
#   team_qr        - must scan a team QR code (default)
#   choose_team    - pick a team themselves
#   fewest_players - auto-assigned to the team with the fewest members
#   lowest_points  - auto-assigned to the team with the lowest score
VALID_JOIN_METHODS = ('team_qr', 'choose_team', 'fewest_players', 'lowest_points')

# Helper function to validate game settings
def validate_game_settings(capture_radius, points_interval, game_duration, game_status=None, start_time=None):
    """Validate game settings and return error message if invalid"""

    # Validate capture radius (5m to 500m, matching the host form)
    if not (5 <= capture_radius <= 500):
        return 'Capture radius must be between 5 and 500 metres'

    # Validate points interval (5 seconds to 1 hour)
    if not (5 <= points_interval <= 3600):
        return 'Points interval must be between 5 seconds and 1 hour'

    # Validate game duration if provided (5 minutes to 30 days for festivals)
    if game_duration is not None and not (5 <= game_duration <= 43200):  # 30 days = 43200 minutes
        return 'Game duration must be between 5 minutes and 30 days'

    # Ensure game duration is significantly longer than points interval
    if game_duration is not None:
        game_duration_seconds = game_duration * 60
        # Game should be at least 10x longer than points interval
        min_duration_seconds = points_interval * 10
        if game_duration_seconds < min_duration_seconds:
            min_duration_minutes = min_duration_seconds // 60
            return f'Game duration must be at least 10x the points interval (minimum {min_duration_minutes} minutes for {points_interval}s interval)'

    # Active game duration validation
    if game_status == 'active' and start_time and game_duration:
        elapsed_minutes = (time.time() - start_time) / 60
        if game_duration <= elapsed_minutes:
            return f"Cannot set duration to {game_duration} minutes as {int(elapsed_minutes)} minutes have already elapsed. Use 'End Game' button to end the game immediately."

    return None  # No validation errors

# Helper function to validate quiz-capture settings
def validate_quiz_settings(max_shield, cooldown_seconds):
    """Validate quiz settings and return error message if invalid"""
    if not isinstance(max_shield, int) or isinstance(max_shield, bool) or not (1 <= max_shield <= 20):
        return 'Max shield must be an integer between 1 and 20'

    if not isinstance(cooldown_seconds, int) or isinstance(cooldown_seconds, bool) or not (5 <= cooldown_seconds <= 3600):
        return 'Cooldown must be an integer between 5 and 3600 seconds'

    return None

# Helper function to validate bonus-round settings
def validate_bonus_settings(bonus_points_per_base):
    """Validate bonus round settings and return error message if invalid.
    None means 'auto': the value is computed when the bonus round starts."""
    if bonus_points_per_base is None:
        return None

    if (not isinstance(bonus_points_per_base, int) or isinstance(bonus_points_per_base, bool)
            or not (1 <= bonus_points_per_base <= 1000000)):
        return 'Bonus points per base must be an integer between 1 and 1,000,000, or blank for automatic'

    return None

# Helper function to count the active questions available to a game's quiz
# pool (its host's active questions in the game's active categories)
def count_active_pool(cursor, host_id, categories):
    if not categories:
        return 0
    placeholders = ','.join('?' for _ in categories)
    cursor.execute(f'''
        SELECT COUNT(*) FROM questions
        WHERE host_id = ? AND active = 1 AND category IN ({placeholders})
    ''', [host_id] + list(categories))
    return cursor.fetchone()[0]

@app.route('/api/games', methods=['POST'])
def create_game():
    data = request.json
    host_id = data.get('host_id')

    if not host_id:
        return jsonify({'error': 'Host ID is required'}), 400

    # Verify host exists and has not expired
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
    SELECT * FROM hosts WHERE id = ?
    ''', (host_id,))
    host = cursor.fetchone()

    if not host:
        conn.close()
        return jsonify({'error': 'Invalid host ID'}), 400

    if host['expiry_date'] and host['expiry_date'] < int(time.time()):
        conn.close()
        return jsonify({'error': 'Host account has expired'}), 400

    game_id = generate_game_id()

    # Extract game settings with defaults
    capture_radius = data.get('capture_radius_meters', 15)
    points_interval = data.get('points_interval_seconds', 15)
    auto_start_time = data.get('auto_start_time')  # Can be None
    game_duration = data.get('game_duration_minutes')  # Can be None
    join_method = data.get('join_method', 'team_qr')
    quiz_enabled = bool(data.get('quiz_enabled', False))
    active_categories = data.get('active_categories', [])
    max_shield = data.get('max_shield', 5)
    cooldown_seconds = data.get('cooldown_seconds', 30)
    bonus_round_enabled = bool(data.get('bonus_round_enabled', False))
    bonus_points_per_base = data.get('bonus_points_per_base')  # None means auto

    # Validate settings
    validation_error = validate_game_settings(capture_radius, points_interval, game_duration)
    if validation_error:
        conn.close()
        return jsonify({'error': validation_error}), 400

    bonus_validation_error = validate_bonus_settings(bonus_points_per_base)
    if bonus_validation_error:
        conn.close()
        return jsonify({'error': bonus_validation_error}), 400

    if join_method not in VALID_JOIN_METHODS:
        conn.close()
        return jsonify({'error': 'Invalid join method'}), 400

    if not isinstance(active_categories, list) or not all(isinstance(c, str) for c in active_categories):
        conn.close()
        return jsonify({'error': 'active_categories must be a list of category names'}), 400

    quiz_validation_error = validate_quiz_settings(max_shield, cooldown_seconds)
    if quiz_validation_error:
        conn.close()
        return jsonify({'error': quiz_validation_error}), 400

    if auto_start_time is not None and auto_start_time <= int(time.time()):
        conn.close()
        return jsonify({'error': 'Auto-start time must be in the future'}), 400

    current_time = int(time.time())

    cursor.execute('''
    INSERT INTO games (id, host_id, name, status, capture_radius_meters, points_interval_seconds,
                      auto_start_time, game_duration_minutes, join_method, created_time,
                      quiz_enabled, active_categories, max_shield, cooldown_seconds,
                      bonus_round_enabled, bonus_points_per_base)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (game_id, host_id, data['name'], 'setup', capture_radius, points_interval,
          auto_start_time, game_duration, join_method, current_time,
          int(quiz_enabled), json.dumps(active_categories), max_shield, cooldown_seconds,
          int(bonus_round_enabled), bonus_points_per_base))

    conn.commit()
    conn.close()

    return jsonify({'game_id': game_id}), 201

# Update game settings
@app.route('/api/games/<game_id>/settings', methods=['PUT'])
def update_game_settings(game_id):
    data = request.json
    if not data or 'host_id' not in data:
        return jsonify({'error': 'Host ID required'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Verify game exists and host is authorized
    cursor.execute('SELECT * FROM games WHERE id = ?', (game_id,))
    game = cursor.fetchone()

    if not game:
        conn.close()
        return jsonify({'error': 'Game not found'}), 404

    if game['host_id'] != data['host_id']:
        conn.close()
        return jsonify({'error': 'Unauthorized: host ID does not match game owner'}), 403

    # Extract current settings for validation
    capture_radius = data.get('capture_radius_meters', game['capture_radius_meters'])
    points_interval = data.get('points_interval_seconds', game['points_interval_seconds'])
    game_duration = data.get('game_duration_minutes', game['game_duration_minutes'])

    # Validate all settings together
    validation_error = validate_game_settings(
        capture_radius,
        points_interval,
        game_duration,
        game_status=game['status'],
        start_time=game['start_time']
    )
    if validation_error:
        conn.close()
        return jsonify({'error': validation_error}), 400

    # Extract and validate individual settings
    update_fields = []
    params = []

    if 'name' in data:
        update_fields.append('name = ?')
        params.append(data['name'])

    if 'capture_radius_meters' in data:
        update_fields.append('capture_radius_meters = ?')
        params.append(data['capture_radius_meters'])

    if 'points_interval_seconds' in data:
        update_fields.append('points_interval_seconds = ?')
        params.append(data['points_interval_seconds'])

    if 'auto_start_time' in data:
        auto_start_time = data['auto_start_time']
        if auto_start_time is not None and auto_start_time <= int(time.time()):
            conn.close()
            return jsonify({'error': 'Auto-start time must be in the future'}), 400
        update_fields.append('auto_start_time = ?')
        params.append(auto_start_time)

    if 'game_duration_minutes' in data:
        update_fields.append('game_duration_minutes = ?')
        params.append(data['game_duration_minutes'])

    if 'join_method' in data:
        if data['join_method'] not in VALID_JOIN_METHODS:
            conn.close()
            return jsonify({'error': 'Invalid join method'}), 400
        update_fields.append('join_method = ?')
        params.append(data['join_method'])

    if 'active_categories' in data:
        active_categories = data['active_categories']
        if not isinstance(active_categories, list) or not all(isinstance(c, str) for c in active_categories):
            conn.close()
            return jsonify({'error': 'active_categories must be a list of category names'}), 400
        update_fields.append('active_categories = ?')
        params.append(json.dumps(active_categories))

    max_shield = data.get('max_shield', game['max_shield'])
    cooldown_seconds = data.get('cooldown_seconds', game['cooldown_seconds'])
    if 'max_shield' in data or 'cooldown_seconds' in data:
        quiz_validation_error = validate_quiz_settings(max_shield, cooldown_seconds)
        if quiz_validation_error:
            conn.close()
            return jsonify({'error': quiz_validation_error}), 400

    if 'max_shield' in data:
        update_fields.append('max_shield = ?')
        params.append(max_shield)

    if 'cooldown_seconds' in data:
        update_fields.append('cooldown_seconds = ?')
        params.append(cooldown_seconds)

    if 'bonus_points_per_base' in data:
        # The bonus round has started (or finished): its points value is
        # locked in so already-earned bonuses can't be re-priced
        if game['bonus_start_time']:
            conn.close()
            return jsonify({'error': 'Bonus points cannot be changed after the bonus round has started'}), 400
        bonus_validation_error = validate_bonus_settings(data['bonus_points_per_base'])
        if bonus_validation_error:
            conn.close()
            return jsonify({'error': bonus_validation_error}), 400
        update_fields.append('bonus_points_per_base = ?')
        params.append(data['bonus_points_per_base'])

    if 'bonus_round_enabled' in data:
        update_fields.append('bonus_round_enabled = ?')
        params.append(int(bool(data['bonus_round_enabled'])))

    if 'quiz_enabled' in data:
        quiz_enabled = bool(data['quiz_enabled'])
        if quiz_enabled:
            effective_categories = data.get('active_categories')
            if effective_categories is None:
                effective_categories = json.loads(game['active_categories'] or '[]')
            if not effective_categories:
                conn.close()
                return jsonify({'error': 'Select at least one category before enabling quiz capture'}), 400
            if count_active_pool(cursor, game['host_id'], effective_categories) < 1:
                conn.close()
                return jsonify({'error': 'The selected categories have no active questions. Add questions before enabling quiz capture'}), 400
        update_fields.append('quiz_enabled = ?')
        params.append(int(quiz_enabled))

    if not update_fields:
        conn.close()
        return jsonify({'error': 'No settings to update'}), 400

    params.append(game_id)

    cursor.execute(
        f"UPDATE games SET {', '.join(update_fields)} WHERE id = ?",
        params
    )

    conn.commit()
    conn.close()

    return jsonify({'success': True})

# Get game details
# The game payload is read by everyone playing, so it is fetched without a
# credential. Game codes are short and guessable, so the anonymous view must
# carry nothing that could be used or misused by someone who guessed one: no
# player names or ids, and none of the QR codes that let a device join a team.
# A host sending its own host id in the X-Host-ID header gets those extra
# fields for its own game.
@app.route('/api/games/<game_id>', methods=['GET'])
def get_game(game_id):
    host_id = request_host_id()

    conn = get_db_connection()
    cursor = conn.cursor()

    # Get game info
    cursor.execute('''
    SELECT g.*, h.name as host_name
    FROM games g
    JOIN hosts h ON g.host_id = h.id
    WHERE g.id = ?
    ''', (game_id,))
    game = cursor.fetchone()

    if not game:
        conn.close()
        return jsonify({'error': 'Game not found'}), 404

    # Apply auto-start/auto-end transitions before gathering teams, scores and
    # bases, so the response reflects the game's true current state
    current_time = int(time.time())
    game_state_changed = False

    if (game['status'] == 'setup' and
        game['auto_start_time'] and
        current_time >= game['auto_start_time']):

        cursor.execute('''
        UPDATE games
        SET status = 'active', start_time = ?
        WHERE id = ?
        ''', (current_time, game_id))
        game_state_changed = True

    elif (game['status'] == 'active' and
          game['start_time'] and
          game['game_duration_minutes']):

        scheduled_end = game['start_time'] + (game['game_duration_minutes'] * 60)
        if current_time >= scheduled_end:
            if game['bonus_round_enabled']:
                # The main game rolls into the bonus round instead of ending;
                # QR codes stay assigned as players still need to scan them
                begin_bonus_round(cursor, game, scheduled_end)
            else:
                cursor.execute('''
                UPDATE games
                SET status = 'ended', end_time = ?
                WHERE id = ?
                ''', (scheduled_end, game_id))

                # Release QR codes for reuse, and clear the personal data an
                # ended game stops needing - matching the manual end-game flow
                cursor.execute('UPDATE bases SET qr_code = NULL WHERE game_id = ?', (game_id,))
                cursor.execute('UPDATE teams SET qr_code = NULL WHERE game_id = ?', (game_id,))
                tidy_ended_game(cursor, game_id)
            game_state_changed = True

    if game_state_changed:
        conn.commit()
        cursor.execute('''
        SELECT g.*, h.name as host_name
        FROM games g
        JOIN hosts h ON g.host_id = h.id
        WHERE g.id = ?
        ''', (game_id,))
        game = cursor.fetchone()

    is_host = bool(host_id) and host_id == game['host_id']

    # Get teams
    cursor.execute('SELECT * FROM teams WHERE game_id = ?', (game_id,))
    teams_data = cursor.fetchall()
    teams = []

    for team in teams_data:
        # Get players with their names
        cursor.execute('SELECT id, name, join_time FROM players WHERE team_id = ? ORDER BY join_time ASC', (team['id'],))
        players_data = cursor.fetchall()

        players = []
        for player in players_data:
            players.append({
                'id': player['id'],
                'name': player['name'],
                'joinTime': player['join_time']
            })


        # Calculate team score (fixed logic)
        team_score = calculate_team_score(cursor, team['id'], game)

        team_payload = {
            'id': team['id'],
            'name': team['name'],
            'color': team['color'],
            'playerCount': len(players),
            'score': team_score,
        }

        # Who is on a team, and the QR code that joins it, are the host's to
        # see - players only need the scoreboard
        if is_host:
            team_payload['qrCode'] = team['qr_code']
            team_payload['players'] = players

        teams.append(team_payload)

    # Get bases
    cursor.execute('SELECT * FROM bases WHERE game_id = ?', (game_id,))
    bases_data = cursor.fetchall()
    bases = []

    for base in bases_data:
        # Ownership/shield is read from the live columns on the base itself
        # (kept in sync by the capture and quiz-answer endpoints), rather
        # than re-derived from the captures timeline on every read.
        shield = base['shield'] or 0
        owner = base['owner_team_id']

        base_payload = {
            'id': base['id'],
            'name': base['name'],
            'lat': base['latitude'],
            'lng': base['longitude'],
            'ownedBy': owner,
            'shield': shield,
            'neutral': owner is None,
            'deleted_at': base['deleted_at'],
            'collectedBy': base['collected_by_team_id'],
            'collectedAt': base['collected_at'],
            'returnedAt': base['returned_at']
        }

        # A base's QR code is meant to be found in the field, not read out of
        # the API by anyone who guessed the game code
        if is_host:
            base_payload['qrCode'] = base['qr_code']

        bases.append(base_payload)

    conn.close()

    # Calculate end time if duration is set
    calculated_end_time = None
    if game['start_time'] and game['game_duration_minutes']:
        calculated_end_time = game['start_time'] + (game['game_duration_minutes'] * 60)

    # Events since the caller last asked. A client polling this endpoint is
    # how a capture reaches anyone whose WebSocket never connected; without a
    # cursor it gets the sequence number only, so a page that has just opened
    # starts from now rather than replaying what it missed.
    events_since = request.args.get('events_since')
    if events_since is None:
        recent_events, event_cursor = None, current_game_event_seq()
    else:
        recent_events, event_cursor = game_events_since(
            game_id, int(events_since) if events_since.isdigit() else 0)

    payload = {
        'id': game['id'],
        'name': game['name'],
        'status': game['status'],
        'hostName': game['host_name'],
        'event_cursor': event_cursor,
        'settings': {
            'capture_radius_meters': game['capture_radius_meters'],
            'points_interval_seconds': game['points_interval_seconds'],
            'auto_start_time': game['auto_start_time'],
            'start_time': game['start_time'],
            'game_duration_minutes': game['game_duration_minutes'],
            'join_method': game['join_method'] or 'team_qr',
            'calculated_end_time': calculated_end_time,
            'quiz_enabled': bool(game['quiz_enabled']),
            'active_categories': json.loads(game['active_categories'] or '[]'),
            'max_shield': game['max_shield'] or 5,
            'cooldown_seconds': game['cooldown_seconds'] or 30,
            'bonus_round_enabled': bool(game['bonus_round_enabled']),
            'bonus_points_per_base': game['bonus_points_per_base'],
            'bonus_start_time': game['bonus_start_time']
        },
        'teams': teams,
        'bases': bases
    }

    if events_since is not None:
        payload['events'] = recent_events

    return jsonify(payload)

# Helper function to calculate team score
def calculate_team_score(cursor, team_id, game):
    total_score = 0

    # Get all bases for this game (including deleted ones)
    cursor.execute('SELECT id, deleted_at FROM bases WHERE game_id = ?', (game['id'],))
    bases = cursor.fetchall()

    # Calculate current time or end time if game is over
    current_time = game['end_time'] if game['status'] == 'ended' else int(time.time())

    # If the game has a scheduled end that has not been processed yet
    # (status still 'active'), don't award points beyond it
    if (game['status'] == 'active' and game['start_time'] and
            game['game_duration_minutes']):
        scheduled_end = game['start_time'] + (game['game_duration_minutes'] * 60)
        current_time = min(current_time, scheduled_end)

    # Holding bases stops scoring once the bonus round begins
    if game['bonus_start_time']:
        current_time = min(current_time, game['bonus_start_time'])

    # Get the points interval from game settings
    points_interval = game['points_interval_seconds']

    # For each base, calculate points earned by this team
    for base in bases:
        base_id = base['id']
        deleted_at = base['deleted_at']

        # Skip bases deleted at or before game start - they score no points at all
        if deleted_at is not None and (game['start_time'] is None or deleted_at <= game['start_time']):
            continue

        # Scoring stops at the deletion time, otherwise at current/end time
        base_end_time = min(deleted_at, current_time) if deleted_at is not None else current_time

        # Get all captures for this base in chronological order
        cursor.execute('''
        SELECT team_id, capture_time FROM captures
        WHERE base_id = ?
        ORDER BY capture_time ASC
        ''', (base_id,))
        captures = cursor.fetchall()

        # Calculate points for each period the team owned the base
        for i, capture in enumerate(captures):
            # If this is a capture by our team
            if capture['team_id'] == team_id:
                start_time = capture['capture_time']

                # Figure out when this team's control ended
                if i < len(captures) - 1:
                    end_time = captures[i + 1]['capture_time']
                else:
                    end_time = base_end_time

                # Ensure we don't count beyond the base deletion time;
                # captures after the cutoff contribute nothing rather than negative points
                end_time = min(end_time, base_end_time)

                # Calculate points using configurable interval
                duration = max(0, end_time - start_time)
                points = duration // points_interval
                total_score += points

    # Bonus round: points for each collected base the host has confirmed
    # returned. returned_at can only be set during a bonus round, so this is
    # safe to count unconditionally.
    if game['bonus_points_per_base']:
        cursor.execute('''
        SELECT COUNT(*) FROM bases
        WHERE game_id = ? AND collected_by_team_id = ? AND returned_at IS NOT NULL
          AND deleted_at IS NULL
        ''', (game['id'], team_id))
        total_score += cursor.fetchone()[0] * game['bonus_points_per_base']

    return total_score

# Start game
@app.route('/api/games/<game_id>/start', methods=['POST'])
def start_game(game_id):
    data = request.json
    if not data or 'host_id' not in data:
        return jsonify({'error': 'Host ID required'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Verify host is authorized for this game
    cursor.execute('SELECT * FROM games WHERE id = ?', (game_id,))
    game = cursor.fetchone()

    if not game:
        conn.close()
        return jsonify({'error': 'Game not found'}), 404

    if game['host_id'] != data['host_id']:
        conn.close()
        return jsonify({'error': 'Unauthorized: host ID does not match game owner'}), 403

    # Check team count
    cursor.execute('SELECT COUNT(*) FROM teams WHERE game_id = ?', (game_id,))
    team_count = cursor.fetchone()[0]

    if team_count < 2:
        conn.close()
        return jsonify({'error': 'At least 2 teams are required to start the game'}), 400

    # Quiz capture cannot be enabled for a game with no categories selected
    # or no active questions in those categories (Section 4.5, 10)
    if game['quiz_enabled']:
        categories = json.loads(game['active_categories'] or '[]')
        if not categories:
            conn.close()
            return jsonify({'error': 'Quiz capture is enabled but no categories are selected. Choose categories in Game Settings.'}), 400
        if count_active_pool(cursor, game['host_id'], categories) < 1:
            conn.close()
            return jsonify({'error': 'Quiz capture is enabled but the selected categories have no active questions. Add questions or choose different categories.'}), 400

    # Update game status
    current_time = int(time.time())
    cursor.execute('''
    UPDATE games
    SET status = 'active', start_time = ?
    WHERE id = ?
    ''', (current_time, game_id))

    conn.commit()
    conn.close()

    return jsonify({'success': True})

# End game
@app.route('/api/games/<game_id>/end', methods=['POST'])
def end_game(game_id):
    data = request.json
    if not data or 'host_id' not in data:
        return jsonify({'error': 'Host ID required'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Verify host is authorized for this game
    cursor.execute('SELECT * FROM games WHERE id = ?', (game_id,))
    game = cursor.fetchone()

    if not game:
        conn.close()
        return jsonify({'error': 'Game not found'}), 404

    if game['host_id'] != data['host_id']:
        conn.close()
        return jsonify({'error': 'Unauthorized: host ID does not match game owner'}), 403

    # Update game status
    current_time = int(time.time())
    cursor.execute('''
    UPDATE games
    SET status = 'ended', end_time = ?
    WHERE id = ?
    ''', (current_time, game_id))

    # Clear QR code assignments for all bases in this game
    cursor.execute('''
    UPDATE bases
    SET qr_code = NULL
    WHERE game_id = ?
    ''', (game_id,))

    base_count = cursor.rowcount

    # Clear QR code assignments for all teams in this game
    cursor.execute('''
    UPDATE teams
    SET qr_code = NULL
    WHERE game_id = ?
    ''', (game_id,))

    team_count = cursor.rowcount

    # Nobody is playing any more, so nothing needs to know where anybody is
    tidied_players = tidy_ended_game(cursor, game_id)

    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'released_bases': base_count,
        'released_teams': team_count,
        'tidied_players': tidied_players,
        'purge_after': game_purge_time(current_time),
        'retention_days': GAME_RETENTION_DAYS
    })

# ==========================================================
# Scanned QR codes - proof the player was actually there
# ==========================================================

# A base id and a team id both travel in the game payload that every player
# device reads, so an endpoint that trusts the id alone can be driven from an
# armchair: any player can read another team's id and join it, or read a base
# id and capture a base they never walked to. The QR code is what the ids are
# not - a secret printed on the sign-up sheet or the base marker, served only
# to the game's own host - so scan-backed actions carry the scanned code and
# check it against the row it claims to be. Ids stay in the path; they say
# which row, not that the caller was there.
#
# For a base this sits alongside the GPS check rather than replacing it: the
# code proves the player found the marker, the location proves they are at it
# now, and a base capture needs both.
def scanned_code_matches(assigned_code, submitted_code):
    if not assigned_code or not isinstance(submitted_code, str) or not submitted_code:
        return False
    # Compared as bytes: compare_digest refuses str holding non-ASCII, so a
    # crafted code would raise rather than simply not match
    return hmac.compare_digest(assigned_code.encode('utf-8'),
                               submitted_code.encode('utf-8'))

# ==========================================================
# Bonus Round - collect the bases in after the main game
# ==========================================================

def begin_bonus_round(cursor, game, start_time):
    """Move an active game into its bonus round: base-holding scoring freezes
    at start_time and players collect base QR codes for bonus points. If no
    per-base value was configured, pick one such that the last-placed team
    would (just) win by collecting every base. Returns the per-base value."""
    per_base = game['bonus_points_per_base']

    if not per_base:
        cursor.execute('SELECT id FROM teams WHERE game_id = ?', (game['id'],))
        team_ids = [row['id'] for row in cursor.fetchall()]
        scores = [calculate_team_score(cursor, team_id, game) for team_id in team_ids]

        cursor.execute('''
        SELECT COUNT(*) FROM bases WHERE game_id = ? AND deleted_at IS NULL
        ''', (game['id'],))
        base_count = cursor.fetchone()[0]

        score_gap = (max(scores) - min(scores)) if scores else 0
        per_base = (score_gap // base_count) + 1 if base_count else 1

    cursor.execute('''
    UPDATE games
    SET status = 'bonus', bonus_start_time = ?, bonus_points_per_base = ?
    WHERE id = ?
    ''', (start_time, per_base, game['id']))

    return per_base

# Start the bonus round (host only, game must be active)
@app.route('/api/games/<game_id>/bonus/start', methods=['POST'])
def start_bonus_round(game_id):
    data = request.json
    if not data or 'host_id' not in data:
        return jsonify({'error': 'Host ID required'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM games WHERE id = ?', (game_id,))
    game = cursor.fetchone()

    if not game:
        conn.close()
        return jsonify({'error': 'Game not found'}), 404

    if game['host_id'] != data['host_id']:
        conn.close()
        return jsonify({'error': 'Unauthorized: host ID does not match game owner'}), 403

    if game['status'] != 'active':
        conn.close()
        return jsonify({'error': 'The bonus round can only be started while the game is active'}), 400

    current_time = int(time.time())
    per_base = begin_bonus_round(cursor, game, current_time)

    conn.commit()
    conn.close()

    broadcast_game_event(game_id, {
        'type': 'bonus_round_started',
        'bonus_points_per_base': per_base,
        'bonus_start_time': current_time
    })

    return jsonify({'success': True, 'bonus_points_per_base': per_base})

# Player collects a base during the bonus round (must be at the base)
@app.route('/api/bases/<base_id>/collect', methods=['POST'])
def collect_base(base_id):
    data = request.json
    if (not data or 'player_id' not in data or 'latitude' not in data
            or 'longitude' not in data or 'qr_code' not in data):
        return jsonify({'error': 'Missing required fields'}), 400

    player_id = data['player_id']
    player_lat = data['latitude']
    player_lng = data['longitude']

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
    SELECT b.*, g.capture_radius_meters, g.status AS game_status, g.bonus_points_per_base
    FROM bases b JOIN games g ON b.game_id = g.id
    WHERE b.id = ?
    ''', (base_id,))
    base_data = cursor.fetchone()

    if not base_data:
        conn.close()
        return jsonify({'error': 'Base not found'}), 404

    if base_data['deleted_at'] is not None:
        conn.close()
        return jsonify({'error': 'This base has been removed from the game'}), 410

    if base_data['game_status'] != 'bonus':
        conn.close()
        return jsonify({'error': 'Bases can only be collected during the bonus round'}), 403

    if not scanned_code_matches(base_data['qr_code'], data['qr_code']):
        conn.close()
        return jsonify({'error': 'That QR code does not belong to this base. Scan the code on the base itself.'}), 403

    cursor.execute('''
    SELECT p.team_id, t.game_id, t.name AS team_name, t.color AS team_color FROM players p
    JOIN teams t ON p.team_id = t.id
    WHERE p.id = ?
    ''', (player_id,))
    player = cursor.fetchone()

    if not player:
        conn.close()
        return jsonify({'error': 'Player not found'}), 404

    if player['game_id'] != base_data['game_id']:
        conn.close()
        return jsonify({'error': 'Player is not part of this game'}), 403

    # The scan must happen at the base so the map reflects where the QR code
    # really is - players can't walk off with a base and mark it later
    capture_radius = base_data['capture_radius_meters']
    distance = calculate_distance(player_lat, player_lng, base_data['latitude'], base_data['longitude'])

    if distance > capture_radius:
        conn.close()
        return jsonify({'error': f'You must be within {capture_radius}m of the base to collect it'}), 403

    current_time = int(time.time())

    # Guard the read-modify-write against two players collecting at once:
    # only the first update matches collected_by_team_id IS NULL
    cursor.execute('''
    UPDATE bases
    SET collected_by_team_id = ?, collected_at = ?
    WHERE id = ? AND collected_by_team_id IS NULL
    ''', (player['team_id'], current_time, base_id))

    if cursor.rowcount == 0:
        conn.close()
        return jsonify({'error': 'This base has already been collected'}), 409

    conn.commit()
    conn.close()

    broadcast_game_event(base_data['game_id'], {
        'type': 'base_collected',
        'base_id': base_id,
        'base_name': base_data['name'],
        'team_id': player['team_id'],
        'team_name': player['team_name'],
        'team_color': player['team_color'],
        'collected_at': current_time
    })

    return jsonify({
        'success': True,
        'bonus_points_per_base': base_data['bonus_points_per_base']
    })

# Host confirms a base has been brought back. A base a team collected
# properly scores its bonus points; any other base in the host's hand
# (never collected, or deleted) can still be scanned in so it comes off
# the map, but scores nothing.
# No location check: the host scans the physical QR code wherever they are.
@app.route('/api/bases/<base_id>/return', methods=['POST'])
def return_base(base_id):
    data = request.json
    if not data or 'host_id' not in data:
        return jsonify({'error': 'Host ID required'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
    SELECT b.*, g.host_id AS game_host_id, g.status AS game_status, g.bonus_points_per_base
    FROM bases b JOIN games g ON b.game_id = g.id
    WHERE b.id = ?
    ''', (base_id,))
    base_data = cursor.fetchone()

    if not base_data:
        conn.close()
        return jsonify({'error': 'Base not found'}), 404

    if base_data['game_host_id'] != data['host_id']:
        conn.close()
        return jsonify({'error': 'Unauthorized: host ID does not match game owner'}), 403

    if base_data['game_status'] != 'bonus':
        conn.close()
        return jsonify({'error': 'Bases can only be checked in during the bonus round'}), 403

    if base_data['returned_at'] is not None:
        conn.close()
        return jsonify({'error': 'This base has already been checked in'}), 400

    # Points only for a live base a team collected correctly - an uncollected
    # or deleted base is still checked in, just without awarding anything
    awards_points = (base_data['collected_by_team_id'] is not None
                     and base_data['deleted_at'] is None)

    current_time = int(time.time())
    cursor.execute('UPDATE bases SET returned_at = ? WHERE id = ?', (current_time, base_id))

    team = None
    if awards_points:
        cursor.execute('SELECT name, color FROM teams WHERE id = ?', (base_data['collected_by_team_id'],))
        team = cursor.fetchone()

    conn.commit()
    conn.close()

    points = (base_data['bonus_points_per_base'] or 0) if awards_points else 0
    team_id = base_data['collected_by_team_id'] if awards_points else None

    broadcast_game_event(base_data['game_id'], {
        'type': 'base_returned',
        'base_id': base_id,
        'base_name': base_data['name'],
        'team_id': team_id,
        'team_name': (team['name'] if team else 'Unknown Team') if awards_points else None,
        'team_color': team['color'] if team else None,
        'points': points,
        'returned_at': current_time
    })

    return jsonify({
        'success': True,
        'team_id': team_id,
        'team_name': (team['name'] if team else 'Unknown Team') if awards_points else None,
        'points': points
    })

# Join team. A team's id is public to everyone already in the game, so joining
# by id alone would let any player walk onto any team; the scanned team QR code
# is what proves they were handed it. The one exception is a choose_team game,
# where picking a team off a list is the intended way in and there is no code
# to scan - a code is still checked there if one is sent.
@app.route('/api/teams/<team_id>/join', methods=['POST'])
def join_team(team_id):
    data = request.json
    player_id = data.get('player_id') if data else None
    submitted_qr = data.get('qr_code') if data else None
    current_time = int(time.time())

    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if team exists and get game info
    cursor.execute('''
    SELECT t.*, g.status, g.join_method FROM teams t
    JOIN games g ON t.game_id = g.id
    WHERE t.id = ?
    ''', (team_id,))
    team = cursor.fetchone()

    if not team:
        conn.close()
        return jsonify({'error': 'Team not found'}), 404

    if team['status'] == 'ended':
        conn.close()
        return jsonify({'error': 'This game has already ended'}), 400

    if submitted_qr is not None:
        if not scanned_code_matches(team['qr_code'], submitted_qr):
            conn.close()
            return jsonify({'error': 'That QR code does not belong to this team.'}), 403
    elif (team['join_method'] or 'team_qr') != 'choose_team':
        conn.close()
        return jsonify({'error': 'Scan the team QR code to join this team.'}), 403

    # If player_id is provided, check if they're already in a team for this game
    if player_id:
        cursor.execute('''
        SELECT p.*, t.game_id FROM players p
        JOIN teams t ON p.team_id = t.id
        WHERE p.id = ? AND t.game_id = ?
        ''', (player_id, team['game_id']))

        existing_player = cursor.fetchone()

        if existing_player:
            # Player is already in a team for this game
            if existing_player['team_id'] == team_id:
                conn.close()
                return jsonify({'error': 'Player is already a member of this team'}), 400

            # Update player to new team (preserving their existing name and ID)
            cursor.execute('''
            UPDATE players
            SET team_id = ?, join_time = ?
            WHERE id = ?
            ''', (team_id, current_time, player_id))

            print(f"Moved player {player_id} ({existing_player['name']}) from team {existing_player['team_id']} to team {team_id}")

            conn.commit()
            conn.close()
            return jsonify({'player_id': player_id, 'player_name': existing_player['name']})

    # Generate new player ID if not provided (new player joining)
    if not player_id:
        player_id = str(uuid.uuid4())

    # Add player to the new team under a name the server picks for them
    player_name = generate_player_name(cursor, team['game_id'])
    cursor.execute('''
    INSERT INTO players (id, team_id, name, join_time)
    VALUES (?, ?, ?, ?)
    ''', (player_id, team_id, player_name, current_time))

    conn.commit()
    conn.close()

    return jsonify({'player_id': player_id, 'player_name': player_name})

# Join a game with automatic team assignment (fewest_players / lowest_points)
@app.route('/api/games/<game_id>/join', methods=['POST'])
def join_game(game_id):
    data = request.json or {}
    player_id = data.get('player_id')
    current_time = int(time.time())

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM games WHERE id = ?', (game_id,))
    game = cursor.fetchone()

    if not game:
        conn.close()
        return jsonify({'error': 'Game not found'}), 404

    if game['status'] == 'ended':
        conn.close()
        return jsonify({'error': 'This game has already ended'}), 400

    join_method = game['join_method'] or 'team_qr'
    if join_method not in ('fewest_players', 'lowest_points'):
        conn.close()
        return jsonify({'error': 'This game does not allow automatic team assignment'}), 403

    # If the player is already in a team for this game, keep them there
    if player_id:
        cursor.execute('''
        SELECT p.team_id, p.name AS player_name, t.name AS team_name FROM players p
        JOIN teams t ON p.team_id = t.id
        WHERE p.id = ? AND t.game_id = ?
        ''', (player_id, game_id))
        existing_player = cursor.fetchone()

        if existing_player:
            conn.close()
            return jsonify({
                'player_id': player_id,
                'player_name': existing_player['player_name'],
                'team_id': existing_player['team_id'],
                'team_name': existing_player['team_name']
            })

    cursor.execute('SELECT * FROM teams WHERE game_id = ?', (game_id,))
    teams = cursor.fetchall()

    if not teams:
        conn.close()
        return jsonify({'error': 'No teams available to join yet'}), 400

    # Rank teams by the configured metric, breaking ties randomly
    ranked = []
    for team in teams:
        if join_method == 'fewest_players':
            cursor.execute('SELECT COUNT(*) FROM players WHERE team_id = ?', (team['id'],))
            metric = cursor.fetchone()[0]
        else:  # lowest_points
            metric = calculate_team_score(cursor, team['id'], game)
        ranked.append((metric, team))

    lowest = min(metric for metric, _ in ranked)
    chosen_team = random.choice([team for metric, team in ranked if metric == lowest])

    if not player_id:
        player_id = str(uuid.uuid4())

    player_name = generate_player_name(cursor, game_id)
    cursor.execute('''
    INSERT INTO players (id, team_id, name, join_time)
    VALUES (?, ?, ?, ?)
    ''', (player_id, chosen_team['id'], player_name, current_time))

    conn.commit()
    conn.close()

    return jsonify({
        'player_id': player_id,
        'player_name': player_name,
        'team_id': chosen_team['id'],
        'team_name': chosen_team['name']
    })

# Capture a base
@app.route('/api/bases/<base_id>/capture', methods=['POST'])
def capture_base(base_id):
    data = request.json
    if (not data or 'player_id' not in data or 'latitude' not in data
            or 'longitude' not in data or 'qr_code' not in data):
        return jsonify({'error': 'Missing required fields'}), 400

    player_id = data['player_id']
    player_lat = data['latitude']
    player_lng = data['longitude']

    conn = get_db_connection()
    cursor = conn.cursor()

    # Get base location and game settings
    cursor.execute('''
    SELECT b.*, g.capture_radius_meters, g.status AS game_status, g.quiz_enabled FROM bases b
    JOIN games g ON b.game_id = g.id
    WHERE b.id = ?
    ''', (base_id,))
    base_data = cursor.fetchone()

    if not base_data:
        conn.close()
        return jsonify({'error': 'Base not found'}), 404

    if base_data['deleted_at'] is not None:
        conn.close()
        return jsonify({'error': 'This base has been removed from the game'}), 410

    if base_data['game_status'] != 'active':
        conn.close()
        if base_data['game_status'] == 'bonus':
            return jsonify({'error': 'The main game has ended. Bases can no longer be captured - collect them in for bonus points instead.'}), 403
        return jsonify({'error': 'Bases can only be captured while the game is active'}), 403

    if base_data['quiz_enabled']:
        conn.close()
        return jsonify({'error': 'This game uses quiz capture. Start a scan session instead.'}), 400

    # The scanned code proves the player found the marker; the distance check
    # below proves they are standing at it. A capture needs both.
    if not scanned_code_matches(base_data['qr_code'], data['qr_code']):
        conn.close()
        return jsonify({'error': 'That QR code does not belong to this base. Scan the code on the base itself.'}), 403

    # Get player's team and confirm they belong to this base's game
    cursor.execute('''
    SELECT p.team_id, t.game_id, t.name AS team_name, t.color AS team_color FROM players p
    JOIN teams t ON p.team_id = t.id
    WHERE p.id = ?
    ''', (player_id,))
    player = cursor.fetchone()

    if not player:
        conn.close()
        return jsonify({'error': 'Player not found'}), 404

    if player['game_id'] != base_data['game_id']:
        conn.close()
        return jsonify({'error': 'Player is not part of this game'}), 403

    team_id = player['team_id']

    # Use configurable capture radius
    capture_radius = base_data['capture_radius_meters']
    distance = calculate_distance(player_lat, player_lng, base_data['latitude'], base_data['longitude'])

    if distance > capture_radius:
        conn.close()
        return jsonify({'error': f'Player is not within {capture_radius}m of the base location'}), 403

    # Record the capture
    capture_id = str(uuid.uuid4())
    current_time = int(time.time())

    cursor.execute('''
    INSERT INTO captures (id, base_id, team_id, capture_time)
    VALUES (?, ?, ?, ?)
    ''', (capture_id, base_id, team_id, current_time))

    cursor.execute('UPDATE bases SET owner_team_id = ? WHERE id = ?', (team_id, base_id))

    conn.commit()
    conn.close()

    # Notify everyone watching this game about the capture
    broadcast_game_event(base_data['game_id'], {
        'type': 'base_captured',
        'base_id': base_id,
        'base_name': base_data['name'],
        'team_id': team_id,
        'team_name': player['team_name'],
        'team_color': player['team_color'],
        'capture_time': current_time
    })

    return jsonify({'success': True})

# ==========================================================
# Player Positions - Live Location Sharing
# ==========================================================

# Players report their GPS fix here while they play so the host can see
# where everyone is. Only the latest fix is kept - there is deliberately no
# route history.
@app.route('/api/players/<player_id>/position', methods=['POST'])
def update_player_position(player_id):
    data = request.json
    if not data or 'latitude' not in data or 'longitude' not in data:
        return jsonify({'error': 'Missing required fields'}), 400

    try:
        latitude = float(data['latitude'])
        longitude = float(data['longitude'])
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid coordinates'}), 400

    if not (-90 <= latitude <= 90) or not (-180 <= longitude <= 180):
        return jsonify({'error': 'Invalid coordinates'}), 400

    accuracy = data.get('accuracy')
    if accuracy is not None:
        try:
            accuracy = float(accuracy)
        except (TypeError, ValueError):
            accuracy = None
        else:
            if accuracy < 0:
                accuracy = None

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
    SELECT p.id, g.status AS game_status FROM players p
    JOIN teams t ON p.team_id = t.id
    JOIN games g ON t.game_id = g.id
    WHERE p.id = ?
    ''', (player_id,))
    player = cursor.fetchone()

    if not player:
        conn.close()
        return jsonify({'error': 'Player not found'}), 404

    # Once a game is over there is nothing left to track
    if player['game_status'] == 'ended':
        conn.close()
        return jsonify({'error': 'Game has ended'}), 403

    cursor.execute('''
    UPDATE players
    SET last_latitude = ?, last_longitude = ?, last_accuracy = ?, last_position_time = ?
    WHERE id = ?
    ''', (latitude, longitude, accuracy, int(time.time()), player_id))

    conn.commit()
    conn.close()

    return jsonify({'success': True})

# Host-only view of where everyone was last seen. Player positions are not
# exposed through the shared game payload, so one team can't track another.
@app.route('/api/games/<game_id>/positions', methods=['GET'])
def get_player_positions(game_id):
    host_id = request_host_id()
    if not host_id:
        return jsonify({'error': 'Host ID required'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM games WHERE id = ?', (game_id,))
    game = cursor.fetchone()

    if not game:
        conn.close()
        return jsonify({'error': 'Game not found'}), 404

    if game['host_id'] != host_id:
        conn.close()
        return jsonify({'error': 'Unauthorized: host ID does not match game owner'}), 403

    cursor.execute('''
    SELECT p.id, p.name, p.last_latitude, p.last_longitude, p.last_accuracy,
           p.last_position_time, t.id AS team_id, t.name AS team_name, t.color AS team_color
    FROM players p
    JOIN teams t ON p.team_id = t.id
    WHERE t.game_id = ? AND p.last_latitude IS NOT NULL AND p.last_longitude IS NOT NULL
    ORDER BY p.last_position_time DESC
    ''', (game_id,))
    rows = cursor.fetchall()
    conn.close()

    positions = [{
        'playerId': row['id'],
        'playerName': row['name'],
        'teamId': row['team_id'],
        'teamName': row['team_name'],
        'teamColor': row['team_color'],
        'lat': row['last_latitude'],
        'lng': row['last_longitude'],
        'accuracy': row['last_accuracy'],
        'timestamp': row['last_position_time']
    } for row in rows]

    return jsonify({'positions': positions, 'serverTime': int(time.time())})


# ==========================================================
# Announcements - the host broadcasts to everyone in the game
# ==========================================================

# Long enough for a round of instructions, short enough to stay readable in a
# toast on a phone held at arm's length in the rain
ANNOUNCEMENT_MAX_LENGTH = 500

# Only the most recent announcements are served; a game is short enough that
# this is never reached in practice, but it keeps the payload bounded
ANNOUNCEMENT_HISTORY_LIMIT = 200


def announcement_row_to_dict(row):
    """Shape one announcement row for the client."""
    return {
        'id': row['id'],
        'body': row['body'],
        'sentAt': row['sent_at']
    }


def read_announcement_body(data):
    """Pull the announcement text out of a request body.

    Returns (body, error) where exactly one of the two is set.
    """
    body = (data or {}).get('body')
    if not isinstance(body, str):
        return None, 'Announcement text required'

    body = body.strip()
    if not body:
        return None, 'Announcement text required'

    if len(body) > ANNOUNCEMENT_MAX_LENGTH:
        return None, f'Announcement must be {ANNOUNCEMENT_MAX_LENGTH} characters or fewer'

    return body, None


def fetch_announcements(cursor, game_id):
    """Read a game's most recent live announcements, oldest first.

    A withdrawn announcement is gone for everyone, host included: the row is
    kept so the deployment can still answer for what was sent (see
    docs/COMPLIANCE.md), but nothing serves it again.
    """
    cursor.execute("""
    SELECT id, body, sent_at FROM announcements
    WHERE game_id = ? AND deleted_at IS NULL
    ORDER BY sent_at DESC, rowid DESC
    LIMIT ?
    """, (game_id, ANNOUNCEMENT_HISTORY_LIMIT))

    return [announcement_row_to_dict(row) for row in reversed(cursor.fetchall())]


# Host posts an announcement to everyone in the game
@app.route('/api/games/<game_id>/announcements', methods=['POST'])
def send_announcement(game_id):
    data = request.json or {}
    host_id = data.get('host_id')
    if not host_id:
        return jsonify({'error': 'Host ID required'}), 400

    body, error = read_announcement_body(data)
    if error:
        return jsonify({'error': error}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT host_id FROM games WHERE id = ?', (game_id,))
    game = cursor.fetchone()

    if not game:
        conn.close()
        return jsonify({'error': 'Game not found'}), 404

    if game['host_id'] != host_id:
        conn.close()
        return jsonify({'error': 'Unauthorized: host ID does not match game owner'}), 403

    announcement_id = str(uuid.uuid4())
    sent_at = int(time.time())

    cursor.execute("""
    INSERT INTO announcements (id, game_id, body, sent_at)
    VALUES (?, ?, ?, ?)
    """, (announcement_id, game_id, body, sent_at))

    conn.commit()
    conn.close()

    # Anyone who knows a game code can listen on its socket, so the event says
    # only that there is something new; the text is served to players below
    broadcast_game_event(game_id, {'type': 'announcement_posted'})

    return jsonify({'id': announcement_id, 'body': body, 'sentAt': sent_at}), 201


# Host withdraws something they sent - a typo, a wrong instruction, or content
# that has to come down. The row is kept with a deletion time rather than
# removed: the deployment can still answer for what was sent if someone
# complains about it, while nothing serves it to a player again.
@app.route('/api/games/<game_id>/announcements/<announcement_id>', methods=['DELETE'])
def delete_announcement(game_id, announcement_id):
    data = request.get_json(silent=True) or {}
    host_id = data.get('host_id')
    if not host_id:
        return jsonify({'error': 'Host ID required'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT host_id FROM games WHERE id = ?', (game_id,))
    game = cursor.fetchone()

    if not game:
        conn.close()
        return jsonify({'error': 'Game not found'}), 404

    if game['host_id'] != host_id:
        conn.close()
        return jsonify({'error': 'Unauthorized: host ID does not match game owner'}), 403

    cursor.execute("""
    SELECT deleted_at FROM announcements WHERE id = ? AND game_id = ?
    """, (announcement_id, game_id))
    announcement = cursor.fetchone()

    if not announcement:
        conn.close()
        return jsonify({'error': 'Announcement not found'}), 404

    if announcement['deleted_at'] is not None:
        conn.close()
        return jsonify({'error': 'Announcement is already deleted'}), 400

    deleted_at = int(time.time())
    cursor.execute('UPDATE announcements SET deleted_at = ? WHERE id = ?',
                   (deleted_at, announcement_id))

    conn.commit()
    conn.close()

    # Same reasoning as posting: the event says only that the list changed
    broadcast_game_event(game_id, {'type': 'announcement_deleted'})

    return jsonify({'success': True, 'id': announcement_id, 'deletedAt': deleted_at})


# The host's own record of what they have already sent
@app.route('/api/games/<game_id>/announcements', methods=['GET'])
def get_host_announcements(game_id):
    host_id = request_host_id()
    if not host_id:
        return jsonify({'error': 'Host ID required'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT host_id FROM games WHERE id = ?', (game_id,))
    game = cursor.fetchone()

    if not game:
        conn.close()
        return jsonify({'error': 'Game not found'}), 404

    if game['host_id'] != host_id:
        conn.close()
        return jsonify({'error': 'Unauthorized: host ID does not match game owner'}), 403

    announcements = fetch_announcements(cursor, game_id)
    conn.close()

    # Nothing is ever sent to the host, so there is nothing for them to read
    return jsonify({'announcements': announcements, 'unread': 0, 'serverTime': int(time.time())})


# A player's announcements, with a count of what they have not seen yet
@app.route('/api/players/<player_id>/announcements', methods=['GET'])
def get_player_announcements(player_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT p.announcements_read_at, t.game_id FROM players p
    JOIN teams t ON p.team_id = t.id
    WHERE p.id = ?
    """, (player_id,))
    player = cursor.fetchone()

    if not player:
        conn.close()
        return jsonify({'error': 'Player not found'}), 404

    announcements = fetch_announcements(cursor, player['game_id'])

    read_at = player['announcements_read_at'] or 0
    cursor.execute("""
    SELECT COUNT(*) FROM announcements
    WHERE game_id = ? AND sent_at > ? AND deleted_at IS NULL
    """, (player['game_id'], read_at))
    unread = cursor.fetchone()[0]

    conn.close()

    return jsonify({'announcements': announcements, 'unread': unread, 'serverTime': int(time.time())})


# Read marker, so the unread badge only counts what has not been shown yet
@app.route('/api/players/<player_id>/announcements/read', methods=['POST'])
def mark_announcements_read(player_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT announcements_read_at FROM players WHERE id = ?', (player_id,))
    player = cursor.fetchone()

    if not player:
        conn.close()
        return jsonify({'error': 'Player not found'}), 404

    # The client sends the timestamp of the newest announcement it actually
    # displayed, so one that lands between its fetch and this call stays
    # unread. Anything missing or out of range falls back to now.
    now = int(time.time())
    try:
        read_through = int((request.json or {}).get('read_through'))
    except (TypeError, ValueError):
        read_through = now

    read_through = max(min(read_through, now), player['announcements_read_at'] or 0)

    cursor.execute('UPDATE players SET announcements_read_at = ? WHERE id = ?', (read_through, player_id))
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'readThrough': read_through})



# Get current scores
@app.route('/api/games/<game_id>/scores', methods=['GET'])
def get_scores(game_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Get game info to determine scoring period
    cursor.execute('SELECT * FROM games WHERE id = ?', (game_id,))
    game = cursor.fetchone()

    if not game:
        conn.close()
        return jsonify({'error': 'Game not found'}), 404

    # Get teams
    cursor.execute('SELECT * FROM teams WHERE game_id = ?', (game_id,))
    teams_data = cursor.fetchall()

    scores = []

    for team in teams_data:
        # Count players
        cursor.execute('SELECT COUNT(*) FROM players WHERE team_id = ?', (team['id'],))
        player_count = cursor.fetchone()[0]

        # Calculate team score
        team_score = calculate_team_score(cursor, team['id'], game)

        scores.append({
            'id': team['id'],
            'name': team['name'],
            'color': team['color'],
            'playerCount': player_count,
            'score': team_score,
        })

    conn.close()

    # Sort by score (descending)
    scores.sort(key=lambda x: x['score'], reverse=True)

    return jsonify(scores)

# Check whether a QR code is already assigned to a team, base or host.
# Returns an error message string, or None if the code is free. A code held
# only by a soft-deleted base counts as free: deleted bases keep their code
# so the host can scan them in during the bonus round, and this reclaims it
# (the caller's commit makes the release permanent).
def qr_code_conflict(cursor, qr_code, exclude_base_id=None):
    cursor.execute('SELECT id FROM teams WHERE qr_code = ?', (qr_code,))
    if cursor.fetchone():
        return 'QR code already assigned to a team'

    if exclude_base_id:
        cursor.execute('SELECT id, deleted_at FROM bases WHERE qr_code = ? AND id != ?', (qr_code, exclude_base_id))
    else:
        cursor.execute('SELECT id, deleted_at FROM bases WHERE qr_code = ?', (qr_code,))
    base = cursor.fetchone()
    if base:
        if base['deleted_at'] is None:
            return 'QR code already assigned to a base'
        cursor.execute('UPDATE bases SET qr_code = NULL WHERE id = ?', (base['id'],))

    cursor.execute('SELECT id FROM hosts WHERE qr_code = ?', (qr_code,))
    if cursor.fetchone():
        return 'QR code already assigned to a host'

    return None

# Add a new base to a game
@app.route('/api/games/<game_id>/bases', methods=['POST'])
def add_base(game_id):
    data = request.json
    if not data or 'name' not in data or 'latitude' not in data or 'longitude' not in data or 'qr_code' not in data or 'host_id' not in data:
        return jsonify({'error': 'Missing required fields'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Verify game exists and host is authorized
    cursor.execute('SELECT * FROM games WHERE id = ?', (game_id,))
    game = cursor.fetchone()

    if not game:
        conn.close()
        return jsonify({'error': 'Game not found'}), 404

    if game['host_id'] != data['host_id']:
        conn.close()
        return jsonify({'error': 'Unauthorized: host ID does not match game owner'}), 403

    # Make sure the QR code is not already assigned to a team, base or host
    conflict = qr_code_conflict(cursor, data['qr_code'])
    if conflict:
        conn.close()
        return jsonify({'error': conflict}), 400

    # Add new base
    base_id = str(uuid.uuid4())

    try:
        cursor.execute('''
        INSERT INTO bases (id, game_id, name, latitude, longitude, qr_code)
        VALUES (?, ?, ?, ?, ?, ?)
        ''', (base_id, game_id, data['name'], data['latitude'], data['longitude'], data['qr_code']))

        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'QR code already exists'}), 400

    conn.close()

    return jsonify({'base_id': base_id}), 201

# Update base endpoint
@app.route('/api/bases/<base_id>', methods=['PUT'])
def update_base(base_id):
    data = request.json
    if not data or 'host_id' not in data:
        return jsonify({'error': 'Host ID required'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Get base and verify it exists and host owns the game
    cursor.execute('''
    SELECT b.*, g.host_id FROM bases b
    JOIN games g ON b.game_id = g.id
    WHERE b.id = ?
    ''', (base_id,))
    
    base = cursor.fetchone()
    
    if not base:
        conn.close()
        return jsonify({'error': 'Base not found'}), 404
    
    if base['host_id'] != data['host_id']:
        conn.close()
        return jsonify({'error': 'Unauthorized: host ID does not match game owner'}), 403
    
    # Check if base is deleted
    if base['deleted_at'] is not None:
        conn.close()
        return jsonify({'error': 'Cannot update a deleted base. Restore it first.'}), 400
    
    # Validate inputs
    name = data.get('name', base['name'])
    latitude = data.get('latitude', base['latitude'])
    longitude = data.get('longitude', base['longitude'])
    
    if not name or name.strip() == '':
        conn.close()
        return jsonify({'error': 'Base name cannot be empty'}), 400
    
    # Validate coordinates are numbers
    try:
        latitude = float(latitude)
        longitude = float(longitude)
    except (TypeError, ValueError):
        conn.close()
        return jsonify({'error': 'Invalid coordinates provided'}), 400
    
    # Validate coordinate ranges
    if not (-90 <= latitude <= 90):
        conn.close()
        return jsonify({'error': 'Latitude must be between -90 and 90'}), 400
    
    if not (-180 <= longitude <= 180):
        conn.close()
        return jsonify({'error': 'Longitude must be between -180 and 180'}), 400
    
    # Update the base
    cursor.execute('''
    UPDATE bases
    SET name = ?, latitude = ?, longitude = ?
    WHERE id = ?
    ''', (name.strip(), latitude, longitude, base_id))
    
    conn.commit()
    conn.close()
    
    return jsonify({'success': True})

# Delete base endpoint (soft delete)
@app.route('/api/bases/<base_id>', methods=['DELETE'])
def delete_base(base_id):
    data = request.json
    if not data or 'host_id' not in data or 'deleted_at' not in data:
        return jsonify({'error': 'Host ID and deleted_at timestamp required'}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get base and verify it exists and host owns the game
    cursor.execute('''
    SELECT b.*, g.host_id, g.status FROM bases b
    JOIN games g ON b.game_id = g.id
    WHERE b.id = ?
    ''', (base_id,))
    
    base = cursor.fetchone()
    
    if not base:
        conn.close()
        return jsonify({'error': 'Base not found'}), 404
    
    if base['host_id'] != data['host_id']:
        conn.close()
        return jsonify({'error': 'Unauthorized: host ID does not match game owner'}), 403
    
    # Check if already deleted
    if base['deleted_at'] is not None:
        conn.close()
        return jsonify({'error': 'Base is already deleted'}), 400
    
    # Validate deleted_at timestamp
    try:
        deleted_at = int(data['deleted_at'])
        if deleted_at < 0:
            raise ValueError('deleted_at cannot be negative')
    except (TypeError, ValueError):
        conn.close()
        return jsonify({'error': 'Invalid deleted_at timestamp'}), 400

    # Scoring can't continue past the actual deletion, so cap future timestamps.
    # Also keep the value >= 1: a stored 0 ("delete from game start") is falsy in
    # the frontend JavaScript, which would make the base look active again.
    deleted_at = max(1, min(deleted_at, int(time.time())))
    
    # If deleting the last base in an active game, prevent it
    if base['status'] == 'active':
        cursor.execute('''
        SELECT COUNT(*) FROM bases 
        WHERE game_id = ? AND deleted_at IS NULL
        ''', (base['game_id'],))
        
        active_base_count = cursor.fetchone()[0]
        
        if active_base_count <= 1:
            conn.close()
            return jsonify({'error': 'Cannot delete the last active base in a running game'}), 400
    
    # Soft delete the base. The QR code stays attached so the host can still
    # scan the physical code in during the bonus round; it is reclaimed when
    # reassigned (see qr_code_conflict) or when the game ends.
    cursor.execute('''
    UPDATE bases
    SET deleted_at = ?
    WHERE id = ?
    ''', (deleted_at, base_id))
    
    # Count affected captures for response
    cursor.execute('''
    SELECT COUNT(*) FROM captures
    WHERE base_id = ?
    ''', (base_id,))
    
    capture_count = cursor.fetchone()[0]
    
    conn.commit()
    conn.close()
    
    return jsonify({
        'success': True,
        'affected_captures': capture_count
    })

# Restore base endpoint
@app.route('/api/bases/<base_id>/restore', methods=['POST'])
def restore_base(base_id):
    data = request.json
    if not data or 'host_id' not in data or 'qr_code' not in data:
        return jsonify({'error': 'Host ID and QR code required'}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get base and verify it exists and host owns the game
    cursor.execute('''
    SELECT b.*, g.host_id FROM bases b
    JOIN games g ON b.game_id = g.id
    WHERE b.id = ?
    ''', (base_id,))
    
    base = cursor.fetchone()
    
    if not base:
        conn.close()
        return jsonify({'error': 'Base not found'}), 404
    
    if base['host_id'] != data['host_id']:
        conn.close()
        return jsonify({'error': 'Unauthorized: host ID does not match game owner'}), 403
    
    # Check if base is actually deleted
    if base['deleted_at'] is None:
        conn.close()
        return jsonify({'error': 'Base is not deleted'}), 400
    
    # Validate QR code is not already in use
    qr_code = data['qr_code']
    conflict = qr_code_conflict(cursor, qr_code, exclude_base_id=base_id)
    if conflict:
        conn.close()
        return jsonify({'error': conflict}), 400

    # Restore the base
    cursor.execute('''
    UPDATE bases
    SET deleted_at = NULL, qr_code = ?
    WHERE id = ?
    ''', (qr_code, base_id))
    
    conn.commit()
    conn.close()
    
    return jsonify({'success': True})

# Add a new team to a game with QR code
@app.route('/api/games/<game_id>/teams', methods=['POST'])
def add_team(game_id):
    data = request.json
    if not data or 'name' not in data or 'color' not in data or 'host_id' not in data or 'qr_code' not in data:
        return jsonify({'error': 'Missing required fields'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Verify game exists and host is authorized
    cursor.execute('SELECT * FROM games WHERE id = ?', (game_id,))
    game = cursor.fetchone()

    if not game:
        conn.close()
        return jsonify({'error': 'Game not found'}), 404

    if game['host_id'] != data['host_id']:
        conn.close()
        return jsonify({'error': 'Unauthorized: host ID does not match game owner'}), 403

    # Make sure the QR code is not already assigned to a team, base or host
    conflict = qr_code_conflict(cursor, data['qr_code'])
    if conflict:
        conn.close()
        return jsonify({'error': conflict}), 400

    # Generate a secure UUID for the team ID
    team_id = str(uuid.uuid4())

    try:
        # Insert the team
        cursor.execute('''
        INSERT INTO teams (id, game_id, name, color, qr_code)
        VALUES (?, ?, ?, ?, ?)
        ''', (team_id, game_id, data['name'], data['color'], data['qr_code']))

        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Error creating team'}), 400

    conn.close()

    return jsonify({'team_id': team_id}), 201

# Get QR code assignment status
@app.route('/api/qr-codes/<qr_code>/status', methods=['GET'])
def check_qr_code_status(qr_code):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if QR code is assigned to a team
    cursor.execute('SELECT id, game_id FROM teams WHERE qr_code = ?', (qr_code,))
    team = cursor.fetchone()

    if team:
        conn.close()
        return jsonify({
            'status': 'team',
            'team_id': team['id'],
            'game_id': team['game_id']
        })

    # Check if QR code is assigned to a base. Soft-deleted bases keep their
    # code so the host can still scan them in during the bonus round; the
    # deleted flag lets the client treat the code as reusable otherwise.
    cursor.execute('SELECT id, game_id, deleted_at FROM bases WHERE qr_code = ?', (qr_code,))
    base = cursor.fetchone()

    if base:
        conn.close()
        return jsonify({
            'status': 'base',
            'base_id': base['id'],
            'game_id': base['game_id'],
            'deleted': base['deleted_at'] is not None
        })

    # Check if QR code is assigned to a host
    cursor.execute('SELECT id, name, expiry_date FROM hosts WHERE qr_code = ?', (qr_code,))
    host = cursor.fetchone()

    if host:
        # Check if host has expired
        expired = False
        if host['expiry_date'] and host['expiry_date'] < int(time.time()):
            expired = True

        conn.close()
        return jsonify({
            'status': 'host',
            'host_id': host['id'],
            'name': host['name'],
            'expired': expired
        })

    # If not assigned
    conn.close()
    return jsonify({'status': 'unassigned'})

# Calculate distance between two GPS points in meters
def calculate_distance(lat1, lon1, lat2, lon2):
    # Haversine formula for calculating distance between GPS coordinates
    R = 6371  # Earth radius in kilometers

    # Convert to radians
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)

    # Differences
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad

    # Haversine formula
    a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    distance = R * c

    # Convert to meters
    return distance * 1000

# ==========================================================
# Quiz Capture - Question Bank
# ==========================================================

VALID_QUESTION_TYPES = ('mc', 'tf')

def question_row_to_dict(row, include_answer=True):
    """Serialise a question row for host-side bank management. Includes the
    correct answer and explanation - never use this for a served question."""
    options = json.loads(row['options']) if row['options'] else None
    if row['type'] == 'tf' and options is None:
        options = [{'id': 'true', 'text': 'True'}, {'id': 'false', 'text': 'False'}]

    result = {
        'id': row['id'],
        'host_id': row['host_id'],
        'text': row['text'],
        'type': row['type'],
        'options': options,
        'category': row['category'],
        'active': bool(row['active'])
    }
    if include_answer:
        result['correct_option_id'] = row['correct_option_id']
        result['explanation'] = row['explanation']
    return result

def build_question_row(payload, host_id, existing=None):
    """Validate a question payload (Section 9 shape) and build the row to
    store. Returns (row_dict, error_message)."""
    text = payload.get('text', existing['text'] if existing else None)
    q_type = payload.get('type', existing['type'] if existing else None)
    category = payload.get('category', existing['category'] if existing else None)
    explanation = payload.get('explanation', existing['explanation'] if existing else None)

    if not text or not str(text).strip():
        return None, 'Question text is required'
    if q_type not in VALID_QUESTION_TYPES:
        return None, "Question type must be 'mc' or 'tf'"
    if not category or not str(category).strip():
        return None, 'Category is required'

    if q_type == 'mc':
        # If neither options nor a new correct answer were resubmitted on an
        # edit, keep the existing options/correct answer untouched.
        if (payload.get('options') is None and payload.get('correct') is None
                and existing and existing['type'] == 'mc'):
            return {
                'text': str(text).strip(),
                'type': q_type,
                'options': existing['options'],
                'correct_option_id': existing['correct_option_id'],
                'explanation': explanation,
                'category': str(category).strip()
            }, None

        raw_options = payload.get('options')
        if raw_options is None and existing and existing['type'] == 'mc':
            raw_options = [o['text'] for o in json.loads(existing['options'] or '[]')]
        if not raw_options or not isinstance(raw_options, list) or len(raw_options) < 2:
            return None, 'Multiple-choice questions need at least two options'
        option_texts = [str(o).strip() for o in raw_options]
        if any(not o for o in option_texts):
            return None, 'Options cannot be blank'

        correct = payload.get('correct', None)
        if correct is None:
            return None, 'A correct option must be specified'

        built_options = [{'id': str(uuid.uuid4()), 'text': t} for t in option_texts]

        correct_option_id = None
        if isinstance(correct, bool):
            return None, 'Correct option must be an option index or matching text for mc questions'
        if isinstance(correct, int):
            if not (0 <= correct < len(built_options)):
                return None, 'Correct option index is out of range'
            correct_option_id = built_options[correct]['id']
        else:
            correct_str = str(correct).strip().lower()
            matches = [o for o in built_options if o['text'].strip().lower() == correct_str]
            if len(matches) != 1:
                return None, 'Correct option must match exactly one of the supplied options'
            correct_option_id = matches[0]['id']

        return {
            'text': str(text).strip(),
            'type': q_type,
            'options': json.dumps(built_options),
            'correct_option_id': correct_option_id,
            'explanation': explanation,
            'category': str(category).strip()
        }, None

    else:  # tf
        correct = payload.get('correct', None)
        if correct is None and existing and existing['type'] == 'tf':
            correct = existing['correct_option_id']

        if isinstance(correct, bool):
            correct_option_id = 'true' if correct else 'false'
        elif isinstance(correct, str) and correct.strip().lower() in ('true', 'false'):
            correct_option_id = correct.strip().lower()
        else:
            return None, "True/false questions need correct set to true or false"

        return {
            'text': str(text).strip(),
            'type': q_type,
            'options': None,
            'correct_option_id': correct_option_id,
            'explanation': explanation,
            'category': str(category).strip()
        }, None

@app.route('/api/host/questions', methods=['GET'])
@require_host
def get_questions(host_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM questions WHERE host_id = ? ORDER BY category, text', (host_id,))
    questions = [question_row_to_dict(row) for row in cursor.fetchall()]
    conn.close()

    return jsonify(questions)

@app.route('/api/host/categories', methods=['GET'])
@require_host
def get_host_categories(host_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT DISTINCT category FROM questions WHERE host_id = ? ORDER BY category', (host_id,))
    categories = [row['category'] for row in cursor.fetchall()]
    conn.close()

    return jsonify(categories)

@app.route('/api/host/questions', methods=['POST'])
@require_host
def create_question(host_id):
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    row, error = build_question_row(data, host_id)
    if error:
        conn.close()
        return jsonify({'error': error}), 400

    question_id = str(uuid.uuid4())
    cursor.execute('''
    INSERT INTO questions (id, host_id, text, type, options, correct_option_id, explanation, category, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    ''', (question_id, host_id, row['text'], row['type'], row['options'],
          row['correct_option_id'], row['explanation'], row['category']))

    conn.commit()

    cursor.execute('SELECT * FROM questions WHERE id = ?', (question_id,))
    result = question_row_to_dict(cursor.fetchone())
    conn.close()

    return jsonify(result), 201

@app.route('/api/host/questions/<question_id>', methods=['PUT'])
@require_host
def update_question(host_id, question_id):
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM questions WHERE id = ? AND host_id = ?', (question_id, host_id))
    existing = cursor.fetchone()
    if not existing:
        conn.close()
        return jsonify({'error': 'Question not found'}), 404

    row, error = build_question_row(data, host_id, existing=existing)
    if error:
        conn.close()
        return jsonify({'error': error}), 400

    active = data.get('active', bool(existing['active']))

    cursor.execute('''
    UPDATE questions
    SET text = ?, type = ?, options = ?, correct_option_id = ?, explanation = ?, category = ?, active = ?
    WHERE id = ?
    ''', (row['text'], row['type'], row['options'], row['correct_option_id'],
          row['explanation'], row['category'], int(bool(active)), question_id))

    conn.commit()

    cursor.execute('SELECT * FROM questions WHERE id = ?', (question_id,))
    result = question_row_to_dict(cursor.fetchone())
    conn.close()

    return jsonify(result)

def categories_in_running_games(cursor, host_id):
    """Categories a running game is drawing questions from. 'active' games
    serve new questions; 'bonus' games can still resolve an open answer
    session, so both block deletion."""
    cursor.execute('''
        SELECT active_categories FROM games
        WHERE host_id = ? AND quiz_enabled = 1 AND status IN ('active', 'bonus')
    ''', (host_id,))
    used = set()
    for row in cursor.fetchall():
        used.update(json.loads(row['active_categories'] or '[]'))
    return used

@app.route('/api/host/questions/<question_id>', methods=['DELETE'])
@require_host
def delete_question(host_id, question_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM questions WHERE id = ? AND host_id = ?', (question_id, host_id))
    question = cursor.fetchone()
    if not question:
        conn.close()
        return jsonify({'error': 'Question not found'}), 404

    # A question in a running game's pool may already be on a player's
    # screen (Section 15), so it can only be disabled until the game ends.
    if question['category'] in categories_in_running_games(cursor, host_id):
        conn.close()
        return jsonify({'error': 'This question is in use by a running game. Disable it instead, or delete it after the game ends.'}), 409

    cursor.execute('DELETE FROM questions WHERE id = ?', (question_id,))
    conn.commit()
    conn.close()

    return jsonify({'success': True})

@app.route('/api/host/questions/bulk-delete', methods=['POST'])
@require_host
def bulk_delete_questions(host_id):
    data = request.json
    if not data or not isinstance(data.get('question_ids'), list) or not data['question_ids']:
        return jsonify({'error': 'Provide a non-empty "question_ids" array'}), 400

    question_ids = [str(q) for q in data['question_ids']]

    conn = get_db_connection()
    cursor = conn.cursor()

    used_categories = categories_in_running_games(cursor, host_id)

    placeholders = ','.join('?' for _ in question_ids)
    cursor.execute(f'SELECT * FROM questions WHERE host_id = ? AND id IN ({placeholders})',
                   [host_id] + question_ids)
    found = cursor.fetchall()

    deletable = [q['id'] for q in found if q['category'] not in used_categories]
    if deletable:
        placeholders = ','.join('?' for _ in deletable)
        cursor.execute(f'DELETE FROM questions WHERE id IN ({placeholders})', deletable)

    conn.commit()
    conn.close()

    return jsonify({
        'deleted': len(deletable),
        'in_use': len(found) - len(deletable),
        'not_found': len(question_ids) - len(found)
    })

@app.route('/api/host/questions/bulk', methods=['POST'])
@require_host
def bulk_import_questions(host_id):
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    rows = data.get('questions')
    if rows is None and 'csv' in data:
        try:
            reader = csv.DictReader(io.StringIO(data['csv']))
            rows = []
            for csv_row in reader:
                parsed = dict(csv_row)
                if 'options' in parsed and parsed['options']:
                    parsed['options'] = [o.strip() for o in parsed['options'].split('|')]
                rows.append(parsed)
        except Exception as e:
            conn.close()
            return jsonify({'error': f'Could not parse CSV: {str(e)}'}), 400

    if not isinstance(rows, list):
        conn.close()
        return jsonify({'error': 'Provide either a "questions" array or a "csv" string'}), 400

    imported = 0
    errors = []

    for index, payload in enumerate(rows):
        if not isinstance(payload, dict):
            errors.append({'row': index, 'error': 'Row must be an object'})
            continue

        row, error = build_question_row(payload, host_id)
        if error:
            errors.append({'row': index, 'error': error})
            continue

        question_id = str(uuid.uuid4())
        cursor.execute('''
        INSERT INTO questions (id, host_id, text, type, options, correct_option_id, explanation, category, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
        ''', (question_id, host_id, row['text'], row['type'], row['options'],
              row['correct_option_id'], row['explanation'], row['category']))
        imported += 1

    conn.commit()
    conn.close()

    # Always 200: this is a validation report, not a request failure - the
    # per-row errors (if any) are for the host to review, not a rejected call
    return jsonify({'imported': imported, 'errors': errors})

# ==========================================================
# Quiz Capture - Scan Sessions
# ==========================================================

def select_question(cursor, host_id, categories, served_ids):
    """Pick a random active question from the game's pool, avoiding
    already-served questions where the pool allows (Section 6)."""
    if not categories:
        return None
    placeholders = ','.join('?' for _ in categories)
    cursor.execute(f'''
        SELECT * FROM questions WHERE host_id = ? AND active = 1 AND category IN ({placeholders})
    ''', [host_id] + list(categories))
    pool = cursor.fetchall()
    if not pool:
        return None

    candidates = [q for q in pool if q['id'] not in served_ids]
    if not candidates:
        candidates = pool  # Pool exhausted - repeats are permitted

    return random.choice(candidates)

def serialize_question_for_client(question):
    """Strip the correct answer and explanation before sending to a player."""
    if question['type'] == 'tf':
        options = [{'id': 'true', 'text': 'True'}, {'id': 'false', 'text': 'False'}]
    else:
        options = json.loads(question['options'])
        options = options[:]
        random.shuffle(options)

    return {
        'id': question['id'],
        'text': question['text'],
        'type': question['type'],
        'options': options
    }

@app.route('/api/bases/<base_id>/session/start', methods=['POST'])
def start_session(base_id):
    data = request.json
    if (not data or 'player_id' not in data or 'latitude' not in data
            or 'longitude' not in data or 'qr_code' not in data):
        return jsonify({'error': 'Missing required fields'}), 400

    player_id = data['player_id']
    player_lat = data['latitude']
    player_lng = data['longitude']

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
    SELECT b.*, g.capture_radius_meters, g.status AS game_status, g.quiz_enabled,
           g.active_categories, g.host_id AS game_host_id
    FROM bases b JOIN games g ON b.game_id = g.id
    WHERE b.id = ?
    ''', (base_id,))
    base_data = cursor.fetchone()

    if not base_data:
        conn.close()
        return jsonify({'error': 'Base not found'}), 404

    if base_data['deleted_at'] is not None:
        conn.close()
        return jsonify({'error': 'This base has been removed from the game'}), 410

    if not base_data['quiz_enabled']:
        conn.close()
        return jsonify({'error': 'Quiz capture is not enabled for this game'}), 400

    if base_data['game_status'] != 'active':
        conn.close()
        if base_data['game_status'] == 'bonus':
            return jsonify({'error': 'The main game has ended. Bases can no longer be captured - collect them in for bonus points instead.'}), 403
        return jsonify({'error': 'Bases can only be captured while the game is active'}), 403

    # As in capture_base: the scanned code proves the player found the marker,
    # the distance check below proves they are at it.
    if not scanned_code_matches(base_data['qr_code'], data['qr_code']):
        conn.close()
        return jsonify({'error': 'That QR code does not belong to this base. Scan the code on the base itself.'}), 403

    cursor.execute('''
    SELECT p.*, t.game_id, t.name AS team_name FROM players p
    JOIN teams t ON p.team_id = t.id
    WHERE p.id = ?
    ''', (player_id,))
    player = cursor.fetchone()

    if not player:
        conn.close()
        return jsonify({'error': 'Player not found'}), 404

    if player['game_id'] != base_data['game_id']:
        conn.close()
        return jsonify({'error': 'Player is not part of this game'}), 403

    current_time = int(time.time())

    if player['cooldown_until'] and player['cooldown_until'] > current_time:
        conn.close()
        return jsonify({'error': 'You are in cooldown', 'cooldown_until': player['cooldown_until']}), 403

    capture_radius = base_data['capture_radius_meters']
    distance = calculate_distance(player_lat, player_lng, base_data['latitude'], base_data['longitude'])
    if distance > capture_radius:
        conn.close()
        return jsonify({'error': f'Player is not within {capture_radius}m of the base location'}), 403

    categories = json.loads(base_data['active_categories'] or '[]')
    question = select_question(cursor, base_data['game_host_id'], categories, [])
    if not question:
        conn.close()
        return jsonify({'error': 'No questions are available for this game'}), 400

    # Scanning a new base ends any previous open session (Section 15)
    cursor.execute('UPDATE answer_sessions SET active = 0 WHERE player_id = ? AND active = 1', (player_id,))

    session_id = str(uuid.uuid4())
    served_ids = [question['id']]
    cursor.execute('''
    INSERT INTO answer_sessions (id, player_id, base_id, started_at, served_question_ids, active)
    VALUES (?, ?, ?, ?, ?, 1)
    ''', (session_id, player_id, base_id, current_time, json.dumps(served_ids)))

    conn.commit()
    conn.close()

    return jsonify({
        'session_id': session_id,
        'base': {
            'id': base_data['id'],
            'name': base_data['name'],
            'shield': base_data['shield'] or 0,
            'owner_team_id': base_data['owner_team_id']
        },
        'question': serialize_question_for_client(question)
    })

@app.route('/api/sessions/<session_id>/answer', methods=['POST'])
def answer_session(session_id):
    data = request.json
    if not data or 'question_id' not in data or 'submitted_option_id' not in data:
        return jsonify({'error': 'Missing required fields'}), 400

    question_id = data['question_id']
    submitted_option_id = str(data['submitted_option_id'])

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM answer_sessions WHERE id = ?', (session_id,))
    session = cursor.fetchone()

    if not session:
        conn.close()
        return jsonify({'error': 'Session not found'}), 404

    if not session['active']:
        conn.close()
        return jsonify({'error': 'This session is no longer active'}), 400

    # served_question_ids is ordered; only the most recently served question
    # is currently open for this session. Without this, a player could keep
    # resubmitting a question they already answered correctly to farm
    # unlimited reinforcements from a single known answer.
    served_ids = json.loads(session['served_question_ids'] or '[]')
    if not served_ids or question_id != served_ids[-1]:
        conn.close()
        return jsonify({'error': 'This question is not currently open in this session'}), 400

    cursor.execute('''
    SELECT p.*, t.id AS team_id, t.game_id, t.name AS team_name, t.color AS team_color FROM players p
    JOIN teams t ON p.team_id = t.id
    WHERE p.id = ?
    ''', (session['player_id'],))
    player = cursor.fetchone()

    cursor.execute('''
    SELECT b.*, g.status AS game_status, g.max_shield, g.cooldown_seconds, g.host_id AS game_host_id, g.active_categories
    FROM bases b JOIN games g ON b.game_id = g.id
    WHERE b.id = ?
    ''', (session['base_id'],))
    base = cursor.fetchone()

    cursor.execute('SELECT * FROM questions WHERE id = ?', (question_id,))
    question = cursor.fetchone()

    if not player or not base or not question:
        conn.close()
        return jsonify({'error': 'Session references data that no longer exists'}), 404

    current_time = int(time.time())
    is_correct = submitted_option_id == question['correct_option_id']

    # The main game ended while this question was on screen. The answer has
    # no effect either way - no capture, no cooldown - and instead of the
    # next question the client is pointed at the bonus-round collect flow.
    if base['game_status'] != 'active':
        cursor.execute('UPDATE answer_sessions SET active = 0 WHERE id = ?', (session_id,))
        conn.commit()
        conn.close()
        return jsonify({
            'correct': is_correct,
            'explanation': question['explanation'],
            'game_status': base['game_status'],
            'bonus_round': base['game_status'] == 'bonus',
            'next_question': None
        })

    if not is_correct:
        cooldown_until = current_time + base['cooldown_seconds']
        cursor.execute('UPDATE players SET cooldown_until = ? WHERE id = ?', (cooldown_until, player['id']))
        cursor.execute('UPDATE answer_sessions SET active = 0 WHERE id = ?', (session_id,))
        conn.commit()
        conn.close()
        return jsonify({
            'correct': False,
            'cooldown_until': cooldown_until,
            'explanation': question['explanation']
        })

    # Correct answer: resolve against the base's live state (Section 4.1).
    # BEGIN IMMEDIATE claims SQLite's write lock before we re-read the base,
    # so the read and the write happen as one atomic step - without it, two
    # concurrent answers could both read shield=N and both write back N+1,
    # silently losing one reinforcement (a classic read-modify-write race).
    cursor.execute('BEGIN IMMEDIATE')
    cursor.execute('SELECT shield, owner_team_id FROM bases WHERE id = ?', (base['id'],))
    live_base = cursor.fetchone()

    team_id = player['team_id']
    owner = live_base['owner_team_id']
    shield = live_base['shield'] or 0
    outcome = None
    new_shield = shield
    new_owner = owner

    if owner == team_id and owner is not None:
        if shield < base['max_shield']:
            new_shield = shield + 1
            cursor.execute('UPDATE bases SET shield = ? WHERE id = ? AND shield = ?', (new_shield, base['id'], shield))
            outcome = 'reinforced'
        else:
            outcome = 'already_max'
    elif owner is not None and shield > 0:
        new_shield = shield - 1
        if new_shield == 0:
            new_owner = None
            cursor.execute('UPDATE bases SET shield = 0, owner_team_id = NULL WHERE id = ? AND shield = ?', (base['id'], shield))
            cursor.execute('''
            INSERT INTO captures (id, base_id, team_id, capture_time) VALUES (?, ?, NULL, ?)
            ''', (str(uuid.uuid4()), base['id'], current_time))
            outcome = 'neutralised'
        else:
            cursor.execute('UPDATE bases SET shield = ? WHERE id = ? AND shield = ?', (new_shield, base['id'], shield))
            outcome = 'reduced'
    else:
        new_shield = 1
        new_owner = team_id
        cursor.execute('UPDATE bases SET shield = 1, owner_team_id = ? WHERE id = ?', (team_id, base['id']))
        cursor.execute('''
        INSERT INTO captures (id, base_id, team_id, capture_time) VALUES (?, ?, ?, ?)
        ''', (str(uuid.uuid4()), base['id'], team_id, current_time))
        outcome = 'captured'

    categories = json.loads(base['active_categories'] or '[]')
    next_question = select_question(cursor, base['game_host_id'], categories, served_ids)
    next_question_payload = None
    if next_question:
        served_ids.append(next_question['id'])
        next_question_payload = serialize_question_for_client(next_question)

    cursor.execute('UPDATE answer_sessions SET served_question_ids = ? WHERE id = ?',
                   (json.dumps(served_ids), session_id))

    conn.commit()
    conn.close()

    if outcome != 'already_max':
        broadcast_game_event(base['game_id'], {
            'type': 'base_state_changed',
            'base_id': base['id'],
            'base_name': base['name'],
            'team_id': team_id,
            'team_name': player['team_name'],
            'team_color': player['team_color'],
            'shield': new_shield,
            'owner_team_id': new_owner,
            'outcome': outcome,
            'capture_time': current_time
        })

    return jsonify({
        'correct': True,
        'shield_now': new_shield,
        'owner_now': new_owner,
        'outcome': outcome,
        'next_question': next_question_payload
    })

# Update team name and color
@app.route('/api/teams/<team_id>', methods=['PUT'])
def update_team(team_id):
    data = request.json
    if not data or 'host_id' not in data:
        return jsonify({'error': 'Host ID required'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Get team and game info
    cursor.execute('''
    SELECT t.*, g.host_id FROM teams t
    JOIN games g ON t.game_id = g.id
    WHERE t.id = ?
    ''', (team_id,))

    team = cursor.fetchone()

    if not team:
        conn.close()
        return jsonify({'error': 'Team not found'}), 404

    if team['host_id'] != data['host_id']:
        conn.close()
        return jsonify({'error': 'Unauthorized: host ID does not match game owner'}), 403

    # Update team details
    update_fields = []
    params = []

    if 'name' in data:
        update_fields.append('name = ?')
        params.append(data['name'])

    if 'color' in data:
        update_fields.append('color = ?')
        params.append(data['color'])

    if not update_fields:
        conn.close()
        return jsonify({'error': 'No fields to update'}), 400

    params.append(team_id)

    cursor.execute(
        f"UPDATE teams SET {', '.join(update_fields)} WHERE id = ?",
        params
    )

    conn.commit()
    conn.close()

    return jsonify({'success': True})

# Delete a team (only while it is empty, so no scores or history are lost)
@app.route('/api/teams/<team_id>', methods=['DELETE'])
def delete_team(team_id):
    data = request.json
    if not data or 'host_id' not in data:
        return jsonify({'error': 'Host ID required'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
    SELECT t.*, g.host_id FROM teams t
    JOIN games g ON t.game_id = g.id
    WHERE t.id = ?
    ''', (team_id,))

    team = cursor.fetchone()

    if not team:
        conn.close()
        return jsonify({'error': 'Team not found'}), 404

    if team['host_id'] != data['host_id']:
        conn.close()
        return jsonify({'error': 'Unauthorized: host ID does not match game owner'}), 403

    # A team that anyone joined keeps its players, captures and score, so it
    # can only be removed while it is still empty - during setup or once the
    # game is under way and it is clear nobody is using it
    cursor.execute('SELECT COUNT(*) FROM players WHERE team_id = ?', (team_id,))
    if cursor.fetchone()[0] > 0:
        conn.close()
        return jsonify({'error': 'Cannot delete a team that has players'}), 400

    # Defensive: an empty team should have no game history, but never drop a
    # team that is still referenced by captures or bases
    cursor.execute('SELECT COUNT(*) FROM captures WHERE team_id = ?', (team_id,))
    if cursor.fetchone()[0] > 0:
        conn.close()
        return jsonify({'error': 'Cannot delete a team that has captured bases'}), 400

    cursor.execute('''
    SELECT COUNT(*) FROM bases
    WHERE owner_team_id = ? OR collected_by_team_id = ?
    ''', (team_id, team_id))
    if cursor.fetchone()[0] > 0:
        conn.close()
        return jsonify({'error': 'Cannot delete a team that owns or has collected a base'}), 400

    # Removing the row frees the team's QR code for reuse (see qr_code_conflict)
    cursor.execute('DELETE FROM teams WHERE id = ?', (team_id,))

    conn.commit()
    conn.close()

    broadcast_game_event(team['game_id'], {
        'type': 'team_deleted',
        'team_id': team_id,
        'team_name': team['name']
    })

    return jsonify({'success': True})

# Delete a game and everything in it. A host can clear away a game nobody
# joined - a mis-scanned setup, a game that never ran. Once a player has
# joined, the game holds other people's data and its history is what a
# complaint or an erasure request would be answered from, so deleting it is
# the site administrator's call: the host ends the game instead.
@app.route('/api/games/<game_id>', methods=['DELETE'])
def delete_game(game_id):
    # A site admin deleting from the admin panel has no host id to send, so
    # the body is optional for them - and may not be there at all
    data = request.get_json(silent=True) or {}
    is_admin = request_is_site_admin()

    if not is_admin and 'host_id' not in data:
        return jsonify({'error': 'Host ID required'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Verify game exists and the caller is allowed to delete it
    cursor.execute('SELECT * FROM games WHERE id = ?', (game_id,))
    game = cursor.fetchone()

    if not game:
        conn.close()
        return jsonify({'error': 'Game not found'}), 404

    if not is_admin:
        if game['host_id'] != data['host_id']:
            conn.close()
            return jsonify({'error': 'Unauthorized: host ID does not match game owner'}), 403

        cursor.execute("""
        SELECT COUNT(*) FROM players
        WHERE team_id IN (SELECT id FROM teams WHERE game_id = ?)
        """, (game_id,))

        if cursor.fetchone()[0] > 0:
            conn.close()
            return jsonify({
                'error': 'Players have joined this game, so it can no longer be deleted. '
                         'End the game instead, or ask a site administrator to remove it.'
            }), 403

    try:
        # Begin transaction for cascade deletion
        cursor.execute('BEGIN')

        # The cascade itself lives with the retention sweeper, so deleting a
        # game by hand and purging one that has aged out clear exactly the
        # same set of tables
        deleted = purge_game_data(cursor, game_id)

        # Commit the transaction
        cursor.execute('COMMIT')

    except sqlite3.Error as e:
        # Rollback on error
        cursor.execute('ROLLBACK')
        conn.close()
        return jsonify({'error': f'Database error: {str(e)}'}), 500

    conn.close()

    return jsonify({
        'success': True,
        'message': 'Game and all associated data deleted successfully',
        'deleted': deleted
    })

# ==========================================================
# Game Export - the whole record of one game, in one file
# ==========================================================

# A deployment is the data controller for what it stores, and thirty days
# after a game ends the purge takes the lot (see docs/COMPLIANCE.md). This is
# how a site administrator gets the record out before that happens, or answers
# a complaint or a subject access request from it afterwards: everything the
# database holds about one game, in one JSON file, in one request.
#
# It is the site administrator's, not the host's. The host already sees its
# own game live; this exists for the person who has to answer for the
# deployment, and it is a file of other people's data leaving the system, so
# it takes the admin bearer token.
#
# Credentials are left out. Host ids and QR codes are bearer secrets - anyone
# holding one can act as that host, or join that team - and an export is a
# file that gets saved, emailed and forwarded. Nothing here needs them: the
# host is named, and a base or team is identified by its id.

EXPORT_FORMAT = 'qr-conquest-game-export'
EXPORT_FORMAT_VERSION = 1

_FILENAME_SAFE = set('abcdefghijklmnopqrstuvwxyz0123456789')


def iso_time(timestamp):
    """A unix timestamp as UTC ISO 8601, or None. Every time in the export is
    given twice - the raw number the database holds, and this, so a human
    reading the file does not have to convert anything."""
    if not timestamp:
        return None
    return datetime.fromtimestamp(timestamp, timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def export_filename(game_name, when):
    """A download name built from the game's name and the export date. Only
    ASCII letters, digits and dashes survive, so the name is safe both as a
    filename and in the Content-Disposition header."""
    slug = ''.join(ch if ch in _FILENAME_SAFE else '-' for ch in (game_name or '').lower())
    slug = '-'.join(part for part in slug.split('-') if part)[:60].strip('-')
    stamp = datetime.fromtimestamp(when, timezone.utc).strftime('%Y%m%d')

    return f'qr-conquest-{slug or "game"}-{stamp}.json'


def build_game_export(cursor, game):
    """Assemble the full record of one game."""
    game_id = game['id']
    now = int(time.time())

    cursor.execute('SELECT name FROM hosts WHERE id = ?', (game['host_id'],))
    host = cursor.fetchone()

    # Players, keyed by team, so the export reads the way the roster does
    cursor.execute("""
    SELECT p.*, t.game_id FROM players p
    JOIN teams t ON p.team_id = t.id
    WHERE t.game_id = ?
    ORDER BY p.join_time ASC
    """, (game_id,))
    players_by_team = {}
    player_ids = []

    for player in cursor.fetchall():
        player_ids.append(player['id'])

        # Normally None: positions are cleared the moment a game ends. They
        # are still here for a game exported mid-play, because an export is
        # meant to say what the database actually holds
        last_position = None
        if player['last_latitude'] is not None and player['last_longitude'] is not None:
            last_position = {
                'lat': player['last_latitude'],
                'lng': player['last_longitude'],
                'accuracy': player['last_accuracy'],
                'recorded_at': player['last_position_time'],
                'recorded_at_iso': iso_time(player['last_position_time'])
            }

        players_by_team.setdefault(player['team_id'], []).append({
            'id': player['id'],
            'name': player['name'],
            'join_time': player['join_time'],
            'join_time_iso': iso_time(player['join_time']),
            'announcements_read_at': player['announcements_read_at'],
            'announcements_read_at_iso': iso_time(player['announcements_read_at']),
            'last_position': last_position
        })

    cursor.execute('SELECT * FROM teams WHERE game_id = ? ORDER BY name ASC', (game_id,))
    teams = []
    for team in cursor.fetchall():
        teams.append({
            'id': team['id'],
            'name': team['name'],
            'color': team['color'],
            'final_score': calculate_team_score(cursor, team['id'], game),
            'players': players_by_team.get(team['id'], [])
        })

    cursor.execute('SELECT * FROM bases WHERE game_id = ? ORDER BY name ASC', (game_id,))
    bases = []
    for base in cursor.fetchall():
        bases.append({
            'id': base['id'],
            'name': base['name'],
            'lat': base['latitude'],
            'lng': base['longitude'],
            'shield': base['shield'] or 0,
            'owner_team_id': base['owner_team_id'],
            'deleted_at': base['deleted_at'],
            'deleted_at_iso': iso_time(base['deleted_at']),
            'collected_by_team_id': base['collected_by_team_id'],
            'collected_at': base['collected_at'],
            'collected_at_iso': iso_time(base['collected_at']),
            'returned_at': base['returned_at'],
            'returned_at_iso': iso_time(base['returned_at'])
        })

    # The ownership timeline. A NULL team_id is a neutralisation - the base
    # stopped scoring for anyone until the next capture
    cursor.execute("""
    SELECT c.* FROM captures c
    JOIN bases b ON c.base_id = b.id
    WHERE b.game_id = ?
    ORDER BY c.capture_time ASC
    """, (game_id,))
    captures = [{
        'id': row['id'],
        'base_id': row['base_id'],
        'team_id': row['team_id'],
        'neutralised': row['team_id'] is None,
        'capture_time': row['capture_time'],
        'capture_time_iso': iso_time(row['capture_time'])
    } for row in cursor.fetchall()]

    # Withdrawn announcements are in here too, with the time they were pulled.
    # An announcement somebody complains about is usually one that was taken
    # back down, so an export without them would be missing the thing it was
    # asked for
    cursor.execute("""
    SELECT * FROM announcements WHERE game_id = ?
    ORDER BY sent_at ASC, rowid ASC
    """, (game_id,))
    announcements = [{
        'id': row['id'],
        'body': row['body'],
        'sent_at': row['sent_at'],
        'sent_at_iso': iso_time(row['sent_at']),
        'withdrawn_at': row['deleted_at'],
        'withdrawn_at_iso': iso_time(row['deleted_at'])
    } for row in cursor.fetchall()]

    # Quiz sessions, and the questions they served. The question bank belongs
    # to the host and outlives the game, so the questions this game actually
    # put in front of players are copied in - otherwise the record of what a
    # player was asked disappears the moment the host edits their bank
    answer_sessions = []
    served_question_ids = []

    if player_ids:
        placeholders = ','.join('?' * len(player_ids))
        cursor.execute(f"""
        SELECT * FROM answer_sessions WHERE player_id IN ({placeholders})
        ORDER BY started_at ASC
        """, player_ids)

        for row in cursor.fetchall():
            served = json.loads(row['served_question_ids'] or '[]')
            served_question_ids.extend(served)
            answer_sessions.append({
                'id': row['id'],
                'player_id': row['player_id'],
                'base_id': row['base_id'],
                'started_at': row['started_at'],
                'started_at_iso': iso_time(row['started_at']),
                'still_open': bool(row['active']),
                'served_question_ids': served
            })

    questions = []
    unique_question_ids = sorted(set(served_question_ids))
    if unique_question_ids:
        placeholders = ','.join('?' * len(unique_question_ids))
        cursor.execute(f'SELECT * FROM questions WHERE id IN ({placeholders})',
                       unique_question_ids)
        for row in cursor.fetchall():
            question = question_row_to_dict(row)
            # The bank-management shape carries the host id, which is a bearer
            # credential and has no business in a file that leaves the system
            question.pop('host_id', None)
            questions.append(question)

    # A host can delete a question from their bank once the game that served
    # it has ended, and then its text is simply gone. Saying which ids could
    # not be resolved is more honest than a file that quietly omits them
    found_ids = {question['id'] for question in questions}
    missing_question_ids = [qid for qid in unique_question_ids if qid not in found_ids]

    end_time = game['end_time']
    purge_after = game_purge_time(end_time)

    return {
        'export': {
            'format': EXPORT_FORMAT,
            'version': EXPORT_FORMAT_VERSION,
            'exported_at': now,
            'exported_at_iso': iso_time(now),
            'contains': [
                'Every row the database holds about this game, other than '
                'credentials: host ids and the QR codes that enrol a host, '
                'join a team or mark a base are bearer secrets and are '
                'deliberately left out.',
                'Player names are generated by the server as an '
                'adjective-animal handle. No player types anything, so no '
                'player-written text exists anywhere in this file.',
                'Announcements include ones the host withdrew, with the time '
                'they were withdrawn.',
                'Questions are copied from the host\'s bank as it stands now. '
                'A question the host has already deleted cannot be recovered '
                '- its id is listed under questions_missing instead. Export '
                'soon after a game if what players were asked matters.',
                'GPS positions are cleared when a game ends, so an ended '
                'game exports none. A game exported mid-play carries each '
                'player\'s last known fix.'
            ],
            'retention_days': GAME_RETENTION_DAYS,
            'purge_after': purge_after,
            'purge_after_iso': iso_time(purge_after)
        },
        'game': {
            'id': game_id,
            'name': game['name'],
            'status': game['status'],
            'host_name': host['name'] if host else None,
            'created_time': game['created_time'],
            'created_time_iso': iso_time(game['created_time']),
            'start_time': game['start_time'],
            'start_time_iso': iso_time(game['start_time']),
            'end_time': end_time,
            'end_time_iso': iso_time(end_time),
            'settings': {
                'capture_radius_meters': game['capture_radius_meters'],
                'points_interval_seconds': game['points_interval_seconds'],
                'auto_start_time': game['auto_start_time'],
                'auto_start_time_iso': iso_time(game['auto_start_time']),
                'game_duration_minutes': game['game_duration_minutes'],
                'join_method': game['join_method'] or 'team_qr',
                'quiz_enabled': bool(game['quiz_enabled']),
                'active_categories': json.loads(game['active_categories'] or '[]'),
                'max_shield': game['max_shield'],
                'cooldown_seconds': game['cooldown_seconds'],
                'bonus_round_enabled': bool(game['bonus_round_enabled']),
                'bonus_points_per_base': game['bonus_points_per_base'],
                'bonus_start_time': game['bonus_start_time'],
                'bonus_start_time_iso': iso_time(game['bonus_start_time'])
            }
        },
        'teams': teams,
        'bases': bases,
        'captures': captures,
        'announcements': announcements,
        'answer_sessions': answer_sessions,
        'questions_served': questions,
        'questions_missing': missing_question_ids
    }


@app.route('/api/games/<game_id>/export', methods=['GET'])
@require_site_admin
def export_game(game_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM games WHERE id = ?', (game_id,))
    game = cursor.fetchone()

    if not game:
        conn.close()
        return jsonify({'error': 'Game not found'}), 404

    export = build_game_export(cursor, game)
    conn.close()

    # Sent as a download rather than a JSON body: this is a file to file away,
    # and the point of it is that it survives the purge
    filename = export_filename(game['name'], export['export']['exported_at'])

    return Response(
        json.dumps(export, indent=2, ensure_ascii=False),
        mimetype='application/json',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'}
    )


def list_host_games(host_id):
    """One host's games, newest and most alive first.

    Shared by the host reading its own list and the site admin reading
    anyone's, so the two can never drift apart.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Verify host exists
    cursor.execute('SELECT * FROM hosts WHERE id = ?', (host_id,))
    host = cursor.fetchone()

    if not host:
        conn.close()
        return jsonify({'error': 'Host not found'}), 404

    # Check if host has expired
    if host['expiry_date'] and host['expiry_date'] < int(time.time()):
        conn.close()
        return jsonify({'error': 'Host account has expired'}), 403

    # Get all games for this host
    cursor.execute('''
    SELECT id, name, status, start_time, end_time
    FROM games
    WHERE host_id = ?
    ORDER BY
        CASE
            WHEN status = 'active' THEN 1
            WHEN status = 'setup' THEN 2
            ELSE 3
        END,
        COALESCE(start_time, 0) DESC
    ''', (host_id,))

    games = []
    for game in cursor.fetchall():
        # Get team count for each game
        cursor.execute('SELECT COUNT(*) FROM teams WHERE game_id = ?', (game['id'],))
        team_count = cursor.fetchone()[0]

        games.append({
            'id': game['id'],
            'name': game['name'],
            'status': game['status'],
            'start_time': game['start_time'],
            'end_time': game['end_time'],
            'team_count': team_count,
            # When the retention sweeper will delete this game, so a host or
            # an admin can see the clock rather than having to know the rule.
            # Null until the game ends - the clock starts then
            'purge_after': game_purge_time(game['end_time']),
            'retention_days': GAME_RETENTION_DAYS
        })

    conn.close()

    return jsonify(games)


# A host's own games, identified by its header credential
@app.route('/api/host/games', methods=['GET'])
@require_host
def get_host_games(host_id):
    return list_host_games(host_id)


# The same list for one host, read with the site admin's own token. The panel
# builds its cross-system view from the whole-system route below now, so this
# stands for reading a single host's games; the id names whose games to read,
# the bearer token is what authorises the request.
@app.route('/api/hosts/<host_id>/games', methods=['GET'])
@require_site_admin
def get_host_games_as_admin(host_id):
    return list_host_games(host_id)


# Every game in the system, with the counts the admin's games table shows.
#
# The panel used to assemble this itself: one request for the hosts, then one
# per host for their games, then one more for every game in the system to count
# its teams, bases and players - and that last one is the full game payload,
# the same heavy read every player polls. A deployment serving one request at a
# time (uWSGI with a single worker, which is what a small host gives you) spends
# minutes working through that, with everything else - a live game's players,
# and the admin's own next request - queued behind it. This answers the whole
# table in one request instead.
@app.route('/api/admin/games', methods=['GET'])
@require_site_admin
def get_all_games_as_admin():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
    SELECT g.id, g.name, g.status, g.start_time, g.end_time,
           g.host_id, h.name AS host_name,
           (SELECT COUNT(*) FROM teams t WHERE t.game_id = g.id) AS teams_count,
           (SELECT COUNT(*) FROM bases b WHERE b.game_id = g.id) AS bases_count,
           (SELECT COUNT(*) FROM players p
              JOIN teams t ON p.team_id = t.id
            WHERE t.game_id = g.id) AS players_count
    FROM games g
    JOIN hosts h ON g.host_id = h.id
    ORDER BY
        CASE
            WHEN g.status = 'active' THEN 1
            WHEN g.status = 'setup' THEN 2
            ELSE 3
        END,
        COALESCE(g.start_time, 0) DESC
    ''')

    games = [{
        'id': row['id'],
        'name': row['name'],
        'status': row['status'],
        'start_time': row['start_time'],
        'end_time': row['end_time'],
        'host_id': row['host_id'],
        'host_name': row['host_name'],
        'teams_count': row['teams_count'],
        'bases_count': row['bases_count'],
        'players_count': row['players_count'],
        # When the retention sweeper will delete this game; null until it ends
        'purge_after': game_purge_time(row['end_time']),
        'retention_days': GAME_RETENTION_DAYS
    } for row in cursor.fetchall()]

    conn.close()

    return jsonify(games)


# ==========================================================
# API Routes - Site Settings (Site Admin)
# ==========================================================

@app.route('/api/site-settings', methods=['GET'])
@require_site_admin
def get_site_settings():
    override = get_site_setting(ABUSE_CONTACT_SETTING)
    return jsonify({
        'abuse_contact_email': override or ABUSE_CONTACT_EMAIL,
        # Lets the admin panel say where the address in force came from, and
        # whether clearing the override leaves a fallback behind
        'abuse_contact_email_override': override,
        'abuse_contact_email_default': ABUSE_CONTACT_EMAIL
    })

@app.route('/api/site-settings', methods=['PUT'])
@require_site_admin
def update_site_settings():
    data = request.json
    if data is None or 'abuse_contact_email' not in data:
        return jsonify({'error': 'No settings provided'}), 400

    email = (data.get('abuse_contact_email') or '').strip()

    # An empty value clears the override so the ABUSE_CONTACT_EMAIL
    # environment variable applies again
    if email and not is_valid_email(email):
        return jsonify({'error': 'Enter a valid email address'}), 400

    try:
        set_site_setting(ABUSE_CONTACT_SETTING, email)
    except sqlite3.Error as e:
        return jsonify({'error': f'Database error: {str(e)}'}), 500

    return jsonify({
        'abuse_contact_email': email or ABUSE_CONTACT_EMAIL,
        'abuse_contact_email_override': email or None,
        'abuse_contact_email_default': ABUSE_CONTACT_EMAIL
    })

# Serve the SPA shell, injecting the debug-features flag so the client can
# decide whether to expose the mobile console and manual GPS entry tools, the
# abuse-reporting address so the reporting route appears without an extra
# round trip on a phone with patchy data, and the retention window the privacy
# notice quotes.
def render_index():
    index_path = os.path.join(app.static_folder, 'index.html')
    with open(index_path, 'r', encoding='utf-8') as f:
        html = f.read()
    if DEBUG_FEATURES:
        html = html.replace(
            'window.QRC_DEBUG_FEATURES = false;',
            'window.QRC_DEBUG_FEATURES = true;'
        )
    if not LIVE_EVENT_SOCKET:
        html = html.replace(
            'window.QRC_LIVE_EVENT_SOCKET = true;',
            'window.QRC_LIVE_EVENT_SOCKET = false;'
        )
    contact = get_abuse_contact_email()
    if contact:
        html = html.replace(
            'window.QRC_ABUSE_CONTACT = "";',
            # json.dumps leaves '<' alone, and the page shell is HTML, not JSON
            'window.QRC_ABUSE_CONTACT = %s;' % json.dumps(contact).replace('<', '\\u003c')
        )
    # The privacy notice tells players how long a finished game is kept, so it
    # has to quote the rule this deployment actually runs rather than the
    # default baked into the shell
    if GAME_RETENTION_DAYS != DEFAULT_GAME_RETENTION_DAYS:
        html = html.replace(
            'window.QRC_RETENTION_DAYS = %d;' % DEFAULT_GAME_RETENTION_DAYS,
            'window.QRC_RETENTION_DAYS = %d;' % GAME_RETENTION_DAYS
        )
    return Response(html, mimetype='text/html')

# Anything under /api that matched no route above is a client error, not a
# page. Without this the SPA catch-all below answers 200 with the HTML shell,
# so a client calling a mistyped or withdrawn endpoint gets a page where it
# expects JSON instead of a clean 404.
@app.route('/api/', defaults={'path': ''},
           methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
@app.route('/api/<path:path>',
           methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
def api_not_found(path):
    return jsonify({'error': 'Not found'}), 404

# Serve static files
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path not in ("", "index.html") and os.path.exists(app.static_folder + '/' + path):
        return send_from_directory(app.static_folder, path)
    else:
        return render_index()

if __name__ == '__main__':
    app.run(debug=True)