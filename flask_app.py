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
from datetime import datetime
import os
import math
import random
from functools import wraps

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

# Admin authentication decorator
def require_site_admin(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Unauthorized'}), 401

        token = auth_header.split(' ')[1]
        if not hmac.compare_digest(token, SITE_ADMIN_PASSWORD):
            return jsonify({'error': 'Unauthorized'}), 401

        return f(*args, **kwargs)
    return decorated_function

# ==========================================================
# Word Lists for Game Code Generation
# ==========================================================

ADJECTIVES = [
    'brave', 'calm', 'dark', 'fast', 'green', 'happy', 'jolly', 'kind', 'loud', 'magic',
    'new', 'orange', 'proud', 'quiet', 'red', 'shy', 'smart', 'strong', 'tall', 'tiny',
    'vivid', 'wild', 'yellow', 'zealous', 'ancient', 'bold', 'clever', 'daring', 'eager',
    'fancy', 'gentle', 'honest', 'icy', 'juicy', 'keen', 'lively', 'mighty', 'noble',
    'polite', 'quick', 'radiant', 'silver', 'tidy', 'unique', 'vibrant', 'witty', 'exotic',
    'young', 'zesty', 'blue', 'golden', 'royal', 'rustic', 'swift', 'lucky', 'merry', 'prime'
]

NOUNS = [
    'apple', 'bear', 'cloud', 'door', 'eagle', 'forest', 'garden', 'hill', 'island', 'jungle',
    'king', 'lake', 'mountain', 'night', 'ocean', 'planet', 'queen', 'river', 'star', 'tree',
    'unicorn', 'valley', 'whale', 'xylophone', 'yeti', 'zebra', 'arrow', 'bell', 'castle', 'diamond',
    'elephant', 'falcon', 'galaxy', 'harbor', 'igloo', 'jewel', 'knight', 'lantern', 'moon', 'ninja',
    'oasis', 'panda', 'quest', 'rocket', 'sailor', 'tiger', 'umbrella', 'village', 'warrior', 'yacht',
    'zeppelin', 'dragon', 'phoenix', 'treasure', 'wizard', 'crown', 'carnival', 'banana', 'compass', 'dolphin'
]

# Helper function to generate game codes - add after the word lists
def generate_game_code():
    """Generate a friendly game code using an adjective and a noun"""
    adjective = random.choice(ADJECTIVES)
    noun = random.choice(NOUNS)
    return f"{adjective}-{noun}"

# Helper function to generate a unique game code
def generate_unique_game_code():
    """Generate a unique friendly game code that doesn't exist in the database"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Try up to 10 times to generate a unique code
    for _ in range(10):
        code = generate_game_code()
        cursor.execute('SELECT id FROM games WHERE id = ?', (code,))
        if not cursor.fetchone():
            conn.close()
            return code

    # If we couldn't generate a unique code after 10 attempts,
    # add a random number suffix to ensure uniqueness
    code = f"{generate_game_code()}-{random.randint(1, 999)}"
    conn.close()
    return code


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

def broadcast_game_event(game_id, payload):
    """Send a JSON event to every client subscribed to a game."""
    message = json.dumps(payload)
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

# Host verification endpoint
@app.route('/api/hosts/verify/<qr_code>', methods=['GET'])
def verify_host(qr_code):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM hosts WHERE qr_code = ?', (qr_code,))
    host = cursor.fetchone()

    if not host:
        conn.close()
        return jsonify({'error': 'Invalid host QR code'}), 404

    # Check expiry
    if host['expiry_date'] and host['expiry_date'] < int(time.time()):
        conn.close()
        return jsonify({
            'status': 'expired',
            'host_id': host['id'],
            'name': host['name']
        })

    conn.close()

    return jsonify({
        'status': 'valid',
        'host_id': host['id'],
        'name': host['name'],
        'creation_date': host['creation_date'],
        'expiry_date': host['expiry_date']
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

    game_id = generate_unique_game_code()

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
@app.route('/api/games/<game_id>', methods=['GET'])
def get_game(game_id):
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

                # Release QR codes for reuse, matching the manual end-game flow
                cursor.execute('UPDATE bases SET qr_code = NULL WHERE game_id = ?', (game_id,))
                cursor.execute('UPDATE teams SET qr_code = NULL WHERE game_id = ?', (game_id,))
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

        teams.append({
            'id': team['id'],
            'name': team['name'],
            'color': team['color'],
            'qrCode': team['qr_code'],
            'playerCount': len(players),
            'players': players,
            'score': team_score,
        })

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

        bases.append({
            'id': base['id'],
            'name': base['name'],
            'lat': base['latitude'],
            'lng': base['longitude'],
            'ownedBy': owner,
            'shield': shield,
            'neutral': owner is None,
            'qrCode': base['qr_code'],
            'deleted_at': base['deleted_at'],
            'collectedBy': base['collected_by_team_id'],
            'collectedAt': base['collected_at'],
            'returnedAt': base['returned_at']
        })

    conn.close()

    # Calculate end time if duration is set
    calculated_end_time = None
    if game['start_time'] and game['game_duration_minutes']:
        calculated_end_time = game['start_time'] + (game['game_duration_minutes'] * 60)

    return jsonify({
        'id': game['id'],
        'name': game['name'],
        'status': game['status'],
        'hostName': game['host_name'],
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
    })

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

    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'released_bases': base_count,
        'released_teams': team_count
    })

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
    if not data or 'player_id' not in data or 'latitude' not in data or 'longitude' not in data:
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

# Join team
@app.route('/api/teams/<team_id>/join', methods=['POST'])
def join_team(team_id):
    data = request.json
    player_id = data.get('player_id') if data else None
    player_name = data.get('player_name', 'Anonymous Player') if data else 'Anonymous Player'
    current_time = int(time.time())

    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if team exists and get game info
    cursor.execute('''
    SELECT t.*, g.status FROM teams t
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
            return jsonify({'player_id': player_id})

    # Generate new player ID if not provided (new player joining)
    if not player_id:
        player_id = str(uuid.uuid4())

    # Add player to the new team
    cursor.execute('''
    INSERT INTO players (id, team_id, name, join_time)
    VALUES (?, ?, ?, ?)
    ''', (player_id, team_id, player_name, current_time))

    conn.commit()
    conn.close()

    return jsonify({'player_id': player_id})

# Join a game with automatic team assignment (fewest_players / lowest_points)
@app.route('/api/games/<game_id>/join', methods=['POST'])
def join_game(game_id):
    data = request.json or {}
    player_id = data.get('player_id')
    player_name = data.get('player_name', 'Anonymous Player')
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
        SELECT p.team_id, t.name FROM players p
        JOIN teams t ON p.team_id = t.id
        WHERE p.id = ? AND t.game_id = ?
        ''', (player_id, game_id))
        existing_player = cursor.fetchone()

        if existing_player:
            conn.close()
            return jsonify({
                'player_id': player_id,
                'team_id': existing_player['team_id'],
                'team_name': existing_player['name']
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

    cursor.execute('''
    INSERT INTO players (id, team_id, name, join_time)
    VALUES (?, ?, ?, ?)
    ''', (player_id, chosen_team['id'], player_name, current_time))

    conn.commit()
    conn.close()

    return jsonify({
        'player_id': player_id,
        'team_id': chosen_team['id'],
        'team_name': chosen_team['name']
    })

# Capture a base
@app.route('/api/bases/<base_id>/capture', methods=['POST'])
def capture_base(base_id):
    data = request.json
    if not data or 'player_id' not in data or 'latitude' not in data or 'longitude' not in data:
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

@app.route('/api/hosts/<host_id>/questions', methods=['GET'])
def get_questions(host_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM hosts WHERE id = ?', (host_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'error': 'Host not found'}), 404

    cursor.execute('SELECT * FROM questions WHERE host_id = ? ORDER BY category, text', (host_id,))
    questions = [question_row_to_dict(row) for row in cursor.fetchall()]
    conn.close()

    return jsonify(questions)

@app.route('/api/hosts/<host_id>/categories', methods=['GET'])
def get_host_categories(host_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM hosts WHERE id = ?', (host_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'error': 'Host not found'}), 404

    cursor.execute('SELECT DISTINCT category FROM questions WHERE host_id = ? ORDER BY category', (host_id,))
    categories = [row['category'] for row in cursor.fetchall()]
    conn.close()

    return jsonify(categories)

@app.route('/api/hosts/<host_id>/questions', methods=['POST'])
def create_question(host_id):
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM hosts WHERE id = ?', (host_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'error': 'Host not found'}), 404

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

@app.route('/api/hosts/<host_id>/questions/<question_id>', methods=['PUT'])
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

@app.route('/api/hosts/<host_id>/questions/<question_id>', methods=['DELETE'])
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

@app.route('/api/hosts/<host_id>/questions/bulk-delete', methods=['POST'])
def bulk_delete_questions(host_id):
    data = request.json
    if not data or not isinstance(data.get('question_ids'), list) or not data['question_ids']:
        return jsonify({'error': 'Provide a non-empty "question_ids" array'}), 400

    question_ids = [str(q) for q in data['question_ids']]

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM hosts WHERE id = ?', (host_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'error': 'Host not found'}), 404

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

@app.route('/api/hosts/<host_id>/questions/bulk', methods=['POST'])
def bulk_import_questions(host_id):
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM hosts WHERE id = ?', (host_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'error': 'Host not found'}), 404

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
    if not data or 'player_id' not in data or 'latitude' not in data or 'longitude' not in data:
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

# Delete game (host can delete their own games)
@app.route('/api/games/<game_id>', methods=['DELETE'])
def delete_game(game_id):
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

    try:
        # Begin transaction for cascade deletion
        cursor.execute('BEGIN')

        # Get all teams for this game to delete their QR code mappings
        cursor.execute('SELECT id FROM teams WHERE game_id = ?', (game_id,))
        team_ids = [row[0] for row in cursor.fetchall()]

        # Count what we're about to delete for reporting
        cursor.execute('SELECT COUNT(*) FROM captures WHERE base_id IN (SELECT id FROM bases WHERE game_id = ?)', (game_id,))
        captures_count = cursor.fetchone()[0]

        cursor.execute('SELECT COUNT(*) FROM players WHERE team_id IN (SELECT id FROM teams WHERE game_id = ?)', (game_id,))
        players_count = cursor.fetchone()[0]

        cursor.execute('SELECT COUNT(*) FROM bases WHERE game_id = ?', (game_id,))
        bases_count = cursor.fetchone()[0]

        cursor.execute('SELECT COUNT(*) FROM teams WHERE game_id = ?', (game_id,))
        teams_count = cursor.fetchone()[0]

        # Delete captures (must be deleted before bases and teams due to foreign keys)
        cursor.execute('DELETE FROM captures WHERE base_id IN (SELECT id FROM bases WHERE game_id = ?)', (game_id,))

        # Delete players (must be deleted before teams due to foreign keys)
        cursor.execute('DELETE FROM players WHERE team_id IN (SELECT id FROM teams WHERE game_id = ?)', (game_id,))

        # Delete teams
        cursor.execute('DELETE FROM teams WHERE game_id = ?', (game_id,))

        # Delete bases (this will also clear their QR codes)
        cursor.execute('DELETE FROM bases WHERE game_id = ?', (game_id,))

        # Finally delete the game itself
        cursor.execute('DELETE FROM games WHERE id = ?', (game_id,))

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
        'deleted': {
            'teams': teams_count,
            'bases': bases_count,
            'players': players_count,
            'captures': captures_count
        }
    })

# generate QR code for a host
@app.route('/api/hosts/<host_id>/qr-code', methods=['GET'])
@require_site_admin
def get_host_qr_code(host_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT qr_code FROM hosts WHERE id = ?', (host_id,))
    host = cursor.fetchone()

    if not host:
        conn.close()
        return jsonify({'error': 'Host not found'}), 404

    conn.close()

    base_url = request.host_url.rstrip('/')
    qr_url = f"{base_url}/?id={host['qr_code']}"

    return jsonify({
        'qr_code': host['qr_code'],
        'url': qr_url
    })

#list all games for a specific host
@app.route('/api/hosts/<host_id>/games', methods=['GET'])
def get_host_games(host_id):
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
            'team_count': team_count
        })

    conn.close()

    return jsonify(games)

# Get host details
@app.route('/api/hosts/<host_id>', methods=['GET'])
def get_host(host_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM hosts WHERE id = ?', (host_id,))
    host = cursor.fetchone()

    if not host:
        conn.close()
        return jsonify({'error': 'Host not found'}), 404

    # Count games for this host
    cursor.execute('SELECT COUNT(*) FROM games WHERE host_id = ?', (host_id,))
    game_count = cursor.fetchone()[0]

    # Check if expired
    expired = False
    if host['expiry_date'] and host['expiry_date'] < int(time.time()):
        expired = True

    conn.close()

    return jsonify({
        'id': host['id'],
        'name': host['name'],
        'qr_code': host['qr_code'],
        'expiry_date': host['expiry_date'],
        'creation_date': host['creation_date'],
        'game_count': game_count,
        'expired': expired
    })

# Regenerate a host's QR code
@app.route('/api/hosts/<host_id>/regenerate-qr', methods=['POST'])
@require_site_admin
def regenerate_host_qr(host_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if host exists
    cursor.execute('SELECT * FROM hosts WHERE id = ?', (host_id,))
    host = cursor.fetchone()

    if not host:
        conn.close()
        return jsonify({'error': 'Host not found'}), 404

    # Generate new QR code
    new_qr = str(uuid.uuid4())

    try:
        cursor.execute('''
        UPDATE hosts SET qr_code = ? WHERE id = ?
        ''', (new_qr, host_id))

        conn.commit()
    except sqlite3.Error as e:
        conn.close()
        return jsonify({'error': f'Database error: {str(e)}'}), 500

    conn.close()

    return jsonify({
        'id': host_id,
        'qr_code': new_qr
    })

# Serve the SPA shell, injecting the debug-features flag so the client can
# decide whether to expose the mobile console and manual GPS entry tools.
def render_index():
    index_path = os.path.join(app.static_folder, 'index.html')
    with open(index_path, 'r', encoding='utf-8') as f:
        html = f.read()
    if DEBUG_FEATURES:
        html = html.replace(
            'window.QRC_DEBUG_FEATURES = false;',
            'window.QRC_DEBUG_FEATURES = true;'
        )
    return Response(html, mimetype='text/html')

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