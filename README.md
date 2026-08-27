# QR Conquest

A GPS-based team capture game using QR codes for authentication and base capture. Players join teams by scanning QR codes and compete to capture and hold bases around a physical area.

## Game Overview

QR Conquest is a real-world team-based strategy game where teams compete to capture and control bases, consisting of physical locations with a QR code. The game combines digital technology with physical movement, creating an engaging outdoor activity perfect for team building, events, or casual competition.

### For Players - The Game Experience

**Getting Started:**
You'll receive a team QR code from your game host or team captain. Simply scan this code with your phone to join your team - no app download required, everything works through your web browser. For the best GPS performance, we recommend installing the game as a PWA (Progressive Web App) when prompted by your browser.

**Joining Your Team:**
- Scan your team's unique QR code 
- Enter your name to join the team
- See your team's color and current score

**Capturing Bases:**
- Navigate to base locations shown on the interactive map
- When you're at a base, scan its QR code
- Your location is automatically verified to prevent remote captures
- Successfully captured bases change to your team's color and start earning points

**Quiz Capture (if enabled by your host):**
- Instead of capturing instantly, scanning a base opens a quiz - answer correctly to reduce, capture, neutralise or reinforce it
- Each base has a shield: reduce an enemy base's shield to 0 to neutralise it, then capture it; reinforce your own base to make it harder to take
- A wrong answer ends your turn and locks you out of answering anywhere in the game for a short cooldown - the app shows a countdown
- The map and base list show each base's current shield so your team can plan attacks and defence

**Winning the Game:**
- Teams earn points for every moment they control a base
- The longer you hold bases, the more points you accumulate
- Watch the live scoreboard to track your team's progress
- Coordinate with teammates to capture and defend strategic locations

**Bonus Round (if enabled by your host):**
- When the main game ends, captured bases stop scoring - and the hunt begins
- Race to the bases and scan them where they stand to collect them; collected bases disappear from everyone's map
- Bring the physical QR codes back to the host - the points are only awarded once the host scans each base back in
- Every collected base is worth a fixed number of bonus points, sized so that even the last-placed team could win by collecting them all
- Mid-question when the bonus round starts? Your answer no longer affects the base (and a wrong answer costs no cooldown) - the app prompts you to collect the base instead

**Finding Your Way:**
- A black arrowhead on the map shows where you are, so you can see how far you are from each base - it turns to point the way you're travelling once you start moving
- Tap the crosshair button on the map to jump back to your own position if you've panned away
- Your latest position is shared with your game host while you play, so they can see where everyone is - only the host sees it, only your most recent position is kept, and nothing is stored once the game ends

**Game Features:**
- **Real-time Map**: See all bases and which team currently controls each one
- **Live Scoreboard**: Track team rankings as they change throughout the game
- **Capture Notifications**: Instant WebSocket notifications whenever any team captures a base
- **Team Coordination**: Work together to develop capture and defense strategies

### For Hosts - Managing Games

**Your Role:**
As a game host, you create and manage the entire game experience. You'll set up teams, place bases at physical locations, and oversee the competition from start to finish.

**Getting Started:**
- Receive a host secret link from the site administrator
- Visit your secret link to authenticate and access game management features
- Print QR codes for your game (1 per team plus 1 per base you plan to create)
- Create a new game

**Setting Up Teams:**
- Scan QR codes to create teams (minimum 2 teams required)
- Assign team names and colors
- Each QR code becomes a unique team that players can join
- Share team QR codes with players to let them join
- Edit a team's name or colour at any time from the host panel
- Delete a team that nobody has joined - during setup or mid-game, so a spare team doesn't sit on the scoreboard with zero points - and its QR code is freed to reuse for another team or base

**Placing Bases:**
- Visit each location where you want to place a base
- Place a QR code for the players to find
- Scan the QR code at that location to create a base
- Your GPS location is automatically recorded
- Give each base a descriptive name (e.g., "Library Steps", "Main Entrance")
- Bases appear immediately on the game map

**Quiz Capture (optional):**
- Build a reusable Question Bank from your host panel (multiple-choice or true/false, with categories) - it's shared across all of your games
- In Game Settings, enable quiz-based capture, choose which categories are in play, and set the max shield and wrong-answer cooldown
- The game can't start with quiz capture enabled unless at least one category is selected and has active questions
- Bulk-import an existing question set as JSON or CSV from the Question Bank page - see [The Question Bank](#the-question-bank) for formats and details

**Bonus Round (optional):**
- Enable the bonus round in Game Settings to end each game with players collecting the physical QR codes back in
- When the main game ends (manually or on its timer), base scoring freezes and players are told to collect the bases
- Players must scan each base at its location to mark it collected (so nobody hunts for a base that has already gone), then bring the QR code back to you
- Scan each returned QR code to check it in - only then does the collecting team score the bonus points
- Any base QR code in your hand can be scanned in, even one that was never marked collected or belongs to a deleted base - it comes off the map so players stop hunting for it, but scores no points
- Points per base can be set manually, or left on automatic: the value is chosen when the bonus round starts so that the last-placed team would win by collecting every base
- Your host panel shows a live checklist of which bases are still out, collected, or returned; ending the game releases all QR codes as usual

**Managing the Game:**
- Start the game when teams are ready
- Delete any team that ended up unused once players have arrived (only while it has no players)
- Monitor all team activity in real-time
- Watch live base captures and score changes
- End the game and view final results

**Seeing Where Everyone Is:**
- Your game map shows the last known position of every player as a small pin in their team's colour - handy for spotting a team that's drifted out of the play area or a player who's gone quiet
- Bases are circles and players are pins, so the two never get confused at a glance
- Positions that haven't updated in the last five minutes are faded, and each pin's popup names the player, their team, and when they were last seen
- Use the "Show players" tick box above the map to take the pins off it when a big group crowds the bases - the setting sticks between visits
- Your own position shows as a black arrowhead, the same as it does for players

**Game Control:**
- **Real-time Dashboard**: See all teams, bases, and current game status
- **Live Updates**: Watch base ownership change as players capture them
- **Score Monitoring**: Track which teams are leading throughout the game
- **Game Timing**: Start and end games manually when appropriate

### For Site Administrators - System Management

**Your Role:**
You oversee the entire QR Conquest system, creating and managing host accounts who can then run games.

**Host Management:**
- Create host accounts for people who will run games
- Generate unique links for each host
- Set expiry dates for host permissions (optional)
- Monitor system usage and host activity

**System Control:**
- Access the secure admin panel
- Create, edit, and delete host accounts
- Generate links for new hosts
- Review host account status and expiry dates

**Security Features:**
- Secure authentication via environment variables
- Host permissions can be time-limited
- Individual QR codes for each host account

## Complete Setup Guide

### For Players

1. **Receive your team QR code** from the game host or team captain
2. **Scan the QR code** with your phone's camera
3. **Install as PWA** when prompted for better GPS performance (optional but recommended)
4. **Enter your name** to join the team
5. **Navigate to bases** using the map
6. **Scan base QR codes** when you're close enough to capture them
7. **Watch your team climb the scoreboard!**

### For Game Hosts

#### Pre-Game Preparation

1. **Get your host access**:
   - Receive host secret link from site administrator
   - Visit your secret link to authenticate and access game management features

2. **Prepare physical materials**:
   - Count how many teams and bases you want (minimum 2 teams, recommended 3-10 bases)
   - **Generate QR codes**: Use the built-in code generator at `/code-generator/` or click "Print QR Codes" in the host panel
   - Print QR codes: 1 per team + 1 per base (e.g., for 4 teams and 6 bases, print 10 QR codes)
   - Place base QR codes at strategic locations
   - Ensure locations are accessible and safe

#### Game Setup

3. **Create your game**:
   - Visit your host secret link if not already authenticated
   - Click "Host a Game" or use "Host Menu" button
   - Create new game with descriptive name
   - Note the friendly game code generated

4. **Set up teams**:
   - Use "Scan QR Code" to add teams
   - For each team QR code scanned, choose "Assign as Team"
   - Set team name and color
   - Repeat for all teams (minimum 2 required)

5. **Set up bases**:
   - Visit each location where you want to place a base
   - Place a QR code for the players to find and scan
   - Scan the QR code at that location
   - Choose "Assign as Base"
   - Set base name and verify GPS location is accurate
   - Repeat for all base locations

#### Game Time

6. **Team assignment**:
   - Distribute team QR codes to team captains or players
   - Players scan their team QR codes to join teams
   - Monitor team formation in your host panel

7. **Start and manage the game**:
   - Ensure minimum 2 teams are formed
   - Brief players on rules and base locations
   - Click "Start Game" from your host panel
   - Monitor live scoreboard and base ownership
   - End game when appropriate and review final results

### For Site Administrators

#### System Setup

1. **Set up environment**:
   ```bash
   export SITE_ADMIN_PASSWORD="your_secure_admin_password"
   ```

2. **Start the application**:
   ```bash
   python flask_app.py
   ```

#### Host Management

3. **Access admin panel**:
   - Navigate to the homepage
   - Click "Site Administration" link in footer
   - Enter admin password

4. **Create host accounts**:
   - Create host account with descriptive name
   - Set expiry date (optional)
   - Generate host secret link
   - Share the secret link with the host (can be sent digitally or printed)

## The Question Bank

The Question Bank powers quiz capture. It belongs to your host account, not to any single game: build it once and reuse it across every game you run. It is managed from the "Manage Question Bank" button on your host panel.

### How questions are organised

Every question has:

| Field | Description |
|-------|-------------|
| Text | The question shown to the player |
| Type | Multiple choice (`mc`) or true/false (`tf`) |
| Options | The answer choices (multiple choice only; true/false always shows True and False) |
| Correct answer | The option that captures/reinforces the base |
| Category | A free-text label used to group questions (e.g. "Nature", "History", "Ages 5-8") |
| Explanation | Optional text shown to the player after they answer, right or wrong |

Categories are the unit of selection: when you create a game with quiz capture, you choose which categories are in play for that game. This lets one bank serve different audiences - for example a "Kids" category for a family event and a "Pub Quiz" category for an adults' game, without maintaining two banks.

### How questions are served during a game

- When a player scans a base, the server picks a random question from your **active** questions in the game's selected categories.
- Within a single scan session, the server avoids repeating a question the player has already been served, as long as the pool is big enough.
- The correct answer is never sent to the player's device - answers are checked server-side.
- A game cannot start with quiz capture enabled unless at least one selected category contains at least one active question.

### Managing questions

Each question card in the Question Bank offers:

- **Edit** - change any field. Edits apply immediately: answers are always marked against the latest saved version, so a mistake in a question can be corrected even mid-game.
- **Disable / Enable** - a disabled question stays in the bank but is never served. Use this to temporarily pull a question (e.g. mid-game, if you spot a mistake in it) without losing it.
- **Delete** - permanently removes the question. Each category header also has a **Delete All** button to delete the whole category at once.

Deletion is blocked while a running game (active or in its bonus round) is using the question's category - a question already on a player's screen must remain answerable. Disable it instead, or delete it after the game ends. Bulk deletes skip in-use questions and report how many were skipped.

### Importing a question bank

The **Bulk Import** button on the Question Bank page accepts an existing question set in either JSON or CSV form - paste it into the import box. Rows are validated individually: valid rows are imported, invalid rows are skipped, and the import report lists each skipped row with the reason, so one bad row never blocks the rest.

**JSON format** - an array of question objects:

```json
[
  {
    "text": "What is the capital of France?",
    "type": "mc",
    "options": ["Paris", "London", "Berlin"],
    "correct": 0,
    "category": "Geography",
    "explanation": "Paris has been France's capital since 987."
  },
  {
    "text": "The Pacific is the largest ocean.",
    "type": "tf",
    "correct": true,
    "category": "Geography"
  }
]
```

**CSV format** - a header row followed by one question per line. Options are separated with `|`:

```csv
text,type,options,correct,category,explanation
What is the capital of France?,mc,Paris|London|Berlin,Paris,Geography,Paris has been France's capital since 987.
The Pacific is the largest ocean.,tf,,true,Geography,
```

**Field rules** (both formats):

| Field | Required | Rules |
|-------|----------|-------|
| `text` | Yes | Any non-empty text |
| `type` | Yes | `mc` (multiple choice) or `tf` (true/false) |
| `options` | For `mc` | At least two non-blank options. JSON: an array of strings. CSV: pipe-separated (`Paris\|London\|Berlin`). Leave empty for `tf` |
| `correct` | Yes | For `mc`: either the zero-based index of the correct option (`0` for the first) or the exact text of exactly one option (case-insensitive). For `tf`: `true` or `false` |
| `category` | Yes | Any non-empty text; creates the category if it doesn't exist yet |
| `explanation` | No | Shown to the player after answering |

Tips:

- If a question's text contains commas, use the JSON format or quote the CSV field (`"Which is bigger, the Sun or the Moon?"`).
- Imported questions are active immediately. Import a category you don't want in play yet? Just don't select that category in Game Settings.
- Spreadsheets export CSV directly, so a question bank can be maintained in Excel/Google Sheets with the columns above and pasted in whenever it changes.

## QR Code Generation

QR Conquest includes a built-in QR code generator for creating printable codes needed for games. This tool is essential for hosts who need to prepare physical QR codes before running games.

### Accessing the QR Code Generator

- **Direct URL**: Visit `/code-generator/` on your QR Conquest installation
- **From Host Panel**: Click the "Print QR Codes" button in the game management interface
- **Standalone Use**: The generator works independently and doesn't require host authentication

### QR Code Generator Features

**Layout Options:**
- **Paper Sizes**: A4, Letter, A3, and Tabloid formats
- **Grid Layouts**: 2-6 columns with automatic row calculation
- **Smart Sizing**: Automatically calculates optimal QR code size for maximum codes per page

**Visual Customisation:**
- **Plain White**: Simple, clean QR codes on white background
- **Black Border**: QR codes with distinctive black borders
- **Orienteering Flag**: Orange and white triangular pattern background (ideal for outdoor events)
- **Custom Colours**: Choose your own background and border colours

**Content Options:**
- **Custom Headers**: Add text above each QR code (e.g., "Team Red", "Base Alpha")
- **URL Display**: Optionally show the full URL below each QR code
- **Unique IDs**: Each QR code gets a unique 11-character identifier

**Print Optimisation:**
- **Browser-friendly**: Works with standard browser print functions
- **High Contrast**: Ensures QR codes remain scannable when printed
- **Efficient Layouts**: Maximises codes per page while maintaining readability

### Using Generated QR Codes

1. **Generate Codes**: Create as many QR codes as needed (typically 2-10 teams + 5-20 bases)
2. **Print**: Use your browser's print function for high-quality output
3. **Deploy**: Place base QR codes at strategic locations around your game area
4. **Distribute**: Give team QR codes to team captains or players
5. **Assign in Game**: When hosting, scan each QR code to assign it as either a team or base

### Best Practices for QR Code Preparation

**Planning Your Codes:**
- Print extra codes as spares (equipment failures, weather damage)
- Use headers to pre-label codes by intended purpose
- Consider laminating codes for outdoor use

**Base Placement:**
- Choose locations that are accessible but not too obvious
- Ensure codes are visible and scannable
- Protect from weather if playing outdoors
- Consider GPS accuracy when placing codes

**Team Distribution:**
- Give one team QR code to each team captain
- Keep digital copies as backup
- Consider sharing team codes via secure messaging if needed

### Technical Specifications

**QR Code Details:**
- **Format**: Standard QR codes with high error correction
- **Size**: Automatically calculated based on layout (typically 80-300px)
- **Content**: Full URLs in format `https://yoursite.com/?id={unique_id}`
- **Compatibility**: Works with any QR code scanner or camera app

**Browser Support:**
- Modern web browsers with JavaScript enabled
- Print functionality requires standard browser print capabilities
- No special software or plugins required


## Technical Architecture

### Backend (Python Flask)
- **Database**: SQLite with tables for hosts, games, teams, players, bases, captures, questions, and answer_sessions
- **Authentication**: Token-based for site admin, QR code-based for hosts/players
- **WebSockets**: Live base-capture and quiz-outcome notifications pushed to all connected players (via flask-sock)
- **Quiz Capture**: An optional per-game mode where GPS proximity opens a scan session of server-marked questions; correct answers reduce/capture/neutralise/reinforce a base's shield atomically, wrong answers apply a game-wide cooldown to the player
- **Player Positions**: Players post their latest GPS fix to the server while they play; only the newest fix per player is stored (no route history) and it is served exclusively to the game's host, so teams can't track each other
- **Bonus Round**: An optional post-game phase (game status `bonus`) where base-holding scores freeze and teams collect base QR codes; a GPS-verified player scan marks a base collected, a host scan confirms its return and awards fixed bonus points per base (auto-sized so last place collecting everything would win). The host can scan in any base - one that was never marked collected, or a deleted one - to clear it from the map without awarding points

### Frontend (Vanilla JavaScript)
- **PWA**: Installable Progressive Web App
- **QR Scanning**: Camera-based QR code detection
- **Maps**: Interactive Leaflet maps showing base locations and ownership, the viewer's own position as a black arrowhead, and (for hosts, behind a "Show players" toggle) each player's last known position as a pin in their team colour
- **Real-time Updates**: WebSocket capture notifications plus automatic polling for live scoreboard updates
- **Responsive Design**: Works on mobile phones and tablets

**File Responsibility Matrix**:
| File | Responsibility | Contains | Calls |
|------|---------------|----------|-------|
| **core.js** | API & State | Authentication, QR handling, game management APIs | UI functions via `window.functionName` |
| **ui.js** | Main UI | Landing, game view, QR scanner, navigation, PWA | Core.js API functions |
| **host.js** | Host UI | Host panel, team/base forms, question bank, host modals | Core.js API functions |
| **site-admin.js** | Admin UI | Admin login, host management, admin modals | Core.js API functions |
| **dev-gps.js** | Dev tooling | GPS simulator and simulated QR scans; inert unless `DEBUG_FEATURES` is set | Core.js `handleQRCode` |

### Front-end libraries

Tailwind, Leaflet, Lucide, jsQR and QRCode.js are served from `static/libs/`
rather than a CDN. Players are usually outdoors on patchy mobile data, and a
blocked or slow CDN previously took the styling, the map or the QR scanner
down with it; serving the libraries from the app itself removes that failure
mode. The only third-party request left in normal play is the OpenStreetMap
tiles the map needs; the opt-in debug console (`DEBUG_FEATURES`) still pulls
Eruda from a CDN when a developer asks for it. The vendored copies are
committed, so running the app still takes nothing more than Python and
`flask_app.py`.

| Library | Vendored as | Version |
|---------|-------------|---------|
| Tailwind CSS | `static/libs/tailwind.css` (prebuilt) | 3.4.19 |
| Leaflet | `static/libs/leaflet.js`, `leaflet.css`, `images/` | 1.9.4 |
| Lucide icons | `static/libs/lucide.min.js` | 1.34.0 |
| QRCode.js | `static/libs/qrcode.min.js` | 1.0.0 |
| jsQR | `static/libs/jsQR.js` | vendored previously |

Tailwind used to run from the Play CDN, which compiled the classes in the
browser on every page load; it is now built ahead of time into a ~29 KB
stylesheet. **After adding new Tailwind classes to the front end, rebuild it:**

```bash
npm install       # dev tooling only - not needed to run the game
npm run build:css
```

The build scans `static/*.html`, `static/*.js` and
`static/code-generator/*.html` for class names (see `tools/tailwind.config.js`),
so a class must appear as a literal string somewhere in the source. Team
colours are additionally safelisted, because they are stored per team in the
database. To upgrade a library, bump its version in `package.json` and run
`npm run vendor`, which recopies the files and rebuilds the stylesheet.

### QR Code System
- **Host Authentication**: Unique secret links for host authentication
- **Team QR**: Unique UUID linking to specific team in specific game
- **Base QR**: Unique UUID linking to physical location and game
- **URL Format**: `https://yoursite.com/?id={qr_uuid}`

## Installation & Deployment

### Prerequisites
- Python 3.7+
- Modern web browser with camera access
- HTTPS connection (required for camera access)

### Local Development

1. **Clone and setup**:
   ```bash
   git clone <repository-url>
   cd qr-conquest
   pip install -r requirements.txt
   ```

2. **Set environment variables**:
   ```bash
   export SITE_ADMIN_PASSWORD="your_secure_password"
   ```

3. **Run application**:
   ```bash
   python flask_app.py
   ```

4. **Access application**:
   - Open `http://localhost:5000` in browser
   - For camera access, use HTTPS proxy or mobile device on same network

5. **Testing without a park** (optional):
   - Set `DEBUG_FEATURES=true` before starting the server to enable the GPS simulator
   - An on-screen panel lets you move a fake GPS position (arrow buttons, right-click the map to teleport, or `devGPS.set(lat, lng)` in the console) and simulate QR scans by typing the code's value - so the full capture, quiz, and bonus-round flows can be exercised at a desk

### Production Deployment

1. **Set up HTTPS** (required for camera access):
   ```bash
   # Example with Nginx reverse proxy
   server {
       listen 443 ssl;
       server_name your-domain.com;
       
       ssl_certificate /path/to/cert.pem;
       ssl_certificate_key /path/to/key.pem;
       
       location / {
           proxy_pass http://localhost:5000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           # Required for the live-notification WebSocket (/ws/...)
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_read_timeout 3600s;
       }
   }
   ```

2. **Configure environment**:
   ```bash
   export SITE_ADMIN_PASSWORD="strong_production_password"
   export FLASK_ENV="production"
   ```

3. **Run with production server**:
   ```bash
   # Using Gunicorn. Each WebSocket connection holds a thread for its
   # lifetime, so run with a generous thread pool. A single worker keeps
   # all connections in one process so capture broadcasts reach everyone.
   pip install gunicorn
   gunicorn -w 1 --threads 100 -b 0.0.0.0:5000 flask_app:app
   ```

## Configuration Options

### Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `SITE_ADMIN_PASSWORD` | Yes | Password for site admin access | `secure_admin_pass_123` |
| `DEBUG_FEATURES` | No | Expose developer tools in the client: a GPS simulator (movable fake position with an on-screen panel, plus a "simulate QR scan" box) and a mobile debug console. Hidden by default; never enable in production. | `true` |
| `FLASK_ENV` | No | Flask environment mode | `production` |
| `FLASK_DEBUG` | No | Enable debug mode | `False` |

### Game Settings

Set when creating a game; most can be changed from Game Settings until the relevant phase locks them in.

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| Capture radius | 15 m | 5-500 m | How close a player must be to a base to capture or collect it (GPS-verified server-side) |
| Points interval | 15 s | 5 s - 1 h | How often each held base earns its team a point |
| Auto-start time | Off | - | Optionally start the game automatically at a set time |
| Game duration | Manual end | 5 min - 30 days | Optionally end the game automatically after this long (must be at least 10x the points interval) |
| Join method | Team QR only | - | How players join: scan a team QR, pick their own team, or auto-assign to the team with fewest players / lowest score |
| Quiz capture | Off | - | Capture via quiz questions instead of instant scan; requires selecting question categories (see [The Question Bank](#the-question-bank)) |
| Max shield | 5 | 1-20 | Quiz capture: the most a base can be reinforced |
| Wrong-answer cooldown | 30 s | 5-3600 s | Quiz capture: how long a wrong answer locks the player out of answering anywhere |
| Bonus round | Off | - | End the game with a collect-the-bases phase instead of stopping outright |
| Bonus points per base | Auto | 1-1,000,000 | Auto sizes the value when the bonus round starts so the last-placed team could win by collecting every base; locked once the bonus round begins |

There is no hard limit on teams or bases; 2-8 teams and 5-20 bases work well in practice.

### Live Notifications

- Base captures are broadcast over WebSockets to everyone in the game
- Scoreboard and map refresh immediately when a capture happens
- Automatic reconnection with backoff if the connection drops
- Visual indicators for online/offline status

## Security Features

### Authentication Model
- **Three-tier security**: Site Admin → Host → Player
- **Secret link expiry**: Host permissions can be time-limited
- **Session management**: Persistent authentication via localStorage
- **No password storage**: Only site admin password in environment

### Data Protection
- **Input validation**: All API inputs validated
- **SQL injection protection**: Parameterized queries
- **HTTPS required**: Camera access requires secure connection

### Privacy Considerations
- **Location data**: Only stored for base creation and capture verification
- **Player data**: Minimal personal information collected
- **QR codes**: Unique UUIDs with no personal information
- **Game isolation**: Each game's data is completely separate

## Troubleshooting

### Common Issues

**Camera not working**:
- Ensure HTTPS connection (required for camera access)
- Check browser permissions for camera
- Try different browser or device

**QR codes not scanning**:
- Ensure good lighting conditions
- Hold camera steady and close to QR code
- Try manual entry of QR code value
- Check QR code is properly generated

**GPS not accurate**:
- Install as Progressive Web App for best performance
- Enable high accuracy mode in browser
- Wait for GPS to settle before capturing bases
- Check device has good GPS signal
- Consider testing capture range in different conditions

**Game not starting**:
- Ensure minimum 2 teams created
- Check host authentication is valid
- Verify all teams have valid QR codes
- If quiz capture is enabled: at least one category must be selected and contain at least one active question
- Check game status in host panel

**Players can't join teams**:
- Check team QR codes are properly assigned
- Ensure game hasn't started yet
- Try refreshing browser and re-scanning
- Verify QR code is readable and not damaged

### Debug Information

Enable debug mode for detailed logging:
```bash
export FLASK_DEBUG=True
python flask_app.py
```

Check browser console for JavaScript errors:
- Press F12 to open developer tools
- Check Console tab for error messages
- Network tab shows API request/response details

## License

This project is provided as-is for educational and entertainment purposes. Please respect local laws and property rights when placing QR codes and conducting games.

## Contributing

This is a pre-beta project focused on functionality over backwards compatibility. Contributions welcome, but expect breaking changes as the system evolves.

### Development Setup
1. Fork the repository
2. Create feature branch
3. Test thoroughly with all user roles
4. Submit pull request with detailed description

### Known Limitations
- Single server instance (no clustering support)
- SQLite database (not suitable for high concurrency)
- Basic error handling (needs improvement for production)
- Limited game customization options
- No game history or analytics

---

**Have fun conquering with QR codes!**