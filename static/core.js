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
    isAdmin: false,
    adminPassword: '',
    status: 'setup'
  },
  loading: false,
  error: null,
  pendingQRCode: null
};

// API endpoint
const API_BASE_URL = '/api';

// DOM elements cache
const elements = {};

// Function to handle URL parameters and QR code navigation
function handleURLParameters() {
  // Parse URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const qrId = urlParams.get('id');

  if (!qrId) return; // No QR code in URL

  console.log('QR code detected in URL:', qrId);

  // First check if user has admin credentials
  const isAdmin = !!localStorage.getItem('adminPassword');

  // Check what this QR code corresponds to
  checkQRCodeAssignment(qrId, isAdmin);
}

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

    // Get admin password from localStorage if available
    const storedAdminPassword = localStorage.getItem('adminPassword');

    // Update game data
    appState.gameData.id = data.id;
    appState.gameData.name = data.name;
    appState.gameData.teams = data.teams;
    appState.gameData.bases = data.bases;
    appState.gameData.status = data.status;
    appState.gameData.adminPassword = appState.gameData.adminPassword || storedAdminPassword || '';
    appState.gameData.isAdmin = appState.gameData.isAdmin || !!storedAdminPassword;

    localStorage.setItem('gameId', gameId);

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

// Fetch scores
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

// Handle team selection
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

    // Save to state and localStorage
    appState.gameData.currentTeam = teamId;
    appState.gameData.currentPlayer = playerId;

    localStorage.setItem('teamId', teamId);
    localStorage.setItem('playerId', playerId);

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

// Handle team QR scan
async function handleTeamQRScan(teamId, scannedGameId) {
  console.log('Team QR scanned:', teamId, 'Game ID:', scannedGameId);

  // Get current game and team info
  const currentGameId = localStorage.getItem('gameId');
  const currentTeam = localStorage.getItem('teamId');

  // If user is already on a team
  if (currentTeam) {
    // Check if they're trying to scan their own team
    if (currentTeam === teamId) {
      setError('You are already a member of this team.');
    } else {
      setError('You are already on a different team. Please continue playing.');
    }

    navigateTo('gameView');
    return;
  }

  // If we have a game loaded but QR is for different game
  if (currentGameId && scannedGameId && currentGameId !== scannedGameId) {
    setError(`This team belongs to a different game. You are currently in game ${currentGameId}.`);
    return;
  }

  // If no game is loaded yet but QR code has a game ID
  if (!currentGameId && scannedGameId) {
    try {
      console.log('Loading game from team QR code, Game ID:', scannedGameId);

      // Load the game automatically
      localStorage.setItem('gameId', scannedGameId);
      await fetchGameData(scannedGameId);

    } catch (err) {
      setError('Failed to load game: ' + err.message);
      console.error('Error loading game from team QR:', err);
    }
  }
  // Store team ID and go to registration
  sessionStorage.setItem('pendingTeamId', teamId);
  navigateTo('playerRegistration');
}

// Handle base capture with offline support
async function captureBase(baseId, latitude, longitude) {
  if (!appState.gameData.currentTeam || !appState.gameData.currentPlayer) {
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
          player_id: appState.gameData.currentPlayer,
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
          appState.gameData.currentPlayer,
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

// Handle base QR scan
function handleBaseQRScan(baseId, qrCode, scannedGameId) {
  console.log('Base QR scanned:', baseId, 'QR code:', qrCode);

  // Check if user is on a team
  const currentGameId = localStorage.getItem('gameId');
  const currentTeam = localStorage.getItem('teamId');
  const playerId = localStorage.getItem('playerId');

  if (!currentTeam || !playerId) {
    setError('You need to join a team before capturing bases. Please scan a team QR code first.');
    navigateTo('scanQR');
    return;
  }

  // If we have a game loaded but QR is for different game
  if (currentGameId && scannedGameId && currentGameId !== scannedGameId) {
    setError(`This base belongs to a different game.`);
    return;
  }

  // Get game status
  const gameData = appState.gameData;
  if (gameData.status !== 'active') {
    setError('The game is not active yet. Please wait for the host to start the game.');
    navigateTo('gameView');
    return;
  }

  // Attempt to capture the base
  // Get GPS location
  if (navigator.geolocation) {
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
  } else {
    setError('Geolocation is not supported by this browser.');
  }
}

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
    // Not a valid URL, or other error, so proceed with the original string
    console.log('Scanned data is not a full URL or ID extraction failed, using raw data:', urlString);
  }
  return urlString; // Return original string if not a URL with 'id' or if parsing fails
}

// Enhanced QR code scanning
function handleQRScan(qrCode) {
  console.log('QR code scanned:', qrCode);

  // Try and extract id from full URL
  qrCode = extractIdFromUrl(qrCode);

  // If we're admin and in the QR assignment flow, skip the normal flow
  if (appState.page === 'qrAssignment' && appState.gameData.isAdmin) {
    // Just update the QR code field in the form
    const qrDisplay = document.getElementById('qr-display');
    if (qrDisplay) {
      qrDisplay.textContent = qrCode;
      sessionStorage.setItem('pendingQRCode', qrCode);
    }
    return;
  }

  // Check what this QR code corresponds to (regardless of whether we have a game loaded or not)
  checkQRCodeAssignment(qrCode, appState.gameData.isAdmin);
}

// Check QR code assignment and delegate to appropriate handler
async function checkQRCodeAssignment(qrId, isAdmin) {
  try {
    setLoading(true);

    // Check what the QR code is assigned to
    const statusResponse = await fetch(`${API_BASE_URL}/qr-codes/${qrId}/status`);

    // Check if response is OK before parsing JSON
    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      console.error('QR code status response error:', statusResponse.status, errorText);
      throw new Error(`Failed to check QR code status: ${statusResponse.status} ${statusResponse.statusText}`);
    }

    // Read the response body ONCE
    const responseText = await statusResponse.text();

    let statusData;
    try {
      statusData = JSON.parse(responseText);
    } catch (jsonError) {
      console.error('Error parsing QR code status response:', jsonError);
      console.log('Raw response text:', responseText);
      throw new Error('Invalid response format when checking QR code');
    }

    // Delegate to appropriate handler based on QR type
    if (statusData.status === 'team') {
      // QR code is a team
      handleTeamQRScan(statusData.team_id, statusData.game_id);
      return;
    } else if (statusData.status === 'base') {
      // QR code is a base
      handleBaseQRScan(statusData.base_id, qrId, statusData.game_id);
      return;
    }

    // If we're here, the QR code is unassigned
    if (isAdmin){
      console.log('Showing QR assignment options for:', qrId);

      // Store QR code in session for the assignment flow
      sessionStorage.setItem('pendingQRCode', qrId);

      // Navigate to QR assignment page
      navigateTo('qrAssignment');
      return
    } else{
      setError('This QR code is not yet assigned');
      return
    }


  } catch (err) {
    setError(err.message);
    console.error('Error checking QR code assignment:', err);

    // Store pending QR code if we have an error and no game is loaded
    if (!localStorage.getItem('gameId')) {
      appState.pendingQRCode = qrId;
      navigateTo('firstTime');
    }
  } finally {
    setLoading(false);
  }
}


// Create team with QR code
async function createTeam(qrId, name, color) {
  try {
    setLoading(true);

    const gameId = localStorage.getItem('gameId');
    const adminPassword = localStorage.getItem('adminPassword');

    if (!gameId || !adminPassword) {
      throw new Error('Admin credentials not found');
    }

    const response = await fetch(`${API_BASE_URL}/games/${gameId}/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        admin_password: adminPassword,
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
    await fetchGameData(gameId);

    // Navigate back to admin panel
    navigateTo('adminPanel');
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

    const gameId = localStorage.getItem('gameId');
    const adminPassword = localStorage.getItem('adminPassword');

    if (!gameId || !adminPassword) {
      throw new Error('Admin credentials not found');
    }

    const response = await fetch(`${API_BASE_URL}/teams/${teamId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        admin_password: adminPassword,
        name: name,
        color: color
      })
    });

    await handleApiResponse(response, 'Failed to update team');

    // Show success message
    showNotification(`Team updated successfully`,'success');

    // Refresh game data
    await fetchGameData(gameId);
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

    const gameId = localStorage.getItem('gameId');
    const adminPassword = localStorage.getItem('adminPassword');

    if (!gameId || !adminPassword) {
      throw new Error('Admin credentials not found');
    }

    // This endpoint already exists in the backend
    const response = await fetch(`${API_BASE_URL}/games/${gameId}/bases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        admin_password: adminPassword,
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
    await fetchGameData(gameId);

    // Navigate back to admin panel
    navigateTo('adminPanel');
  } catch (err) {
    setError(err.message);
    console.error('Error creating base:', err);
  } finally {
    setLoading(false);
  }
}

// Admin login
function handleAdminLogin(password) {
  appState.gameData.adminPassword = password;
  appState.gameData.isAdmin = true;  // In real app, would verify with backend

  // Store admin password
  localStorage.setItem('adminPassword', password);

  navigateTo('adminPanel');
}


// Create new game
async function createGame(gameSettings) {
  try {
    setLoading(true);
    console.log('Creating game with settings:', gameSettings);

    const response = await fetch(API_BASE_URL + '/games', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: gameSettings.name,
        admin_password: gameSettings.adminPassword,
        max_teams: gameSettings.maxTeams || 0, // Default to 0, teams will be added via QR
      })
    });

    const data = await handleApiResponse(response, 'Failed to create game');
    const gameId = data.game_id;
    console.log('Game created successfully, game ID:', gameId);

    // Save game ID and admin password to localStorage for persistence
    localStorage.setItem('gameId', gameId);
    localStorage.setItem('adminPassword', gameSettings.adminPassword);

    // Update the game data state with admin credentials
    appState.gameData.id = gameId;
    appState.gameData.adminPassword = gameSettings.adminPassword;
    appState.gameData.isAdmin = true;

    // Fetch the full game data after creation
    await fetchGameData(gameId);

    // Show success message with instructions about QR scanning
    showNotification('Game created successfully! Game ID: ' + gameId + '\n\nYou can now scan QR codes to add teams and bases.','success');

    // Check if there's a pending QR code to handle
    const pendingQR = sessionStorage.getItem('pendingQRCode');
    if (pendingQR) {
      // Process this QR code immediately
      handleQRScan(pendingQR);
    }
  } catch (err) {
    setError(err.message);
    console.error('Error creating game:', err);
  } finally {
    setLoading(false);
  }
}