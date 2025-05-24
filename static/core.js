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
    hostId: null,  
    hostName: null,
    status: 'setup'
  },
  loading: false,
  error: null,
  pendingQRCode: null,
  siteAdmin: {
    isAuthenticated: false,
    token: null,
    hosts: [],           // Array of host objects
    hostsLoading: false, // Loading state for hosts
    hostsLoaded: false,  // Whether hosts have been loaded
    hostsError: null     // Error state for host loading
  }
};

// API endpoint
const API_BASE_URL = '/api';

// DOM elements cache
const elements = {};

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
    hostName: localStorage.getItem('hostName'),
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
  // Update localStorage
  if (authData.hostId !== undefined) {
    if (authData.hostId) {
      localStorage.setItem('hostId', authData.hostId);
      localStorage.setItem('hostName', authData.hostName || 'Host');
    } else {
      localStorage.removeItem('hostId');
      localStorage.removeItem('hostName');
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

  // Update app state
  if (authData.hostId !== undefined) {
    appState.gameData.hostId = authData.hostId;
    appState.gameData.hostName = authData.hostName;
  }

  if (authData.teamId !== undefined) {
    appState.gameData.currentTeam = authData.teamId;
    appState.gameData.currentPlayer = authData.playerId;
  }
}

// Clear all authentication data
function clearAuthState() {
  localStorage.removeItem('gameId');
  localStorage.removeItem('teamId');
  localStorage.removeItem('playerId');
  localStorage.removeItem('hostId');
  localStorage.removeItem('hostName');

  // Clear sessionStorage data
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
    hostId: null,
    hostName: null,
    status: 'setup'
  };

  // Clear any pending QR code
  appState.pendingQRCode = null;
  appState.error = null;
  appState.loading = false;

  console.log('Authentication state cleared');
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
    navigateTo('qrAssignment');
    return;
  }

  try {
    setLoading(true);

    // Check what this QR code corresponds to
    const statusResponse = await fetch(`${API_BASE_URL}/qr-codes/${qrCode}/status`);

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      console.error('QR code status response error:', statusResponse.status, errorText);
      throw new Error(`Failed to check QR code status: ${statusResponse.status} ${statusResponse.statusText}`);
    }

    const responseText = await statusResponse.text();
    let statusData;
    
    try {
      statusData = JSON.parse(responseText);
    } catch (jsonError) {
      console.error('Error parsing QR code status response:', jsonError);
      throw new Error('Invalid response format when checking QR code');
    }

    // Route to appropriate handler based on QR type
    await routeQRCode(qrCode, statusData);

  } catch (err) {
    console.error('Error processing QR code:', err);
    
    // If we have no game loaded and this is an unrecognised QR code
    if (!getAuthState().hasGame) {
      appState.pendingQRCode = qrCode;
      navigateTo('firstTime');
    } else {
      setError(err.message);
    }
  } finally {
    setLoading(false);
  }
}

// Route QR code to appropriate handler based on type
async function routeQRCode(qrCode, statusData) {
  const authState = getAuthState();

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
      throw new Error('Unknown QR code type');
  }
}

// Handle host QR codes
async function handleHostQR(qrCode, statusData) {
  if (statusData.expired) {
    throw new Error('This host access has expired');
  }

  // Update authentication state
  updateAuthState({
    hostId: statusData.host_id,
    hostName: statusData.name
  });

  showNotification(`Welcome, ${statusData.name}!`, 'success');
  navigateTo('hostPanel');
}

// Handle team QR codes
async function handleTeamQR(qrCode, statusData) {
  const authState = getAuthState();
  const teamId = statusData.team_id;
  const gameId = statusData.game_id;

  console.log('Team QR scanned:', teamId, 'Game ID:', gameId);

  // If user is already on a team
  if (authState.hasTeam) {
    if (authState.teamId === teamId) {
      setError('You are already a member of this team.');
    } else {
      setError('You are already on a different team. Please continue playing.');
    }
    navigateTo('gameView');
    return;
  }

  // If we have a game loaded but QR is for different game
  if (authState.hasGame && authState.gameId !== gameId) {
    setError(`This team belongs to a different game. You are currently in game ${authState.gameId}.`);
    return;
  }

  // If no game is loaded yet but QR code has a game ID
  if (!authState.hasGame && gameId) {
    try {
      console.log('Loading game from team QR code, Game ID:', gameId);
      updateAuthState({ gameId: gameId });
      await fetchGameData(gameId);
    } catch (err) {
      setError('Failed to load game: ' + err.message);
      console.error('Error loading game from team QR:', err);
      return;
    }
  }

  // Store team ID and go to registration
  sessionStorage.setItem('pendingTeamId', teamId);
  navigateTo('playerRegistration');
}

// Handle base QR codes
async function handleBaseQR(qrCode, statusData) {
  const authState = getAuthState();
  const baseId = statusData.base_id;
  const gameId = statusData.game_id;

  console.log('Base QR scanned:', baseId, 'QR code:', qrCode);

  // Check if user is on a team
  if (!authState.hasTeam) {
    setError('You need to join a team before capturing bases. Please scan a team QR code first.');
    navigateTo('scanQR');
    return;
  }

  // If we have a game loaded but QR is for different game
  if (authState.hasGame && authState.gameId !== gameId) {
    setError('This base belongs to a different game.');
    return;
  }

  // Check game status
  if (appState.gameData.status !== 'active') {
    setError('The game is not active yet. Please wait for the host to start the game.');
    navigateTo('gameView');
    return;
  }

  // Attempt to capture the base with GPS location
  await captureBaseWithLocation(baseId);
}

// Handle unassigned QR codes
async function handleUnassignedQR(qrCode) {
  const authState = getAuthState();

  if (authState.isHost) {
    console.log('Showing QR assignment options for:', qrCode);
    sessionStorage.setItem('pendingQRCode', qrCode);
    navigateTo('qrAssignment');
  } else {
    // Store pending QR code for first-time user flow
    appState.pendingQRCode = qrCode;
    navigateTo('firstTime');
  }
}

// Capture base with GPS location verification
async function captureBaseWithLocation(baseId) {
  if (!navigator.geolocation) {
    setError('Geolocation is not supported by this browser.');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    function(position) {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      captureBase(baseId, latitude, longitude);
    },
    function(error) {
      setError('Error getting location. Please enable GPS and try again: ' + error.message);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
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
        throw new Error('Failed to fetch game data from server');
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
          throw new Error('Failed to load game data: No network connection and no cached data');
        }
      } else {
        throw networkError;
      }
    }

    // Update game data
    appState.gameData.id = data.id;
    appState.gameData.name = data.name;
    appState.gameData.teams = data.teams;
    appState.gameData.bases = data.bases;
    appState.gameData.status = data.status;
    appState.gameData.hostId = data.hostId;
    appState.gameData.hostName = data.hostName;

    updateAuthState({ gameId: gameId });

    // Show offline notification if data came from cache
    if (fromCache) {
      showNotification('Using cached game data (offline mode)', 'warning');
    }

    // Re-render with new data
    renderApp();
  } catch (err) {
    setError(err.message);
    console.error('Error fetching game data:', err);
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

    // Update map markers without recreating the whole map
    updateMapMarkers();

    // Re-render with new data
    renderApp();
  } catch (err) {
    console.error('Error fetching game updates:', err);
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
      throw new Error('Host authentication required');
    }

    const response = await fetch(API_BASE_URL + '/games', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: gameSettings.name,
        host_id: authState.hostId,
        max_teams: gameSettings.maxTeams || 0, // Default to 0, teams will be added via QR
      })
    });

    const data = await handleApiResponse(response, 'Failed to create game');
    const gameId = data.game_id;
    console.log('Game created successfully, game ID:', gameId);

    // Update authentication state
    updateAuthState({ gameId: gameId });
    appState.gameData.id = gameId;

    // Fetch the full game data after creation
    await fetchGameData(gameId);

    // Show success message
    showNotification('Game created successfully! Game ID: ' + gameId + '\n\nYou can now scan QR codes to add teams and bases.','success');
    
    // Check if there's a pending QR code to handle
    const pendingQR = sessionStorage.getItem('pendingQRCode');
    if (pendingQR) {
      handleQRCode(pendingQR);
    }
  } catch (err) {
    setError(err.message);
    console.error('Error creating game:', err);
  } finally {
    setLoading(false);
  }
}

// Start game
async function startGame() {
  if (!appState.gameData.id) return;

  try {
    setLoading(true);
    
    const authState = getAuthState();
    if (!authState.isHost) {
      throw new Error('Host authentication required');
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
    showNotification('Game has been started!', 'success');
    navigateTo('gameView');
  } catch (err) {
    setError(err.message);
    console.error('Error starting game:', err);
  } finally {
    setLoading(false);
  }
}

// End game
async function endGame() {
  if (!appState.gameData.id) return;

  try {
    setLoading(true);
    
    const authState = getAuthState();
    if (!authState.isHost) {
      throw new Error('Host authentication required');
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
    navigateTo('results');
  } catch (err) {
    setError(err.message);
    console.error('Error ending game:', err);
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
    showNotification(`You have successfully joined ${teamName}!`, 'success');

    navigateTo('gameView');
  } catch (err) {
    setError(err.message);
    console.error('Error joining team:', err);
  } finally {
    setLoading(false);
  }
}

// Handle base capture with offline support
async function captureBase(baseId, latitude, longitude) {
  const authState = getAuthState();
  if (!authState.hasTeam) {
    setError('You must join a team first');
    return;
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

      showNotification('Base captured successfully!', 'success');
    } else {
      // We're offline, store for later sync
      if (window.dbHelpers && window.dbHelpers.addPendingCapture) {
        await window.dbHelpers.addPendingCapture(
          baseId,
          authState.playerId,
          latitude,
          longitude
        );

        showNotification('Base capture queued (offline mode). Will sync when online.', 'warning');
      } else {
        throw new Error('Offline capture not supported. Please try again when online.');
      }
    }
  } catch (err) {
    setError(err.message);
    console.error('Error capturing base:', err);
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
      throw new Error('Host authentication required');
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

    // Show success message
    showNotification(`Team "${name}" created successfully with QR code ${qrId}`,'success');

    // Refresh game data
    await fetchGameData(authState.gameId);

    // Navigate back to host panel
    navigateTo('hostPanel');
  } catch (err) {
    setError(err.message);
    console.error('Error creating team:', err);
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
      throw new Error('Host authentication required');
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

    // Show success message
    showNotification('Team updated successfully','success');

    // Refresh game data
    await fetchGameData(authState.gameId);
  } catch (err) {
    setError(err.message);
    console.error('Error updating team:', err);
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
      throw new Error('Host authentication required');
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

    // Show success message
    showNotification(`Base "${name}" created successfully with QR code ${qrId}`,'success');

    // Refresh game data
    await fetchGameData(authState.gameId);

    // Navigate back to host panel
    navigateTo('hostPanel');
  } catch (err) {
    setError(err.message);
    console.error('Error creating base:', err);
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
        throw new Error('Invalid admin password');
      } else {
        throw new Error(`Error authenticating: ${response.status}`);
      }
    }
    
    showNotification('Site admin authenticated successfully', 'success');
    
    // Clear any existing host data to force fresh load
    clearSiteAdminHosts();

    return true;
  } catch (err) {
    setError(err.message);
    console.error('Site admin authentication error:', err);
    return false;
  } finally {
    setLoading(false);
  }
}

// Site admin host management functions
async function fetchHosts() {
  if (!appState.siteAdmin.isAuthenticated || !appState.siteAdmin.token) {
    return [];
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
        throw new Error('Admin authentication expired. Please login again.');
      }
      throw new Error(`Failed to fetch hosts: ${response.status}`);
    }
    
    const hosts = await response.json();
    return hosts;
  } catch (err) {
    setError(err.message);
    console.error('Error fetching hosts:', err);
    return [];
  } finally {
    setLoading(false);
  }
}

async function createHost(hostData) {
  if (!appState.siteAdmin.isAuthenticated || !appState.siteAdmin.token) {
    throw new Error('Admin authentication required');
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
        throw new Error('Admin authentication expired. Please login again.');
      }
      throw new Error(`Failed to create host: ${response.status}`);
    }
    
    const result = await response.json();
    showNotification('Host created successfully', 'success');

    refreshSiteAdminHosts();

    return result;
  } catch (err) {
    setError(err.message);
    console.error('Error creating host:', err);
    throw err;
  } finally {
    setLoading(false);
  }
}

async function updateHost(hostId, hostData) {
  if (!appState.siteAdmin.isAuthenticated || !appState.siteAdmin.token) {
    throw new Error('Admin authentication required');
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
        throw new Error('Admin authentication expired. Please login again.');
      }
      throw new Error(`Failed to update host: ${response.status}`);
    }
    
    const result = await response.json();
    showNotification('Host updated successfully', 'success');
    refreshSiteAdminHosts();
    return result;
  } catch (err) {
    setError(err.message);
    console.error('Error updating host:', err);
    throw err;
  } finally {
    setLoading(false);
  }
}

async function deleteHost(hostId) {
  if (!appState.siteAdmin.isAuthenticated || !appState.siteAdmin.token) {
    throw new Error('Admin authentication required');
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
        throw new Error('Admin authentication expired. Please login again.');
      }
      throw new Error(`Failed to delete host: ${response.status}`);
    }
    
    showNotification('Host deleted successfully', 'success');
    refreshSiteAdminHosts();
    return true;
  } catch (err) {
    setError(err.message);
    console.error('Error deleting host:', err);
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
    renderApp(); // Update UI to show loading state
    
    const hosts = await fetchHosts();
    
    appState.siteAdmin.hosts = hosts;
    appState.siteAdmin.hostsLoaded = true;
    appState.siteAdmin.hostsError = null;
  } catch (error) {
    console.error('Error loading hosts:', error);
    appState.siteAdmin.hostsError = error.message;
    appState.siteAdmin.hosts = [];
  } finally {
    appState.siteAdmin.hostsLoading = false;
    renderApp(); // Final render with data or error
  }
}

function clearSiteAdminHosts() {
  appState.siteAdmin.hosts = [];
  appState.siteAdmin.hostsLoading = false;
  appState.siteAdmin.hostsLoaded = false;
  appState.siteAdmin.hostsError = null;
}

function refreshSiteAdminHosts() {
  // Force refresh by clearing loaded state
  appState.siteAdmin.hostsLoaded = false;
  loadSiteAdminHosts();
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
  clearAuthState();
  navigateTo('landing');
  
  // Display confirmation message to user
  setTimeout(function() {
    showNotification('You have successfully left the game. Scan a QR code or create a new game to play again.','success');
  }, 300);
}