from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
import uuid
import time
import json
from datetime import datetime
import os
import math
import random

app = Flask(__name__, static_folder='static')
CORS(app)  # Enable CORS for all routes

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
    CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        admin_password TEXT NOT NULL,
        start_time INTEGER,
        end_time INTEGER,
        max_teams INTEGER NOT NULL,
        status TEXT NOT NULL
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
        qr_code TEXT NOT NULL UNIQUE,
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

@app.route('/api/games', methods=['POST'])
def create_game():
    data = request.json
    game_id = generate_unique_game_code()

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
    INSERT INTO games (id, name, admin_password, max_teams, status)
    VALUES (?, ?, ?, ?, ?)
    ''', (game_id, data['name'], data['admin_password'], data['max_teams'], 'setup'))

    conn.commit()
    conn.close()

    return jsonify({'game_id': game_id}), 201

# Get game details
@app.route('/api/games/<game_id>', methods=['GET'])
def get_game(game_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Get game info
    cursor.execute('SELECT * FROM games WHERE id = ?', (game_id,))
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

    conn.close()

    return jsonify({
        'id': game['id'],
        'name': game['name'],
        'status': game['status'],
        'maxTeams': game['max_teams'],
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

                # Calculate points (15 seconds = 1 point)
                duration = end_time - start_time
                points = duration // 15
                total_score += points

    return total_score

# Start game
@app.route('/api/games/<game_id>/start', methods=['POST'])
def start_game(game_id):
    data = request.json
    if not data or 'admin_password' not in data:
        return jsonify({'error': 'Admin password required'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Verify admin password
    cursor.execute('SELECT admin_password FROM games WHERE id = ?', (game_id,))
    game = cursor.fetchone()

    if not game:
        conn.close()
        return jsonify({'error': 'Game not found'}), 404

    if game['admin_password'] != data['admin_password']:
        conn.close()
        return jsonify({'error': 'Invalid admin password'}), 403

    # Check team count - NEW VALIDATION
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
    if not data or 'admin_password' not in data:
        return jsonify({'error': 'Admin password required'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Verify admin password
    cursor.execute('SELECT admin_password FROM games WHERE id = ?', (game_id,))
    game = cursor.fetchone()

    if not game:
        conn.close()
        return jsonify({'error': 'Game not found'}), 404

    if game['admin_password'] != data['admin_password']:
        conn.close()
        return jsonify({'error': 'Invalid admin password'}), 403

    # Update game status
    current_time = int(time.time())
    cursor.execute('''
    UPDATE games
    SET status = 'ended', end_time = ?
    WHERE id = ?
    ''', (current_time, game_id))

    conn.commit()
    conn.close()

    return jsonify({'success': True})

# Join team - FIXED to allow joining during setup phase
@app.route('/api/teams/<team_id>/join', methods=['POST'])
def join_team(team_id):
    player_id = str(uuid.uuid4())
    current_time = int(time.time())

    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if team exists
    cursor.execute('''
    SELECT t.*, g.status FROM teams t
    JOIN games g ON t.game_id = g.id
    WHERE t.id = ?
    ''', (team_id,))
    team = cursor.fetchone()

    if not team:
        conn.close()
        return jsonify({'error': 'Team not found'}), 404

    # Add player to team
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

    # Get base location
    cursor.execute('SELECT * FROM bases WHERE id = ?', (base_id,))
    base = cursor.fetchone()

    if not base:
        conn.close()
        return jsonify({'error': 'Base not found'}), 404

    # Get player's team
    cursor.execute('SELECT team_id FROM players WHERE id = ?', (player_id,))
    player = cursor.fetchone()

    if not player:
        conn.close()
        return jsonify({'error': 'Player not found'}), 404

    team_id = player['team_id']

    # This allows captures within roughly 15 meters of the base
    if calculate_distance(player_lat,player_lng,base['latitude'],base['longitude'])>15:
        conn.close()
        return jsonify({'error': 'Player is not at the base location'}), 403

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
    if not data or 'name' not in data or 'latitude' not in data or 'longitude' not in data or 'qr_code' not in data or 'admin_password' not in data:
        return jsonify({'error': 'Missing required fields'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Verify game exists and admin password
    cursor.execute('SELECT admin_password FROM games WHERE id = ?', (game_id,))
    game = cursor.fetchone()

    if not game:
        conn.close()
        return jsonify({'error': 'Game not found'}), 404

    if game['admin_password'] != data['admin_password']:
        conn.close()
        return jsonify({'error': 'Invalid admin password'}), 403

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
# Add a new team to a game with QR code - UPDATED for security
@app.route('/api/games/<game_id>/teams', methods=['POST'])
def add_team(game_id):
    data = request.json
    if not data or 'name' not in data or 'color' not in data or 'admin_password' not in data or 'qr_code' not in data:
        return jsonify({'error': 'Missing required fields'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Verify game exists and admin password
    cursor.execute('SELECT admin_password FROM games WHERE id = ?', (game_id,))
    game = cursor.fetchone()

    if not game:
        conn.close()
        return jsonify({'error': 'Game not found'}), 404

    if game['admin_password'] != data['admin_password']:
        conn.close()
        return jsonify({'error': 'Invalid admin password'}), 403

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
    if not data or 'admin_password' not in data:
        return jsonify({'error': 'Admin password required'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Get team and game info
    cursor.execute('''
    SELECT t.*, g.admin_password FROM teams t
    JOIN games g ON t.game_id = g.id
    WHERE t.id = ?
    ''', (team_id,))

    team = cursor.fetchone()

    if not team:
        conn.close()
        return jsonify({'error': 'Team not found'}), 404

    if team['admin_password'] != data['admin_password']:
        conn.close()
        return jsonify({'error': 'Invalid admin password'}), 403

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