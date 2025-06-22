// Global app state
const appState = {
  page: 'landing',
  gameData: {
    id: null,
    name: 'QR Conquest',
    teams: [],
    bases: [],
    currentTeam: null,
    currentPlayer: null,
    hostName: null,
    status: 'setup'
  },
  loading: false,
  error: null,
  pendingQRCode: null,
  gps: {
    isTracking: false,
    watchId: null,
    currentPosition: null,
    accuracy: null,
    status: 'inactive', // 'inactive', 'getting', 'ready', 'poor', 'error'
    lastUpdate: null
  },
  // Authentication state
  hostId: null,
  siteAdmin: {
    isAuthenticated: false,
    token: null,
    hosts: [],           // Array of host objects
    hostsLoading: false, // Loading state for hosts
    hostsLoaded: false,  // Whether hosts have been loaded
    hostsError: null,    // Error state for host loading
    games: [],           // Array of game objects
    gamesLoading: false, // Loading state for games
    gamesLoaded: false,  // Whether games have been loaded
    gamesError: null     // Error state for game loading
  }
};

// API endpoint
const API_BASE_URL = '/api';

// Enhanced API error handling function
async function handleApiResponse(response, errorMessage) {
  if (!response.ok) {
    // Read the response body once
    const responseText = await response.text();

    try {
      // Try to parse as JSON
      const errorData = JSON.parse(responseText);
      throw new Error(errorData.error || errorMessage);
    } catch (jsonError) {
      // Not valid JSON or other parsing error
      if (responseText && responseText.trim()) {
        throw new Error(`${errorMessage}: ${responseText.trim()}`);
      } else {
        // No useful text, use status info
        throw new Error(`${errorMessage}: ${response.status} ${response.statusText}`);
      }
    }
  }

  // For successful responses, also handle parsing errors
  const responseText = await response.text();

  // Don't try to parse empty responses
  if (!responseText || !responseText.trim()) {
    return {};
  }

  try {
    // Parse as JSON
    return JSON.parse(responseText);
  } catch (jsonError) {
    console.error("Error parsing successful response:", jsonError);
    throw new Error("Invalid response format from server");
  }
}

// =============================================================================
// AUTHENTICATION MANAGEMENT - Consolidated auth state handling
// =============================================================================

// Get current authentication state
function getAuthState() {
  return {
    isHost: !!localStorage.getItem('hostId'),
    hostId: localStorage.getItem('hostId'),
    hostName: localStorage.getItem('hostName') || 'Host',
    isSiteAdmin: appState.siteAdmin.isAuthenticated,
    hasGame: !!localStorage.getItem('gameId'),
    gameId: localStorage.getItem('gameId'),
    hasTeam: !!localStorage.getItem('teamId'),
    teamId: localStorage.getItem('teamId'),
    playerId: localStorage.getItem('playerId')
  };
}

// Update authentication state
function updateAuthState(authData) {
  // Update localStorage for persistent data
  if (authData.hostId !== undefined) {
    if (authData.hostId) {
      localStorage.setItem('hostId', authData.hostId);
      localStorage.setItem('hostName', authData.hostName || 'Host');
    } else {
      localStorage.removeItem('hostId');
    }
  }

  if (authData.gameId !== undefined) {
    if (authData.gameId) {
      localStorage.setItem('gameId', authData.gameId);
    } else {
      localStorage.removeItem('gameId');
    }
  }

  if (authData.teamId !== undefined) {
    if (authData.teamId) {
      localStorage.setItem('teamId', authData.teamId);
      localStorage.setItem('playerId', authData.playerId || '');
    } else {
      localStorage.removeItem('teamId');
      localStorage.removeItem('playerId');
    }
  }

  // Update app state for runtime use
  if (authData.hostId !== undefined) {
    appState.hostId = authData.hostId;
  }

  if (authData.teamId !== undefined) {
    appState.gameData.currentTeam = authData.teamId;
    appState.gameData.currentPlayer = authData.playerId;
  }
}

// Clear all authentication data
function clearGameState() {
  // Clear persistent storage
  localStorage.removeItem('gameId');
  localStorage.removeItem('teamId');
  localStorage.removeItem('playerId');
  // Only remove hostName if we're not a host
  if (!appState.hostId) {
    localStorage.removeItem('hostName'); 
  }

  // Clear temporary session data
  sessionStorage.removeItem('pendingQRCode');
  sessionStorage.removeItem('pendingTeamId');

  // Stop any active polling
  stopScorePolling();

  // Reset app state
  appState.gameData = {
    id: null,
    name: 'QR Conquest',
    teams: [],
    bases: [],
    currentTeam: null,
    currentPlayer: null,
    hostName: null,
    status: 'setup'
  };

  // Clear any pending QR code
  appState.pendingQRCode = null;
  appState.error = null;
  appState.loading = false;

  console.log('Game state cleared');
}

// =============================================================================
// QR CODE HANDLING - Consolidated QR processing logic
// =============================================================================

// Helper function to extract 'id' from a URL string
function extractIdFromUrl(urlString) {
  try {
    const url = new URL(urlString);
    const id = url.searchParams.get('id');
    if (id) {
      console.log('Extracted ID from URL:', id);
      return id;
    }
  } catch (e) {
    // Not a valid URL, so proceed with the original string
    console.log('Scanned data is not a full URL or ID extraction failed, using raw data:', urlString);
  }
  return urlString; // Return original string if not a URL with 'id' or if parsing fails
}

// Main QR code handler - consolidates all QR processing logic
async function handleQRCode(qrCode, context = 'scan') {
  console.log('Processing QR code:', qrCode, 'Context:', context);

  // Extract ID from URL if needed
  qrCode = extractIdFromUrl(qrCode);

  // If we're in admin QR assignment flow, handle differently
  if (context === 'assignment' && getAuthState().isHost) {
    sessionStorage.setItem('pendingQRCode', qrCode);
    // Navigate to assignment page - UI will handle this
    if (window.navigateTo) {
      window.navigateTo('qrAssignment');
    }
    return;
  }

  try {
    setLoading(true);

    // Check what this QR code corresponds to
    const statusResponse = await fetch(`${API_BASE_URL}/qr-codes/${qrCode}/status`);

    if (!statusResponse.ok) {
      throw new Error(`Unable to verify QR code. Please check your connection and try again.`);
    }

    const responseText = await statusResponse.text();
    let statusData;

    try {
      statusData = JSON.parse(responseText);
    } catch (jsonError) {
      console.error('Error parsing QR code status response:', jsonError);
      throw new Error('Server returned invalid response. Please try again.');
    }

    // Route to appropriate handler based on QR type
    await routeQRCode(qrCode, statusData);

  } catch (err) {
    console.error('Error processing QR code:', err);

    // Show user-friendly error message
    const userMessage = err.message || 'Unable to process QR code. Please try again.';
    if (window.showNotification) {
      window.showNotification(userMessage, 'error');
    }

    // If we have no game loaded and this is an unrecognised QR code
    if (!getAuthState().hasGame) {
      appState.pendingQRCode = qrCode;
      if (window.navigateTo) {
        window.navigateTo('firstTime');
      }
    }
  } finally {
    setLoading(false);
  }
}

// Route QR code to appropriate handler based on type
async function routeQRCode(qrCode, statusData) {
  console.log('Routing QR code:', qrCode, 'Status:', statusData.status);
  try {
    switch (statusData.status) {
      case 'host':
        await handleHostQR(qrCode, statusData);
        break;

      case 'team':
        await handleTeamQR(qrCode, statusData);
        break;

      case 'base':
        await handleBaseQR(qrCode, statusData);
        break;

      case 'unassigned':
        await handleUnassignedQR(qrCode);
        break;

      default:
        throw new Error('This QR code is not recognised by the system.');
    }
  } catch (err) {
    // Re-throw with context if needed
    throw err;
  }
}

// Handle host QR codes
async function handleHostQR(qrCode, statusData) {
  try {
    if (statusData.expired) {
      throw new Error('This host access has expired. Please contact the administrator.');
    }

    // Update authentication state
    updateAuthState({
      hostId: statusData.host_id,
      hostName: statusData.name
    });

    // Show success notification and navigate - UI will handle this
    if (window.showNotification) {
      window.showNotification(`Welcome, ${statusData.name}!`, 'success');
    }
    if (window.navigateTo) {
      window.navigateTo('hostPanel');
    }
  } catch (err) {
    throw err; // Re-throw for consistent error handling
  }
}

// Handle team QR codes
async function handleTeamQR(qrCode, statusData) {
  try {
    const authState = getAuthState();
    const teamId = statusData.team_id;
    const gameId = statusData.game_id;

    console.log('Team QR scanned:', teamId, 'Game ID:', gameId);

    // Helper function to start registration flow
    const startRegistration = async () => {
      updateAuthState({ gameId: gameId });
      await fetchGameData(gameId);
      sessionStorage.setItem('pendingTeamId', teamId);
      if (window.navigateTo) {
        window.navigateTo('playerRegistration');
      }
    };

    // Already on this exact team - just navigate to game
    if (authState.teamId === teamId && authState.gameId === gameId) {
      if (window.showNotification) {
        window.showNotification('You are already a member of this team.', 'info');
      }
      if (window.navigateTo) {
        window.navigateTo('gameView');
      }
      return;
    }

    // No previous game - treat as new player
    if (!authState.hasGame) {
      console.log('New player - no previous game');
      await startRegistration();
      return;
    }

    // Same game, different team - confirm team change
    if (authState.gameId === gameId) {
      if (authState.hasTeam) {
        const currentTeamName = getTeamName(authState.teamId);
        const newTeamName = getTeamName(teamId);
        
        if (confirm(`Do you wish to change from ${currentTeamName} to ${newTeamName}?`)) {
          console.log('Player confirmed team change within same game');
          await joinTeam(teamId);
        } else {
          if (window.navigateTo) {
            window.navigateTo('gameView');
          }
        }
      } else {
        // Same game, no team yet
        console.log('Same game, no team - go to registration');
        sessionStorage.setItem('pendingTeamId', teamId);
        if (window.navigateTo) {
          window.navigateTo('playerRegistration');
        }
      }
      return;
    }

    // Different game - check if previous game is still active
    console.log('User in different game, checking previous game status');
    
    try {
      const previousGameResponse = await fetch(`${API_BASE_URL}/games/${authState.gameId}`);
      
      // Previous game deleted/not found or ended - auto-switch
      if (!previousGameResponse.ok) {
        console.log('Previous game not found, clearing data');
        clearGameState();
        await startRegistration();
        return;
      }

      const previousGameData = await previousGameResponse.json();
      if (previousGameData.status === 'ended') {
        console.log('Previous game ended, switching to new game');
        clearGameState();
        await startRegistration();
        return;
      }
      
      // Previous game is still active      
      if (confirm(`You are currently in a game which is still active. Do you want to leave it and join a new game?`)) {
        console.log('Player confirmed leaving active game');
        clearGameState();
        await startRegistration();
      } else {
        if (window.navigateTo) {
          window.navigateTo('gameView');
        }
      }

    } catch (networkError) {
      console.warn('Network error checking previous game:', networkError);
      
      if (confirm('You appear to be in another game. Do you want to leave it and join this new game?')) {
        console.log('Player confirmed leaving game despite network error');
        clearGameState();
        await startRegistration();
      } else {
        if (window.navigateTo) {
          window.navigateTo('gameView');
        }
      }
    }

  } catch (err) {
    console.error('Error in handleTeamQR:', err);
    if (getAuthState().hasTeam && window.navigateTo) {
      window.navigateTo('gameView');
    }
    throw err;
  }
}

// Handle base QR codes
async function handleBaseQR(qrCode, statusData) {
  try {
    const authState = getAuthState();
    const baseId = statusData.base_id;
    const gameId = statusData.game_id;

    console.log('Base QR scanned:', baseId, 'QR code:', qrCode);

    // Check if user is on a team
    if (!authState.hasTeam) {
      throw new Error('You need to join a team before capturing bases. Please scan a team QR code first.');
    }

    // If we have a game loaded but QR is for different game
    if (authState.hasGame && authState.gameId !== gameId) {
      throw new Error('This base belongs to a different game.');
    }

    // Check game status
    if (appState.gameData.status !== 'active') {
      throw new Error('The game is not active yet. Please wait for the host to start the game.');
    }

    // Attempt to capture the base with GPS location
    await captureBaseWithLocation(baseId);
  } catch (err) {
    // Navigate appropriately based on error context
    if (!getAuthState().hasTeam && window.navigateTo) {
      window.navigateTo('scanQR');
    } else if (appState.gameData.status !== 'active' && window.navigateTo) {
      window.navigateTo('gameView');
    }
    throw err;
  }
}

// Handle unassigned QR codes
async function handleUnassignedQR(qrCode) {
  try {
    const authState = getAuthState();

    if (authState.isHost) {
      console.log('Showing QR assignment options for:', qrCode);
      sessionStorage.setItem('pendingQRCode', qrCode);
      if (window.navigateTo) {
        window.navigateTo('qrAssignment');
      }
    } else {
      // Store pending QR code for first-time user flow
      appState.pendingQRCode = qrCode;
      if (window.navigateTo) {
        window.navigateTo('landing');
      }
    }
  } catch (err) {
    throw err;
  }
}

// GPS tracking management functions
function startGPSTracking() {
  if (!navigator.geolocation) {
    console.warn('Geolocation not supported');
    appState.gps.status = 'error';
    updateGPSStatusUI();
    return;
  }

  if (appState.gps.isTracking) {
    console.log('GPS tracking already active');
    return;
  }

  console.log('Starting GPS tracking');
  appState.gps.status = 'getting';
  appState.gps.isTracking = true;
  updateGPSStatusUI();

  const options = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 5000 // Allow cached position up to 5 seconds old
  };

  appState.gps.watchId = navigator.geolocation.watchPosition(
    handleGPSSuccess,
    handleGPSError,
    options
  );
}

function stopGPSTracking() {
  if (!appState.gps.isTracking) {
    return;
  }

  console.log('Stopping GPS tracking');
  
  if (appState.gps.watchId !== null) {
    navigator.geolocation.clearWatch(appState.gps.watchId);
    appState.gps.watchId = null;
  }

  appState.gps.isTracking = false;
  appState.gps.status = 'inactive';
  appState.gps.currentPosition = null;
  appState.gps.accuracy = null;
  appState.gps.lastUpdate = null;
  
  updateGPSStatusUI();
}

function handleGPSSuccess(position) {
  appState.gps.currentPosition = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude
  };
  appState.gps.accuracy = position.coords.accuracy;
  appState.gps.lastUpdate = Date.now();

  // Determine GPS status based on accuracy
  if (appState.gps.accuracy <= 15) {
    appState.gps.status = 'ready';
  } else {
    appState.gps.status = 'poor';
  }

  updateGPSStatusUI();
  console.log(`GPS updated: accuracy ±${appState.gps.accuracy.toFixed(1)}m`);
}

function handleGPSError(error) {
  console.error('GPS error:', error);
  appState.gps.status = 'error';
  appState.gps.currentPosition = null;
  appState.gps.accuracy = null;
  
  updateGPSStatusUI();

  let errorMessage = '';
  switch(error.code) {
    case error.PERMISSION_DENIED:
      errorMessage = 'Location access denied';
      break;
    case error.POSITION_UNAVAILABLE:
      errorMessage = 'Location unavailable';
      break;
    case error.TIMEOUT:
      errorMessage = 'Location timeout';
      break;
    default:
      errorMessage = 'Location error';
      break;
  }

  if (window.showNotification) {
    window.showNotification(`GPS Error: ${errorMessage}`, 'error');
  }
}

function updateGPSStatusUI() {
  // This will be called by UI functions
  if (window.updateGPSStatusDisplay) {
    window.updateGPSStatusDisplay();
  }
}

// Capture base with GPS location verification
async function captureBaseWithLocation(baseId) {
  let latitude, longitude, accuracy;
  let usingFreshGPS = false;

  // Try to use continuous GPS first
  if (appState.gps.currentPosition && 
      appState.gps.lastUpdate && 
      (Date.now() - appState.gps.lastUpdate) <= 30000) {
    
    latitude = appState.gps.currentPosition.latitude;
    longitude = appState.gps.currentPosition.longitude;
    accuracy = appState.gps.accuracy;
    
  } else {
    // Fall back to fresh GPS request
    if (window.showNotification) {
      window.showNotification('Getting location for capture...', 'info');
    }
    
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000
        });
      });
      
      latitude = position.coords.latitude;
      longitude = position.coords.longitude;
      accuracy = position.coords.accuracy;
      usingFreshGPS = true;
      
    } catch (error) {
      // Only throw error if we truly can't get any GPS
      let errorMessage = 'Unable to verify your location for base capture. ';
      
      switch(error.code) {
        case error.PERMISSION_DENIED:
          errorMessage += 'Please enable location services and try again.';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage += 'Location services are unavailable.';
          break;
        case error.TIMEOUT:
          errorMessage += 'Location request timed out. Please try again.';
          break;
        default:
          errorMessage += 'Please check your GPS settings and try again.';
          break;
      }
      throw new Error(errorMessage);
    }
  }

  // Provide feedback about GPS accuracy but don't block capture
  if (accuracy > 20) {
    if (window.showNotification) {
      window.showNotification(
        `Capturing with GPS accuracy of ±${accuracy.toFixed(1)}m. Server will verify if you're close enough.`, 
        'warning'
      );
    }
  }

  // Always attempt the capture - let the server validate distance
  try {
    await captureBase(baseId, latitude, longitude);
    
    // Show success with GPS info
    if (window.showNotification) {
      const gpsInfo = usingFreshGPS ? 'fresh GPS' : 'tracked GPS';
      window.showNotification(`Base captured successfully! (using ${gpsInfo})`, 'success');
    }
    
  } catch (err) {
    throw err; // Let capture errors (like "too far from base") bubble up
  }
}

// =============================================================================
// GAME DATA MANAGEMENT
// =============================================================================

// Fetch game data with offline support
async function fetchGameData(gameId) {
  try {
    setLoading(true);
    console.log('Fetching game data for ID:', gameId);

    let data = null;
    let fromCache = false;

    try {
      // Try to fetch from the network first
      const response = await fetch(API_BASE_URL + '/games/' + gameId);

      if (response.ok) {
        data = await response.json();
        console.log('Game data received from server:', data);

        // Cache the fresh data
        if (window.dbHelpers) {
          window.dbHelpers.cacheGameData(data).catch(cacheErr => {
            console.warn('Failed to cache game data:', cacheErr);
          });
        }
      } else {
        throw new Error('Failed to load game data from server');
      }
    } catch (networkError) {
      console.warn('Network fetch failed, trying cache:', networkError);

      // Try to load from cache if network fetch failed
      if (window.dbHelpers) {
        try {
          data = await window.dbHelpers.loadCachedGameData(gameId);
          fromCache = true;
          console.log('Game data loaded from cache:', data);
        } catch (cacheError) {
          throw new Error('Unable to load game data. Please check your connection and try again.');
        }
      } else {
        throw new Error('Unable to load game data. Please check your connection and try again.');
      }
    }

    // Update game data
    appState.gameData.id = data.id;
    appState.gameData.name = data.name;
    appState.gameData.teams = data.teams;
    appState.gameData.bases = data.bases;
    appState.gameData.status = data.status;
    appState.gameData.hostName = data.hostName;
    appState.gameData.settings = data.settings || {};

    // Show offline notification if data came from cache
    if (fromCache && window.showNotification) {
      window.showNotification('Using cached game data (offline mode)', 'warning');
    }

    // Re-render with new data - UI will handle this
    if (window.renderApp) {
      window.renderApp();
    }
  } catch (err) {
    console.error('Error fetching game data:', err);
    const userMessage = err.message || 'Unable to load game data. Please try again.';
    if (window.showNotification) {
      window.showNotification(userMessage, 'error');
    }
    throw err;
  } finally {
    setLoading(false);
  }
}

// Fetch scores and game updates
async function fetchGameUpdates() {
  if (!appState.gameData.id) return;

  try {
    // Fetch complete game data instead of just scores
    const response = await fetch(API_BASE_URL + '/games/' + appState.gameData.id);
    if (!response.ok) {
      throw new Error('Failed to fetch game updates');
    }

    const gameData = await response.json();

    // Update teams with scores
    appState.gameData.teams = gameData.teams;

    // Update bases with ownership information
    appState.gameData.bases = gameData.bases;

    // Update game status in case it changed
    appState.gameData.status = gameData.status;

    // Only update specific UI components instead of full re-render
    if (appState.page === 'gameView') {
      // Update scoreboard
      if (window.updateScoreboard) {
        window.updateScoreboard();
      }

      // Update map markers
      if (window.updateMapMarkers) {
        window.updateMapMarkers();
      }

      // Update header status if it exists
      const statusElement = document.getElementById('game-status-text');
      if (statusElement && window.updateGameStatusText) {
        window.updateGameStatusText(statusElement);
      }
    } else {
      // Only do full re-render if we're not on the game view
      if (window.renderApp) {
        window.renderApp();
      }
    }
  } catch (err) {
    console.error('Error fetching game updates:', err);
    // Don't show error notification for background updates to avoid spam
  }
}

// Set up polling for scores
let scorePollingInterval = null;

function startScorePolling() {
  if (appState.page === 'gameView' && appState.gameData.id) {
    // Initial fetch
    fetchGameUpdates();

    // Clear any existing interval
    if (scorePollingInterval) {
      clearInterval(scorePollingInterval);
    }

    // Set up polling every 5 seconds
    scorePollingInterval = setInterval(fetchGameUpdates, 5000);
    console.log('Game updates polling started');
  }
}

function stopScorePolling() {
  if (scorePollingInterval) {
    clearInterval(scorePollingInterval);
    scorePollingInterval = null;
    console.log('Game update polling stopped');
  }
}

// =============================================================================
// GAME MANAGEMENT FUNCTIONS
// =============================================================================

// Create game
async function createGame(gameSettings) {
  try {
    setLoading(true);
    console.log('Creating game with settings:', gameSettings);

    const authState = getAuthState();
    if (!authState.isHost) {
      throw new Error('Host authentication required to create games.');
    }

    const requestBody = {
      name: gameSettings.name,
      host_id: authState.hostId
    };

    // Add optional settings if provided
    if (gameSettings.capture_radius_meters !== undefined) {
      requestBody.capture_radius_meters = gameSettings.capture_radius_meters;
    }
    if (gameSettings.points_interval_seconds !== undefined) {
      requestBody.points_interval_seconds = gameSettings.points_interval_seconds;
    }
    if (gameSettings.auto_start_time !== undefined) {
      requestBody.auto_start_time = gameSettings.auto_start_time;
    }
    if (gameSettings.game_duration_minutes !== undefined) {
      requestBody.game_duration_minutes = gameSettings.game_duration_minutes;
    }

    const response = await fetch(API_BASE_URL + '/games', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await handleApiResponse(response, 'Failed to create game');
    const gameId = data.game_id;
    console.log('Game created successfully, game ID:', gameId);

    // Update authentication state
    updateAuthState({ gameId: gameId });
    appState.gameData.id = gameId;

    // Fetch the full game data after creation
    await fetchGameData(gameId);

    // Show success message with settings info
    let successMessage = `Game created successfully! Game ID: ${gameId}`;

    if (gameSettings.auto_start_time) {
      const startTime = new Date(gameSettings.auto_start_time * 1000);
      successMessage += `\n\nAuto-start: ${startTime.toLocaleString()}`;
    }

    if (gameSettings.game_duration_minutes) {
      const hours = Math.floor(gameSettings.game_duration_minutes / 60);
      const minutes = gameSettings.game_duration_minutes % 60;
      if (hours > 0) {
        successMessage += `\nDuration: ${hours}h ${minutes}m`;
      } else {
        successMessage += `\nDuration: ${minutes}m`;
      }
    }

    successMessage += '\n\nYou can now scan QR codes to add teams and bases.';

    if (window.showNotification) {
      window.showNotification(successMessage, 'success');
    }

    // Check if there's a pending QR code to handle
    const pendingQR = sessionStorage.getItem('pendingQRCode');
    if (pendingQR) {
      handleQRCode(pendingQR);
    }
  } catch (err) {
    console.error('Error creating game:', err);
    const userMessage = err.message || 'Unable to create game. Please try again.';
    if (window.showNotification) {
      window.showNotification(userMessage, 'error');
    }
    throw err;
  } finally {
    setLoading(false);
  }
}

// Start game
async function startGame() {
  if (!appState.gameData.id) {
    throw new Error('No game loaded to start.');
  }

  try {
    setLoading(true);

    const authState = getAuthState();
    if (!authState.isHost) {
      throw new Error('Only the game host can start the game.');
    }

    const response = await fetch(API_BASE_URL + '/games/' + appState.gameData.id + '/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        host_id: authState.hostId
      })
    });

    await handleApiResponse(response, 'Failed to start game');

    // Update game status
    appState.gameData.status = 'active';

    // Show success message and navigate - UI will handle this
    if (window.showNotification) {
      window.showNotification('Game has been started!', 'success');
    }
    if (window.navigateTo) {
      window.navigateTo('gameView');
    }
  } catch (err) {
    console.error('Error starting game:', err);
    const userMessage = err.message || 'Unable to start game. Please try again.';
    if (window.showNotification) {
      window.showNotification(userMessage, 'error');
    }
    throw err;
  } finally {
    setLoading(false);
  }
}

// End game
async function endGame() {
  if (!appState.gameData.id) {
    throw new Error('No game loaded to end.');
  }

  try {
    setLoading(true);

    const authState = getAuthState();
    if (!authState.isHost) {
      throw new Error('Only the game host can end the game.');
    }

    const response = await fetch(API_BASE_URL + '/games/' + appState.gameData.id + '/end', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        host_id: authState.hostId
      })
    });

    await handleApiResponse(response, 'Failed to end game');

    // Update game status
    appState.gameData.status = 'ended';

    // Navigate to results - UI will handle this
    if (window.navigateTo) {
      window.navigateTo('results');
    }
  } catch (err) {
    console.error('Error ending game:', err);
    const userMessage = err.message || 'Unable to end game. Please try again.';
    if (window.showNotification) {
      window.showNotification(userMessage, 'error');
    }
    throw err;
  } finally {
    setLoading(false);
  }
}

// =============================================================================
// PLAYER ACTIONS
// =============================================================================

// Join team
async function joinTeam(teamId) {
  try {
    setLoading(true);
    console.log('Joining team:', teamId);

    const response = await fetch(API_BASE_URL + '/teams/' + teamId + '/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    const data = await handleApiResponse(response, 'Failed to join team');
    const playerId = data.player_id;
    console.log('Joined team, player ID:', playerId);

    // Update authentication state
    updateAuthState({
      teamId: teamId,
      playerId: playerId
    });

    const teamName = getTeamName(teamId);

    // Show success message and navigate - UI will handle this
    if (window.showNotification) {
      window.showNotification(`You have successfully joined ${teamName}!`, 'success');
    }
    if (window.navigateTo) {
      window.navigateTo('gameView');
    }
  } catch (err) {
    console.error('Error joining team:', err);
    const userMessage = err.message || 'Unable to join team. Please try again.';
    if (window.showNotification) {
      window.showNotification(userMessage, 'error');
    }
    throw err;
  } finally {
    setLoading(false);
  }
}

// Handle base capture with offline support
async function captureBase(baseId, latitude, longitude) {
  const authState = getAuthState();
  if (!authState.hasTeam) {
    throw new Error('You must join a team before capturing bases.');
  }

  try {
    setLoading(true);

    // Check if we're online
    if (navigator.onLine) {
      // Try online capture
      const response = await fetch(API_BASE_URL + '/bases/' + baseId + '/capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          player_id: authState.playerId,
          latitude: latitude,
          longitude: longitude
        })
      });

      await handleApiResponse(response, 'Failed to capture base');

      // Update scores
      await fetchGameUpdates();

      // Show success message - UI will handle this
      if (window.showNotification) {
        window.showNotification('Base captured successfully!', 'success');
      }
    } else {
      // We're offline, store for later sync
      if (window.dbHelpers && window.dbHelpers.addPendingCapture) {
        await window.dbHelpers.addPendingCapture(
          baseId,
          authState.playerId,
          latitude,
          longitude
        );

        // Show offline message - UI will handle this
        if (window.showNotification) {
          window.showNotification('Base capture queued (offline mode). Will sync when online.', 'warning');
        }
      } else {
        throw new Error('You are offline and offline capture is not available. Please try again when online.');
      }
    }
  } catch (err) {
    console.error('Error capturing base:', err);
    const userMessage = err.message || 'Unable to capture base. Please try again.';
    if (window.showNotification) {
      window.showNotification(userMessage, 'error');
    }
    throw err;
  } finally {
    setLoading(false);
  }
}

// =============================================================================
// HOST MANAGEMENT FUNCTIONS
// =============================================================================

// Create team with QR code
async function createTeam(qrId, name, color) {
  try {
    setLoading(true);

    const authState = getAuthState();
    if (!authState.hasGame || !authState.isHost) {
      throw new Error('Host authentication required to create teams.');
    }

    const response = await fetch(`${API_BASE_URL}/games/${authState.gameId}/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        host_id: authState.hostId,
        name: name,
        color: color,
        qr_code: qrId
      })
    });

    await handleApiResponse(response, 'Failed to create team');

    // Clear the pending QR code
    sessionStorage.removeItem('pendingQRCode');

    // Show success message - UI will handle this
    if (window.showNotification) {
      window.showNotification(`Team "${name}" created successfully!`, 'success');
    }

    // Refresh game data
    await fetchGameData(authState.gameId);

    // Navigate back to host panel - UI will handle this
    if (window.navigateTo) {
      window.navigateTo('hostPanel');
    }
  } catch (err) {
    console.error('Error creating team:', err);
    const userMessage = err.message || 'Unable to create team. Please try again.';
    if (window.showNotification) {
      window.showNotification(userMessage, 'error');
    }
    throw err;
  } finally {
    setLoading(false);
  }
}

// Update team name and color
async function updateTeam(teamId, name, color) {
  try {
    setLoading(true);

    const authState = getAuthState();
    if (!authState.hasGame || !authState.isHost) {
      throw new Error('Host authentication required to update teams.');
    }

    const response = await fetch(`${API_BASE_URL}/teams/${teamId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        host_id: authState.hostId,
        name: name,
        color: color
      })
    });

    await handleApiResponse(response, 'Failed to update team');

    // Show success message - UI will handle this
    if (window.showNotification) {
      window.showNotification('Team updated successfully!', 'success');
    }

    // Refresh game data
    await fetchGameData(authState.gameId);
  } catch (err) {
    console.error('Error updating team:', err);
    const userMessage = err.message || 'Unable to update team. Please try again.';
    if (window.showNotification) {
      window.showNotification(userMessage, 'error');
    }
    throw err;
  } finally {
    setLoading(false);
  }
}

// Create base with QR code
async function createBase(qrId, name, latitude, longitude) {
  try {
    setLoading(true);

    const authState = getAuthState();
    if (!authState.hasGame || !authState.isHost) {
      throw new Error('Host authentication required to create bases.');
    }

    const response = await fetch(`${API_BASE_URL}/games/${authState.gameId}/bases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        host_id: authState.hostId,
        name: name,
        latitude: latitude,
        longitude: longitude,
        qr_code: qrId
      })
    });

    await handleApiResponse(response, 'Failed to create base');

    // Clear the pending QR code
    sessionStorage.removeItem('pendingQRCode');

    // Show success message - UI will handle this
    if (window.showNotification) {
      window.showNotification(`Base "${name}" created successfully!`, 'success');
    }

    // Refresh game data
    await fetchGameData(authState.gameId);

    // Navigate back to host panel - UI will handle this
    if (window.navigateTo) {
      window.navigateTo('hostPanel');
    }
  } catch (err) {
    console.error('Error creating base:', err);
    const userMessage = err.message || 'Unable to create base. Please try again.';
    if (window.showNotification) {
      window.showNotification(userMessage, 'error');
    }
    throw err;
  } finally {
    setLoading(false);
  }
}

// Delete game (host can delete their own games)
async function deleteGame() {
  if (!appState.gameData.id) {
    throw new Error('No game loaded to delete.');
  }

  try {
    setLoading(true);

    const authState = getAuthState();
    if (!authState.isHost) {
      throw new Error('Only the game host can delete the game.');
    }

    const response = await fetch(API_BASE_URL + '/games/' + appState.gameData.id, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        host_id: authState.hostId
      })
    });

    const result = await handleApiResponse(response, 'Failed to delete game');

    // Clear game data from local storage and app state
    clearGameState();

    // Show success message with details - UI will handle this
    if (window.showNotification) {
      const deleted = result.deleted;
      const message = `Game deleted successfully!\n\nRemoved: ${deleted.teams} teams, ${deleted.bases} bases, ${deleted.players} players, ${deleted.captures} captures\n\nAll QR codes have been released for reuse.`;
      window.showNotification(message, 'success');
    }

    // Navigate to landing page - UI will handle this
    if (window.navigateTo) {
      window.navigateTo('landing');
    }
  } catch (err) {
    console.error('Error deleting game:', err);
    const userMessage = err.message || 'Unable to delete game. Please try again.';
    if (window.showNotification) {
      window.showNotification(userMessage, 'error');
    }
    throw err;
  } finally {
    setLoading(false);
  }
}


// =============================================================================
// SITE ADMIN FUNCTIONS
// =============================================================================

// Site admin authentication
async function authenticateSiteAdmin(password) {
  try {
    setLoading(true);

    // Store the admin token in memory only (not in localStorage for security)
    appState.siteAdmin.token = password;
    appState.siteAdmin.isAuthenticated = true;

    // Test authentication with a request to the hosts endpoint
    const response = await fetch(`${API_BASE_URL}/hosts`, {
      headers: {
        'Authorization': `Bearer ${password}`
      }
    });

    if (!response.ok) {
      // Reset auth state
      appState.siteAdmin.token = null;
      appState.siteAdmin.isAuthenticated = false;

      if (response.status === 401) {
        throw new Error('Invalid admin password. Please check your credentials.');
      } else {
        throw new Error('Authentication failed. Please try again.');
      }
    }

    // Show success message - UI will handle this
    if (window.showNotification) {
      window.showNotification('Site admin authenticated successfully', 'success');
    }

    // Clear any existing admin data to force fresh load
    clearSiteAdminData();

    return true;
  } catch (err) {
    console.error('Site admin authentication error:', err);
    const userMessage = err.message || 'Authentication failed. Please try again.';
    if (window.showNotification) {
      window.showNotification(userMessage, 'error');
    }
    return false;
  } finally {
    setLoading(false);
  }
}

// Fetch games for a specific host
async function fetchHostGames(hostId) {
  if (!hostId) {
    throw new Error('Host ID is required to fetch games.');
  }

  try {
    console.log('Fetching games for host:', hostId);

    const response = await fetch(`${API_BASE_URL}/hosts/${hostId}/games`);
    const data = await handleApiResponse(response, 'Failed to fetch host games');

    console.log('Host games received:', data);
    return data;
  } catch (err) {
    console.error('Error fetching host games:', err);
    const userMessage = err.message || 'Unable to load your games. Please try again.';
    if (window.showNotification) {
      window.showNotification(userMessage, 'error');
    }
    throw err;
  }
}

// Site admin host management functions
async function fetchHosts() {
  if (!appState.siteAdmin.isAuthenticated || !appState.siteAdmin.token) {
    throw new Error('Admin authentication required to fetch hosts.');
  }

  try {
    setLoading(true);

    const response = await fetch(`${API_BASE_URL}/hosts`, {
      headers: {
        'Authorization': `Bearer ${appState.siteAdmin.token}`
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Reset admin auth if unauthorized
        appState.siteAdmin.isAuthenticated = false;
        appState.siteAdmin.token = null;
        throw new Error('Admin session expired. Please login again.');
      }
      throw new Error('Unable to load hosts. Please try again.');
    }

    const hosts = await response.json();
    return hosts;
  } catch (err) {
    console.error('Error fetching hosts:', err);
    const userMessage = err.message || 'Unable to load hosts. Please try again.';
    if (window.showNotification) {
      window.showNotification(userMessage, 'error');
    }
    throw err;
  } finally {
    setLoading(false);
  }
}

async function createHost(hostData) {
  if (!appState.siteAdmin.isAuthenticated || !appState.siteAdmin.token) {
    throw new Error('Admin authentication required to create hosts.');
  }

  try {
    setLoading(true);

    const response = await fetch(`${API_BASE_URL}/hosts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${appState.siteAdmin.token}`
      },
      body: JSON.stringify(hostData)
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Reset admin auth if unauthorized
        appState.siteAdmin.isAuthenticated = false;
        appState.siteAdmin.token = null;
        throw new Error('Admin session expired. Please login again.');
      }
      throw new Error('Unable to create host. Please check your details and try again.');
    }

    const result = await response.json();

    // Show success message - UI will handle this
    if (window.showNotification) {
      window.showNotification('Host created successfully!', 'success');
    }

    refreshSiteAdminHosts();
    return result;
  } catch (err) {
    console.error('Error creating host:', err);
    const userMessage = err.message || 'Unable to create host. Please try again.';
    if (window.showNotification) {
      window.showNotification(userMessage, 'error');
    }
    throw err;
  } finally {
    setLoading(false);
  }
}

async function updateHost(hostId, hostData) {
  if (!appState.siteAdmin.isAuthenticated || !appState.siteAdmin.token) {
    throw new Error('Admin authentication required to update hosts.');
  }

  try {
    setLoading(true);

    const response = await fetch(`${API_BASE_URL}/hosts/${hostId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${appState.siteAdmin.token}`
      },
      body: JSON.stringify(hostData)
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Reset admin auth if unauthorized
        appState.siteAdmin.isAuthenticated = false;
        appState.siteAdmin.token = null;
        throw new Error('Admin session expired. Please login again.');
      }
      throw new Error('Unable to update host. Please check your details and try again.');
    }

    const result = await response.json();

    // Show success message - UI will handle this
    if (window.showNotification) {
      window.showNotification('Host updated successfully!', 'success');
    }

    refreshSiteAdminHosts();
    return result;
  } catch (err) {
    console.error('Error updating host:', err);
    const userMessage = err.message || 'Unable to update host. Please try again.';
    if (window.showNotification) {
      window.showNotification(userMessage, 'error');
    }
    throw err;
  } finally {
    setLoading(false);
  }
}

async function deleteHost(hostId) {
  if (!appState.siteAdmin.isAuthenticated || !appState.siteAdmin.token) {
    throw new Error('Admin authentication required to delete hosts.');
  }

  try {
    setLoading(true);

    const response = await fetch(`${API_BASE_URL}/hosts/${hostId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${appState.siteAdmin.token}`
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Reset admin auth if unauthorized
        appState.siteAdmin.isAuthenticated = false;
        appState.siteAdmin.token = null;
        throw new Error('Admin session expired. Please login again.');
      }

      // Use handleApiResponse to get the actual error message from backend
      await handleApiResponse(response, 'Unable to delete host');
    }

    // Show success message - UI will handle this
    if (window.showNotification) {
      window.showNotification('Host deleted successfully!', 'success');
    }

    refreshSiteAdminHosts();
    return true;
  } catch (err) {
    console.error('Error deleting host:', err);

    // Provide more helpful error message for the common case
    let userMessage = err.message;
    if (userMessage && userMessage.includes('Cannot delete host with active games')) {
      userMessage = 'Cannot delete host with active games. Please delete all games for this host first, then try again.';
    } else if (!userMessage || userMessage === 'Unable to delete host') {
      userMessage = 'Unable to delete host. Please try again.';
    }

    if (window.showNotification) {
      window.showNotification(userMessage, 'error');
    }
    throw err;
  } finally {
    setLoading(false);
  }
}

async function loadSiteAdminHosts() {
  // Prevent duplicate loading
  if (appState.siteAdmin.hostsLoading || appState.siteAdmin.hostsLoaded) {
    return;
  }

  try {
    appState.siteAdmin.hostsLoading = true;
    appState.siteAdmin.hostsError = null;

    // Re-render to show loading state - UI will handle this
    if (window.renderApp) {
      window.renderApp();
    }

    const hosts = await fetchHosts();

    appState.siteAdmin.hosts = hosts;
    appState.siteAdmin.hostsLoaded = true;
    appState.siteAdmin.hostsError = null;
  } catch (error) {
    console.error('Error loading hosts:', error);
    appState.siteAdmin.hostsError = error.message || 'Unable to load hosts. Please try again.';
    appState.siteAdmin.hosts = [];
  } finally {
    appState.siteAdmin.hostsLoading = false;

    // Final render with data or error - UI will handle this
    if (window.renderApp) {
      window.renderApp();
    }
  }
}

// Clear host and game data
function clearSiteAdminData() {
  appState.siteAdmin.hosts = [];
  appState.siteAdmin.hostsLoading = false;
  appState.siteAdmin.hostsLoaded = false;
  appState.siteAdmin.hostsError = null;
  appState.siteAdmin.games = [];
  appState.siteAdmin.gamesLoading = false;
  appState.siteAdmin.gamesLoaded = false;
  appState.siteAdmin.gamesError = null;
}

function refreshSiteAdminHosts() {
  // Force refresh by clearing loaded state
  appState.siteAdmin.hostsLoaded = false;
  loadSiteAdminHosts();
}

async function loadSiteAdminGames() {
  // Prevent duplicate loading
  if (appState.siteAdmin.gamesLoading || appState.siteAdmin.gamesLoaded) {
    return;
  }

  try {
    appState.siteAdmin.gamesLoading = true;
    appState.siteAdmin.gamesError = null;

    // Re-render to show loading state
    if (window.renderApp) {
      window.renderApp();
    }

    // First, get all hosts to get their games
    const hosts = await fetchHosts();

    let allGames = [];

    // For each host, get their games using existing API
    for (const host of hosts) {
      try {
        const response = await fetch(`${API_BASE_URL}/hosts/${host.id}/games`);
        if (response.ok) {
          const hostGames = await response.json();

          // Add host info to each game
          const gamesWithHost = hostGames.map(game => ({
            ...game,
            host_id: host.id,
            host_name: host.name,
            host_qr_code: host.qr_code
          }));

          allGames = allGames.concat(gamesWithHost);
        }
      } catch (error) {
        console.warn(`Failed to load games for host ${host.name}:`, error);
      }
    }

    // For each game, get detailed info to get base/team/player counts
    for (let i = 0; i < allGames.length; i++) {
      try {
        const response = await fetch(`${API_BASE_URL}/games/${allGames[i].id}`);
        if (response.ok) {
          const gameDetails = await response.json();
          allGames[i].bases_count = gameDetails.bases ? gameDetails.bases.length : 0;
          allGames[i].teams_count = gameDetails.teams ? gameDetails.teams.length : 0;

          // Count total players across all teams
          let totalPlayers = 0;
          if (gameDetails.teams) {
            totalPlayers = gameDetails.teams.reduce((sum, team) => sum + (team.playerCount || 0), 0);
          }
          allGames[i].players_count = totalPlayers;
        }
      } catch (error) {
        console.warn(`Failed to load details for game ${allGames[i].id}:`, error);
        // Set defaults if we can't get details
        allGames[i].bases_count = 0;
        allGames[i].teams_count = 0;
        allGames[i].players_count = 0;
      }
    }

    // Sort games by status priority and start time
    allGames.sort((a, b) => {
      const statusPriority = { 'active': 1, 'setup': 2, 'ended': 3 };
      const aPriority = statusPriority[a.status] || 4;
      const bPriority = statusPriority[b.status] || 4;

      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      // If same status, sort by start time (most recent first)
      return (b.start_time || 0) - (a.start_time || 0);
    });

    appState.siteAdmin.games = allGames;
    appState.siteAdmin.gamesLoaded = true;
    appState.siteAdmin.gamesError = null;
  } catch (error) {
    console.error('Error loading games:', error);
    appState.siteAdmin.gamesError = error.message || 'Unable to load games. Please try again.';
    appState.siteAdmin.games = [];
  } finally {
    appState.siteAdmin.gamesLoading = false;

    // Final render with data or error
    if (window.renderApp) {
      window.renderApp();
    }
  }
}

function refreshSiteAdminGames() {
  // Force refresh by clearing loaded state
  appState.siteAdmin.gamesLoaded = false;
  loadSiteAdminGames();
}

// Complete a game by impersonating the host
async function completeGameAsAdmin(game) {
  if (!appState.siteAdmin.isAuthenticated || !appState.siteAdmin.token) {
    throw new Error('Admin authentication required to complete games.');
  }

  try {
    setLoading(true);

    // Use existing end game API, passing the host_id from the game
    const response = await fetch(`${API_BASE_URL}/games/${game.id}/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        host_id: game.host_id
      })
    });

    await handleApiResponse(response, 'Failed to complete game');

    // Show success message
    if (window.showNotification) {
      window.showNotification(`Game "${game.name}" completed successfully! QR codes have been released.`, 'success');
    }

    refreshSiteAdminGames();
    return true;
  } catch (err) {
    console.error('Error completing game:', err);
    const userMessage = err.message || 'Unable to complete game. Please try again.';
    if (window.showNotification) {
      window.showNotification(userMessage, 'error');
    }
    throw err;
  } finally {
    setLoading(false);
  }
}

// Delete game as admin by impersonating the host
async function deleteGameAsAdmin(game) {
  if (!appState.siteAdmin.isAuthenticated || !appState.siteAdmin.token) {
    throw new Error('Admin authentication required to delete games.');
  }

  try {
    setLoading(true);

    // Use the host endpoint by providing the host_id (admin knows all host IDs)
    const response = await fetch(`${API_BASE_URL}/games/${game.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        host_id: game.host_id
      })
    });

    const result = await handleApiResponse(response, 'Failed to delete game');

    // Show success message with details
    if (window.showNotification) {
      const deleted = result.deleted || {};
      const message = `Game "${game.name}" deleted successfully!\n\nRemoved: ${deleted.teams || 0} teams, ${deleted.bases || 0} bases, ${deleted.players || 0} players, ${deleted.captures || 0} captures`;
      window.showNotification(message, 'success');
    }

    refreshSiteAdminGames();
    return true;
  } catch (err) {
    console.error('Error deleting game as host:', err);
    const userMessage = err.message || 'Unable to delete game. Please try again.';
    if (window.showNotification) {
      window.showNotification(userMessage, 'error');
    }
    throw err;
  } finally {
    setLoading(false);
  }
}

// =============================================================================
// STATE MANAGEMENT FUNCTIONS
// =============================================================================

// Set loading state
function setLoading(isLoading) {
  appState.loading = isLoading;

  // Re-render to show loading state - UI will handle this
  if (window.renderApp) {
    window.renderApp();
  }
}

// Set error state - DEPRECATED: Use showNotification instead for user messages
function setError(errorMessage) {
  appState.error = errorMessage;

  // Show error notification if there's a message - UI will handle this
  if (errorMessage && window.showNotification) {
    window.showNotification(errorMessage, 'error');

    // Auto-clear error state after 5 seconds
    setTimeout(function () {
      appState.error = null;
    }, 5000);
  }

  // Still render the app for other state changes - UI will handle this
  if (window.renderApp) {
    window.renderApp();
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

// Helper function to safely get team name
function getTeamName(teamId) {
  if (!teamId || !appState.gameData.teams) return 'Loading...';

  const team = appState.gameData.teams.find(function(t) { return t.id === teamId; });
  return team ? team.name : 'Loading...';
}

// Main entry point for QR code scanning (called by UI)
function handleQRScan(qrCode) {
  return handleQRCode(qrCode, 'scan');
}

// Log out/clear data - public interface
function clearGameData() {
  clearGameState();

  // Navigate to landing - UI will handle this
  if (window.navigateTo) {
    window.navigateTo('landing');
  }

  // Display confirmation message to user - UI will handle this
  setTimeout(function() {
    if (window.showNotification) {
      window.showNotification('You have successfully left the game. Scan a QR code or create a new game to play again.', 'success');
    }
  }, 300);
}

// Logout host completely
function logoutHost() {
  // Clear host authentication
  localStorage.removeItem('hostId');
  appState.hostId = null;
  
  // Also clear any game data
  clearGameState();
  
  console.log('Host logged out completely');
}

// Load Eruda debug console on demand
function loadErudaDebugConsole() {
  // Check if already loaded
  if (window.eruda) {
    showNotification('Debug console already loaded', 'info');
    return;
  }

  showNotification('Loading debug console...', 'info');

  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/eruda';
  document.head.appendChild(script);
  
  script.onload = function() {
    eruda.init({
      tool: ['console', 'elements', 'network', 'info'],
      useShadowDom: true,
      autoScale: true
    });
    showNotification('🐛 Debug console loaded! Look for icon in corner.', 'success');
    console.log('🐛 QR Conquest Debug Console ready');
  };
  
  script.onerror = function() {
    showNotification('Failed to load debug console', 'error');
  };
}