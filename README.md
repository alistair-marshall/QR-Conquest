# QR Conquest

QR Conquest is an interactive GPS-based game where teams compete to capture and hold bases represented by QR codes. The game combines the excitement of a capture-the-flag game with modern QR code and GPS technology.

## Overview

Players form teams and scan QR codes placed around a physical area (like a park or campus). These QR codes represent either teams or bases. Teams earn points by capturing and holding bases over time, with the team accumulating the most points declared the winner.

## Key Features

- **QR Code Integration**: Use generic QR codes that can be assigned as teams or bases
- **Real-time Scoring**: Teams earn points continuously (1 point per 15 seconds) while holding a base
- **GPS Verification**: Validates players are physically present at bases using GPS location
- **Team Management**: Create teams with custom names and colours
- **Admin Controls**: Start/end games, manage teams, and monitor scores
- **Real-time Updates**: Scoreboard updates automatically during gameplay
- **Mobile Friendly**: Designed to work well on smartphones for field play

## Setup and Installation

### Prerequisites

- Python 3.7 or higher
- Flask
- SQLite
- Web browser with JavaScript enabled
- Devices with GPS and camera capabilities

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/alistair-marshall/qr-conquest.git
   cd qr-conquest
   ```

2. Install dependencies:
   ```
   pip install flask flask-cors
   ```

3. Run the application:
   ```
   python flask_app.py
   ```

4. Access the application in your browser:
   ```
   http://localhost:5000
   ```

### QR Code Generation

Use the included `code-generator.html` file to generate QR codes:

1. Open `code-generator.html` in your browser
2. Select the number and size of QR codes you want to generate
3. Click "Generate QR Codes"
4. Print the generated QR codes

## Game Setup (For Game Hosts)

1. **Before the Event**:
   - Generate and print QR codes
   - Create a new game using the admin panel
   - Assign QR codes as teams
   - Place QR codes around the play area and assign them as bases
   - For bases, scan at their physical location to record GPS coordinates

3. **Starting the Game**:
   - Have players scan team QR codes to join their teams
   - When all players are ready, use the admin panel to start the game
   - Monitor scores using the admin panel

4. **Ending the Game**:
   - Use the admin panel to end the game when time is up
   - View final results and declare the winner

## Game Play (For Players)

1. **Joining a Team**:
   - Scan your team's QR code
   - Enter your name to join the team

2. **Capturing Bases**:
   - Find QR codes around the play area
   - Scan a base QR code
   - Allow GPS verification to capture the base
   - Your team will earn points as long as your team controls the base

3. **Strategy**:
   - Capture as many bases as possible
   - Defend your bases from other teams
   - Check the scoreboard to see which bases to target

## Technical Architecture

### Backend (Python/Flask)

- RESTful API handles game logic, team management, and scoring
- SQLite database stores game state, team information, and capture events
- Real-time score calculation based on base ownership duration

### Frontend (HTML/JavaScript)

- Responsive web application with mobile-first design
- QR code scanning integration
- GPS location services
- Real-time scoreboard updates
- Admin dashboard for game management

### Database Schema

- **games**: Game information and settings
- **teams**: Team details including name and colour
- **players**: Player information linked to teams
- **bases**: Base locations with GPS coordinates and QR codes
- **captures**: Records when teams capture bases

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- [QRCode.js](https://github.com/davidshimjs/qrcodejs) for QR code generation
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Lucide Icons](https://lucide.dev/) for UI icons

