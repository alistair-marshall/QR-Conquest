from flask import Flask, request, jsonify, send_from_directory
import sqlite3
import uuid
import time
import json
from datetime import datetime
import os
import math
import random
from functools import wraps

app = Flask(__name__, static_folder='static')

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

# Admin authentication decorator
def require_site_admin(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Unauthorized'}), 401
        
        token = auth_header.split(' ')[1]
        if token != SITE_ADMIN_PASSWORD:
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
    conn = sqlite3.connect('qr_game.db')
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
            created_time INTEGER NOT NULL,
            FOREIGN KEY (host_id) REFERENCES hosts (id)
        )
        ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        FOREIGN KEY (game_id) REFERENCES games (id)
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL,
        join_time INTEGER NOT NULL,
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
        FOREIGN KEY (game_id) REFERENCES games (id)
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS captures (
        id TEXT PRIMARY KEY,
        base_id TEXT NOT NULL,
        team_id TEXT NOT NULL,
        capture_time INTEGER NOT NULL,
        FOREIGN KEY (base_id) REFERENCES bases (id),
        FOREIGN KEY (team_id) REFERENCES teams (id)
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS team_qr_codes (
        team_id TEXT PRIMARY KEY,
        qr_code TEXT UNIQUE NOT NULL,
        FOREIGN KEY (team_id) REFERENCES teams (id)
    )
    ''')

    conn.commit()
    conn.close()

init_db()


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
        return jsonify({'error': 'Cannot delete host with active games'}), 400
    
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

# Helper function to validate game settings
def validate_game_settings(capture_radius, points_interval, game_duration):
    """Validate game settings and return error message if invalid"""
    
    # Validate capture radius (5m to 100m)
    if not (5 <= capture_radius <= 100):
        return 'Capture radius must be between 5 and 100 metres'
    
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
    
    return None  # No validation errors

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
    
    # Validate settings
    validation_error = validate_game_settings(capture_radius, points_interval, game_duration)
    if validation_error:
        conn.close()
        return jsonify({'error': validation_error}), 400
    
    if auto_start_time is not None and auto_start_time <= int(time.time()):
        conn.close()
        return jsonify({'error': 'Auto-start time must be in the future'}), 400

    current_time = int(time.time())
    
    cursor.execute('''
    INSERT INTO games (id, host_id, name, status, capture_radius_meters, points_interval_seconds, 
                      auto_start_time, game_duration_minutes, created_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (game_id, host_id, data['name'], 'setup', capture_radius, points_interval, 
          auto_start_time, game_duration, current_time))

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

    # Can only update settings for games in setup status
    if game['status'] != 'setup':
        conn.close()
        return jsonify({'error': 'Cannot update settings for games that have started'}), 400

    # Extract current settings for validation
    capture_radius = data.get('capture_radius_meters', game['capture_radius_meters'])
    points_interval = data.get('points_interval_seconds', game['points_interval_seconds'])
    game_duration = data.get('game_duration_minutes', game['game_duration_minutes'])
    
    # Validate all settings together
    validation_error = validate_game_settings(capture_radius, points_interval, game_duration)
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

    # Get teams
    cursor.execute('SELECT * FROM teams WHERE game_id = ?', (game_id,))
    teams_data = cursor.fetchall()
    teams = []

    for team in teams_data:
        # Count players
        cursor.execute('SELECT COUNT(*) FROM players WHERE team_id = ?', (team['id'],))
        player_count = cursor.fetchone()[0]

        # Calculate team score (fixed logic)
        team_score = calculate_team_score(cursor, team['id'], game)

        teams.append({
            'id': team['id'],
            'name': team['name'],
            'color': team['color'],
            'playerCount': player_count,
            'score': team_score,
        })

    # Get bases
    cursor.execute('SELECT * FROM bases WHERE game_id = ?', (game_id,))
    bases_data = cursor.fetchall()
    bases = []

    for base in bases_data:
        # Get current owner (most recent capture)
        cursor.execute('''
        SELECT team_id FROM captures
        WHERE base_id = ?
        ORDER BY capture_time DESC
        LIMIT 1
        ''', (base['id'],))

        owner_data = cursor.fetchone()
        owner = owner_data['team_id'] if owner_data else None

        bases.append({
            'id': base['id'],
            'name': base['name'],
            'lat': base['latitude'],
            'lng': base['longitude'],
            'ownedBy': owner,
            'qrCode': base['qr_code']
        })

# Check for auto-start
    current_time = int(time.time())
    if (game['status'] == 'setup' and 
        game['auto_start_time'] and 
        current_time >= game['auto_start_time']):
        
        # Auto-start the game
        cursor.execute('''
        UPDATE games
        SET status = 'active', start_time = ?
        WHERE id = ?
        ''', (current_time, game_id))
        conn.commit()
        
        # Refresh game data
        cursor.execute('''
        SELECT g.*, h.name as host_name 
        FROM games g
        JOIN hosts h ON g.host_id = h.id
        WHERE g.id = ?
        ''', (game_id,))
        game = cursor.fetchone()

    # Check for auto-end
    if (game['status'] == 'active' and 
        game['start_time'] and 
        game['game_duration_minutes']):
        
        end_time = game['start_time'] + (game['game_duration_minutes'] * 60)
        if current_time >= end_time:
            # Auto-end the game
            cursor.execute('''
            UPDATE games
            SET status = 'ended', end_time = ?
            WHERE id = ?
            ''', (end_time, game_id))
            conn.commit()
            
            # Clear QR code assignments
            cursor.execute('''
            UPDATE bases SET qr_code = NULL WHERE game_id = ?
            ''', (game_id,))
            
            cursor.execute('''
            DELETE FROM team_qr_codes
            WHERE team_id IN (SELECT id FROM teams WHERE game_id = ?)
            ''', (game_id,))
            
            conn.commit()
            
            # Refresh game data
            cursor.execute('''
            SELECT g.*, h.name as host_name 
            FROM games g
            JOIN hosts h ON g.host_id = h.id
            WHERE g.id = ?
            ''', (game_id,))
            game = cursor.fetchone()

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
            'game_duration_minutes': game['game_duration_minutes'],
            'calculated_end_time': calculated_end_time
        },
        'teams': teams,
        'bases': bases
    })

# Helper function to calculate team score
def calculate_team_score(cursor, team_id, game):
    total_score = 0

    # Get all bases for this game
    cursor.execute('SELECT id FROM bases WHERE game_id = ?', (game['id'],))
    bases = cursor.fetchall()

    # Calculate current time or end time if game is over
    current_time = game['end_time'] if game['status'] == 'ended' else int(time.time())
    
    # Get the points interval from game settings
    points_interval = game['points_interval_seconds']

    # For each base, calculate points earned by this team
    for base in bases:
        base_id = base['id']

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
                    end_time = current_time

                # Calculate points using configurable interval
                duration = end_time - start_time
                points = duration // points_interval
                total_score += points

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
    DELETE FROM team_qr_codes
    WHERE team_id IN (SELECT id FROM teams WHERE game_id = ?)
    ''', (game_id,))
    
    team_count = cursor.rowcount

    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'released_bases': base_count,
        'released_teams': team_count
    })

# Join team
@app.route('/api/teams/<team_id>/join', methods=['POST'])
def join_team(team_id):
    data = request.json
    player_id = data.get('player_id') if data else None
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
            
            # Remove player from their current team
            cursor.execute('DELETE FROM players WHERE id = ?', (player_id,))
            print(f"Removed player {player_id} from previous team {existing_player['team_id']}")

    # Generate new player ID if not provided (new player joining)
    if not player_id:
        player_id = str(uuid.uuid4())

    # Add player to the new team
    cursor.execute('''
    INSERT INTO players (id, team_id, join_time)
    VALUES (?, ?, ?)
    ''', (player_id, team_id, current_time))

    conn.commit()
    conn.close()

    return jsonify({'player_id': player_id})

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
    SELECT b.*, g.capture_radius_meters FROM bases b
    JOIN games g ON b.game_id = g.id
    WHERE b.id = ?
    ''', (base_id,))
    base_data = cursor.fetchone()

    if not base_data:
        conn.close()
        return jsonify({'error': 'Base not found'}), 404

    # Get player's team
    cursor.execute('SELECT team_id FROM players WHERE id = ?', (player_id,))
    player = cursor.fetchone()

    if not player:
        conn.close()
        return jsonify({'error': 'Player not found'}), 404

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

    conn.commit()
    conn.close()

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

    # Check if QR code is already assigned to a base
    cursor.execute('SELECT id FROM bases WHERE qr_code = ?', (data['qr_code'],))
    existing_base = cursor.fetchone()
    
    if existing_base:
        conn.close()
        return jsonify({'error': 'QR code already assigned to a base'}), 400
        
    # Check if QR code is already assigned to a team
    cursor.execute('SELECT qr_code FROM team_qr_codes WHERE qr_code = ?', (data['qr_code'],))
    existing_team_qr = cursor.fetchone()
    
    if existing_team_qr:
        conn.close()
        return jsonify({'error': 'QR code already assigned to a team'}), 400

    # Generate a secure UUID for the team ID
    team_id = str(uuid.uuid4())

    try:
        # Insert the team
        cursor.execute('''
        INSERT INTO teams (id, game_id, name, color)
        VALUES (?, ?, ?, ?)
        ''', (team_id, game_id, data['name'], data['color']))
        
        # Store the QR code mapping
        cursor.execute('''
        INSERT INTO team_qr_codes (team_id, qr_code)
        VALUES (?, ?)
        ''', (team_id, data['qr_code']))

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
    cursor.execute('''
    SELECT t.id, t.game_id FROM teams t
    JOIN team_qr_codes qr ON t.id = qr.team_id
    WHERE qr.qr_code = ?
    ''', (qr_code,))
    team = cursor.fetchone()
    
    if team:
        conn.close()
        return jsonify({
            'status': 'team',
            'team_id': team['id'],
            'game_id': team['game_id']
        })

    # Check if QR code is assigned to a base
    cursor.execute('SELECT id, game_id FROM bases WHERE qr_code = ?', (qr_code,))
    base = cursor.fetchone()
    
    if base:
        conn.close()
        return jsonify({
            'status': 'base',
            'base_id': base['id'],
            'game_id': base['game_id']
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
        
        # Delete team QR code mappings
        for team_id in team_ids:
            cursor.execute('DELETE FROM team_qr_codes WHERE team_id = ?', (team_id,))
        
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

# Serve static files
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(app.static_folder + '/' + path):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    app.run(debug=True)