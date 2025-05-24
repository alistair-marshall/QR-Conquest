# QR Conquest

A GPS-based team capture game using QR codes for authentication and base capture. Players join teams by scanning QR codes and compete to capture and hold bases around a physical area.

## 🎮 Game Overview

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

**Winning the Game:**
- Teams earn points for every moment they control a base
- The longer you hold bases, the more points you accumulate
- Watch the live scoreboard to track your team's progress
- Coordinate with teammates to capture and defend strategic locations

**Game Features:**
- **Real-time Map**: See all bases and which team currently controls each one
- **Live Scoreboard**: Track team rankings as they change throughout the game
- **Offline Support**: Game continues even with poor mobile signal - captures sync automatically when connection returns
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

**Placing Bases:**
- Visit each location where you want to place a base
- Place a QR code for the players to find
- Scan the QR code at that location to create a base
- Your GPS location is automatically recorded
- Give each base a descriptive name (e.g., "Library Steps", "Main Entrance")
- Bases appear immediately on the game map

**Managing the Game:**
- Start the game when teams are ready
- Monitor all team activity in real-time
- Watch live base captures and score changes
- End the game and view final results

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

## 🚀 Complete Setup Guide

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

## 🏗️ Technical Architecture

### Backend (Python Flask)
- **Database**: SQLite with tables for hosts, games, teams, players, bases, captures
- **Authentication**: Token-based for site admin, QR code-based for hosts/players
- **Offline Support**: Background sync for captures when connectivity is poor

### Frontend (Vanilla JavaScript)
- **PWA**: Progressive Web App with offline capabilities
- **QR Scanning**: Camera-based QR code detection
- **Maps**: Interactive Leaflet maps showing base locations and ownership
- **Real-time Updates**: Automatic polling for live scoreboard updates
- **Responsive Design**: Works on mobile phones and tablets

### QR Code System
- **Host Authentication**: Unique secret links for host authentication
- **Team QR**: Unique UUID linking to specific team in specific game
- **Base QR**: Unique UUID linking to physical location and game
- **URL Format**: `https://yoursite.com/?id={qr_uuid}`

## 📱 Installation & Deployment

### Prerequisites
- Python 3.7+
- Modern web browser with camera access
- HTTPS connection (required for camera access)

### Local Development

1. **Clone and setup**:
   ```bash
   git clone <repository-url>
   cd qr-conquest
   pip install flask flask-cors
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
   # Using Gunicorn
   pip install gunicorn
   gunicorn -w 4 -b 0.0.0.0:5000 flask_app:app
   ```

## 🔧 Configuration Options

### Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `SITE_ADMIN_PASSWORD` | Yes | Password for site admin access | `secure_admin_pass_123` |
| `FLASK_ENV` | No | Flask environment mode | `production` |
| `FLASK_DEBUG` | No | Enable debug mode | `False` |

### Game Settings

- **Team Limit**: No hard limit, but 2-8 teams recommended
- **Base Limit**: No hard limit, but 5-20 bases work well
- **Capture Range**: Players must be close enough to bases for GPS verification
- **Scoring Rate**: Teams earn points continuously while controlling bases
- **Game Duration**: No time limit, manually ended by host

### Offline Support

- Base captures are queued when offline
- Automatic sync when connection restored
- Cached game data for continued play
- Visual indicators for online/offline status

## 🔒 Security Features

### Authentication Model
- **Three-tier security**: Site Admin → Host → Player
- **Secret link expiry**: Host permissions can be time-limited
- **Session management**: Persistent authentication via localStorage
- **No password storage**: Only site admin password in environment

### Data Protection
- **Input validation**: All API inputs validated
- **SQL injection protection**: Parameterized queries
- **HTTPS required**: Camera access requires secure connection
- **CORS enabled**: Cross-origin requests properly configured

### Privacy Considerations
- **Location data**: Only stored for base creation and capture verification
- **Player data**: Minimal personal information collected
- **QR codes**: Unique UUIDs with no personal information
- **Game isolation**: Each game's data is completely separate

## 🐛 Troubleshooting

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

## 📄 License

This project is provided as-is for educational and entertainment purposes. Please respect local laws and property rights when placing QR codes and conducting games.

## 🤝 Contributing

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

**Have fun conquering with QR codes! 🎯**