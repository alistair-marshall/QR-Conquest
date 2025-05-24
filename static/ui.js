// DOM elements cache
const elements = {};

// Initialize app immediately when script is loaded
(function initializeApp() {
  console.log('app-core.js and app-ui.js loaded, initializing app immediately');

  // Cache main elements
  elements.root = document.getElementById('root');
  elements.errorContainer = document.getElementById('error-container');

  if (!elements.root) {
    console.error('Root element not found! Initialization failed.');
    return;
  }

  // Parse URL parameters for QR code
  const urlParams = new URLSearchParams(window.location.search);
  let qrIdToProcess = urlParams.get('id'); // Get QR ID from URL

  if (qrIdToProcess) {
    console.log('QR code ID found in URL:', qrIdToProcess);
    // Clean the URL immediately to remove the 'id' parameter
    try {
      const baseUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.replaceState({ path: baseUrl }, "", baseUrl);
      console.log('URL cleaned. Proceeding with QR ID:', qrIdToProcess);
    } catch (e) {
      // Fallback or warning if history.replaceState is not supported or fails
      console.warn('Could not clean URL using history.replaceState:', e);
    }
  }

  // Initialize authentication state from localStorage
  const authState = getAuthState();
  if (authState.isHost) {
    appState.gameData.hostId = authState.hostId;
    appState.gameData.hostName = authState.hostName;
    console.log('Found host ID in localStorage:', authState.hostId);
  }

  // Load game data if we have a game ID, then process QR code
  if (authState.hasGame) {
    console.log('Found game ID in localStorage:', authState.gameId);
    fetchGameData(authState.gameId)
      .then(() => {
        // After game data is loaded, check if we had a QR ID from the URL
        if (qrIdToProcess) {
          console.log('Processing stored QR ID after game data load:', qrIdToProcess);
          handleQRCode(qrIdToProcess);
          qrIdToProcess = null;
        }
      })
      .catch(err => {
        console.error('Error loading game data:', err);
        // Even if game data fails to load, try to handle QR code if it was from URL
        if (qrIdToProcess) {
          console.log('Processing stored QR ID after game data load error:', qrIdToProcess);
          handleQRCode(qrIdToProcess);
          qrIdToProcess = null;
        }
      });
  } else if (qrIdToProcess) {
    // No game in localStorage, but we have a QR code from the URL
    console.log('No game loaded, processing stored QR ID:', qrIdToProcess);
    handleQRCode(qrIdToProcess);
    qrIdToProcess = null;
  } else {
    // No game, no QR code from URL, just render landing page normally
    renderApp();
  }

  // Set team/player info from localStorage if available
  if (authState.hasTeam) {
    appState.gameData.currentTeam = authState.teamId;
    appState.gameData.currentPlayer = authState.playerId;
    console.log('Found team ID in localStorage:', authState.teamId);
  }

  // Initialize Lucide icons if available
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
    console.log('Lucide icons initialized in initializeApp');
  } else {
    console.warn('Lucide icons library not available in initializeApp');
  }
})();

// =============================================================================
// NAVIGATION AND STATE MANAGEMENT
// =============================================================================

// Navigation function
function navigateTo(page) {
  console.log('Navigating to:', page);
  appState.page = page;

  // Stop polling if leaving game view
  if (page !== 'gameView') {
    stopScorePolling();
  }

  // Start polling if entering game view
  if (page === 'gameView') {
    startScorePolling();
  }

  if (page === 'siteAdminPanel' && appState.siteAdmin.isAuthenticated) {
    // Trigger host data loading if not already loaded/loading
    if (!appState.siteAdmin.hostsLoaded && !appState.siteAdmin.hostsLoading) {
      loadSiteAdminHosts();
    }
  }

  // Clear host data when leaving site admin
  if (appState.page !== 'siteAdminPanel' && appState.page !== 'siteAdminLogin') {
    clearSiteAdminHosts();
  }

  renderApp();
}

// Clear error
function clearError() {
  appState.error = null;
  renderApp();
}

// =============================================================================
// MAP FUNCTIONALITY
// =============================================================================

let gameMapInstance = null; // Keep track of the Leaflet map instance

// Helper function to map Tailwind colors to hex for Leaflet
function getHexColorForTailwind(tailwindColorClass) {
  const colorMap = {
    'bg-red-500': '#ef4444',
    'bg-blue-500': '#3b82f6',
    'bg-green-500': '#22c55e',
    'bg-yellow-500': '#eab308',
    'bg-purple-500': '#a855f7',
    'bg-pink-500': '#ec4899',
    'bg-indigo-500': '#6366f1',
    'bg-teal-500': '#14b8a6',
    'bg-gray-400': '#9ca3af', // A slightly different gray for uncaptured
    'bg-gray-500': '#6b7280'  // Default if color not in map
  };
  return colorMap[tailwindColorClass] || colorMap['bg-gray-500'];
}

function initGameMap() {
  const mapElement = document.getElementById('game-map-container');
  if (!mapElement) {
    console.error('Map container (game-map-container) not found.');
    return;
  }

  // If a map instance already exists, remove it to prevent Leaflet errors on re-render.
  if (gameMapInstance) {
    gameMapInstance.remove();
    gameMapInstance = null;
  }

  // Check if there are bases to display
  if (!appState.gameData.bases || appState.gameData.bases.length === 0) {
    mapElement.innerHTML = `<div class="flex items-center justify-center h-full text-gray-600">No bases to display on the map.</div>`;
    return;
  }

  // Initialize the map
  gameMapInstance = L.map(mapElement);

  // Add OpenStreetMap tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(gameMapInstance);

  const latLngs = [];
  const markers = [];

  appState.gameData.bases.forEach(base => {
    if (typeof base.lat !== 'number' || typeof base.lng !== 'number') {
      console.warn('Base has invalid coordinates:', base.name, base.lat, base.lng);
      return; // Skip this base
    }
    const latLng = [base.lat, base.lng];
    latLngs.push(latLng);

    let markerColor = getHexColorForTailwind('bg-gray-400'); // Default for uncaptured
    let popupContent = `<strong>${base.name}</strong><br>Uncaptured`;

    if (base.ownedBy) {
      const owningTeam = appState.gameData.teams.find(t => t.id === base.ownedBy);
      if (owningTeam) {
        markerColor = getHexColorForTailwind(owningTeam.color);
        popupContent = `<strong>${base.name}</strong><br>Owner: ${owningTeam.name}`;
      } else {
        popupContent = `<strong>${base.name}</strong><br>Owner: Unknown Team`;
      }
    }

    const circleMarker = L.circleMarker(latLng, {
      radius: 15, // Same size as capture zone
      fillColor: markerColor,
      color: '#000000', // Border color for the circle
      weight: 1,
      opacity: 1,
      fillOpacity: 0.75
    }).addTo(gameMapInstance);

    circleMarker.bindPopup(popupContent);
    circleMarker.baseId = base.id;
    markers.push(circleMarker);
  });

  gameMapInstance.baseMarkers = markers;

  // Zoom and center the map to fit all base markers
  if (latLngs.length > 0) {
    const bounds = L.latLngBounds(latLngs);
    gameMapInstance.fitBounds(bounds.pad(0.2)); // .pad(0.2) adds 20% padding around bounds
  } else {
    // Fallback if no valid bases were processed (e.g. all had bad coords)
    // Centering on Edinburgh, UK as a generic fallback.
    gameMapInstance.setView([55.94763, -3.16202], 16);
    mapElement.innerHTML = `<div class="flex items-center justify-center h-full text-gray-600">No valid bases to display on the map.</div>`;
  }
}

function updateMapMarkers() {
  // If no map instance or no bases, return
  if (!gameMapInstance || !appState.gameData.bases || appState.gameData.bases.length === 0) {
    return;
  }

  // Get all markers (we'll store them in a new property of gameMapInstance)
  if (!gameMapInstance.baseMarkers) {
    console.warn('No markers to update. Reinitialize map.');
    initGameMap()
    return;
  }

  // Update each marker based on current base ownership
  appState.gameData.bases.forEach(base => {
    const marker = gameMapInstance.baseMarkers.find(m => m.baseId === base.id);
    if (!marker) return;

    let markerColor = getHexColorForTailwind('bg-gray-400'); // Default for uncaptured
    let popupContent = `<strong>${base.name}</strong><br>Uncaptured`;

    if (base.ownedBy) {
      const owningTeam = appState.gameData.teams.find(t => t.id === base.ownedBy);
      if (owningTeam) {
        markerColor = getHexColorForTailwind(owningTeam.color);
        popupContent = `<strong>${base.name}</strong><br>Owner: ${owningTeam.name}`;
      } else {
        popupContent = `<strong>${base.name}</strong><br>Owner: Unknown Team`;
      }
    }

    // Update marker color
    marker.setStyle({
      fillColor: markerColor
    });

    // Update popup content
    marker.getPopup().setContent(popupContent);
  });
}

// =============================================================================
// MAIN RENDER FUNCTION
// =============================================================================

// Main render function
function renderApp() {
  console.log('Rendering app, current page:', appState.page);

  // Render loop protection
  if (window.renderingInProgress) {
      console.warn('Render already in progress, preventing loop');
      return;
  }
  window.renderingInProgress = true;

  try{
    // Clear the root element
    elements.root.innerHTML = '';

    // Add header
    const header = document.createElement('header');
    header.className = 'bg-blue-600 text-white p-4 shadow-md relative';

    // Create a container for the header content
    const headerContent = document.createElement('div');
    headerContent.className = 'flex justify-between items-start';

    // Left side: Title and status
    const leftSection = document.createElement('div');
    leftSection.className = 'flex-1';

    const title = document.createElement('h1');
    title.className = 'text-2xl font-bold';
    title.textContent = appState.gameData.name || 'QR Conquest';
    leftSection.appendChild(title);

    if (appState.gameData.status === 'active') {
      const statusDiv = document.createElement('div');
      statusDiv.className = 'flex justify-between items-center mt-1';

      const statusText = document.createElement('p');
      statusText.className = 'text-sm';
      statusText.textContent = 'Game in progress';
      statusDiv.appendChild(statusText);

      if (appState.gameData.currentTeam) {
        const teamText = document.createElement('p');
        teamText.className = 'text-sm';
        teamText.textContent = 'Team: ' + getTeamName(appState.gameData.currentTeam);
        statusDiv.appendChild(teamText);
      }

      leftSection.appendChild(statusDiv);
    }

    headerContent.appendChild(leftSection);

    // Right side: Admin button
    const rightSection = document.createElement('div');
    rightSection.className = 'flex items-center';

    // Show different buttons based on context
    if (appState.page.startsWith('siteAdmin')) {
      // If we're in site admin pages, show a label
      const adminBadge = document.createElement('div');
      adminBadge.className = 'bg-purple-800 text-white py-1 px-3 rounded-lg text-sm';
      adminBadge.textContent = 'Site Admin';
      rightSection.appendChild(adminBadge);
    } else {
      // Regular host button
      const hostButton = document.createElement('button');
      hostButton.className = 'bg-white bg-opacity-20 hover:bg-opacity-30 text-white py-2 px-4 rounded-lg transition-all duration-200 flex items-center';

      const hostIcon = document.createElement('i');
      hostIcon.setAttribute('data-lucide', 'shield');
      hostIcon.className = 'mr-2';
      hostButton.appendChild(hostIcon);

      const hostText = document.createElement('span');
      hostText.textContent = 'Host Menu';
      hostButton.appendChild(hostText);

      hostButton.addEventListener('click', handleHostButtonClick);
      rightSection.appendChild(hostButton);
    }
    headerContent.appendChild(rightSection);
    header.appendChild(headerContent);

    elements.root.appendChild(header);

    // Main content container
    const main = document.createElement('main');
    main.className = 'p-4';

    // Show loading screen if loading
    if (appState.loading) {
      main.appendChild(renderLoadingScreen());
    }
    // Show error screen if error
    else if (appState.error) {
      main.appendChild(renderErrorScreen());
    }
    // Render the current page
    else {
      switch (appState.page) {
        case 'landing':
          main.appendChild(renderLandingPage());
          break;
        case 'gameView':
          main.appendChild(renderGameView());
          break;
        case 'hostPanel':
          main.appendChild(renderHostPanel());
          break;
        case 'scanQR':
          main.appendChild(renderQRScanner());
          break;
        case 'results':
          main.appendChild(renderResultsPage());
          break;
        case 'qrAssignment':
          main.appendChild(renderQRAssignmentPage());
          break;
        case 'playerRegistration':
          main.appendChild(renderPlayerRegistrationPage());
          break;
        case 'firstTime':
          main.appendChild(renderFirstTimePage());
          break;
        case 'joinGame':
          main.appendChild(renderJoinGamePage());
          break;
        case 'siteAdminLogin':
          main.appendChild(renderSiteAdminLogin());
          break;
        case 'siteAdminPanel':
          main.appendChild(renderSiteAdminPanel());
          break;
        default:
          main.appendChild(renderLandingPage());
      }
    }

    elements.root.appendChild(main);

    // Add footer
    const footer = document.createElement('footer');
    footer.className = 'bg-gray-200 p-4 text-center text-sm text-gray-600';
    
    const footerContent = document.createElement('div');
    footerContent.className = 'flex justify-between items-center';

    const copyright = document.createElement('div');
    copyright.textContent = 'QR Conquest © 2025';
    footerContent.appendChild(copyright);

    const adminLink = document.createElement('a');
    adminLink.className = 'text-gray-500 hover:text-gray-700 text-xs';
    adminLink.textContent = 'Site Administration';
    adminLink.href = '#';
    adminLink.addEventListener('click', function(e) {
      e.preventDefault();
      navigateTo('siteAdminLogin');
    });
    footerContent.appendChild(adminLink);

    footer.appendChild(footerContent);
    elements.root.appendChild(footer);

    // Initialize Lucide icons if available
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  } finally {
    // Always clear the render lock
    window.renderingInProgress = false;
  }
}

// =============================================================================
// PAGE RENDERING COMPONENTS
// =============================================================================

// Loading Screen
function renderLoadingScreen() {
  const container = document.createElement('div');
  container.className = 'flex flex-col items-center justify-center h-64';

  const spinner = document.createElement('div');
  spinner.className = 'animate-spin h-12 w-12 border-4 border-blue-600 rounded-full border-t-transparent mb-4';
  container.appendChild(spinner);

  const text = document.createElement('p');
  text.textContent = 'Loading...';
  container.appendChild(text);

  return container;
}

// Error Screen
function renderErrorScreen() {
  const container = document.createElement('div');
  container.className = 'bg-red-100 border border-red-400 rounded p-4 text-center';

  const title = document.createElement('h2');
  title.className = 'text-xl font-bold text-red-800 mb-2';
  title.textContent = 'Error';
  container.appendChild(title);

  const message = document.createElement('p');
  message.className = 'text-red-700 mb-4';
  message.textContent = appState.error;
  container.appendChild(message);

  const button = document.createElement('button');
  button.className = 'bg-blue-600 text-white py-2 px-4 rounded-lg';
  button.textContent = 'Dismiss';
  button.addEventListener('click', clearError);
  container.appendChild(button);

  return container;
}

// Landing Page
function renderLandingPage() {
  const container = document.createElement('div');
  container.className = 'text-center py-10';

  // Icons
  const iconContainer = document.createElement('div');
  iconContainer.className = 'flex justify-center mb-8';

  const mapIcon = document.createElement('i');
  mapIcon.setAttribute('data-lucide', 'map');
  mapIcon.className = 'w-16 h-16 text-blue-600';
  iconContainer.appendChild(mapIcon);

  const flagIcon = document.createElement('i');
  flagIcon.setAttribute('data-lucide', 'flag');
  flagIcon.className = 'w-16 h-16 ml-4 text-green-600';
  iconContainer.appendChild(flagIcon);

  container.appendChild(iconContainer);

  // Title and description
  const title = document.createElement('h2');
  title.className = 'text-3xl font-bold mb-4';
  title.textContent = 'Welcome to QR Conquest!';
  container.appendChild(title);

  const description = document.createElement('p');
  description.className = 'mb-8';
  description.textContent = 'Scan QR codes, capture bases, and score points for your team.';
  container.appendChild(description);

  // Button container
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'flex flex-col space-y-4 max-w-xs mx-auto';

  // Show different buttons based on user state
  const authState = getAuthState();

  if (authState.hasGame) {
    // Add instruction text
    const instructionText = document.createElement('p');
    instructionText.className = 'mb-6 text-sm text-gray-600';
    instructionText.textContent = 'To join a team, you must scan its QR code. Ask the game host for team QR codes.';
    container.appendChild(instructionText);
    
    // Join Game button
    const joinButton = document.createElement('button');
    joinButton.className = 'bg-blue-600 text-white py-3 px-6 rounded-lg shadow-md hover:bg-blue-700';
    joinButton.textContent = 'Scan Team QR Code';
    joinButton.addEventListener('click', function() { navigateTo('scanQR'); });
    buttonContainer.appendChild(joinButton);

    // Continue Game button (if in a team)
    if (authState.hasTeam) {
      const continueButton = document.createElement('button');
      continueButton.className = 'bg-green-600 text-white py-3 px-6 rounded-lg shadow-md hover:bg-green-700';
      continueButton.textContent = 'Continue Game';
      continueButton.addEventListener('click', function() { navigateTo('gameView'); });
      buttonContainer.appendChild(continueButton);
    }

    // Host Panel button (if host)
    if (authState.isHost) {
      const hostButton = document.createElement('button');
      hostButton.className = 'bg-purple-600 text-white py-3 px-6 rounded-lg shadow-md hover:bg-purple-700';
      hostButton.textContent = 'Game Management';
      hostButton.addEventListener('click', function() { navigateTo('hostPanel'); });
      buttonContainer.appendChild(hostButton);
    }

    // Leave Game button
    const leaveButton = document.createElement('button');
    leaveButton.className = 'bg-gray-600 text-white py-2 px-6 rounded-lg shadow-md hover:bg-gray-700';
    leaveButton.textContent = 'Leave Game';
    leaveButton.addEventListener('click', clearGameData);
    buttonContainer.appendChild(leaveButton);
  } else if (authState.isHost) {
    // Host is authenticated but no game loaded
    const hostWelcome = document.createElement('p');
    hostWelcome.className = 'mb-6 text-purple-700';
    hostWelcome.textContent = `Welcome, ${authState.hostName || 'Host'}!`;
    container.appendChild(hostWelcome);
    
    // Host Game button
    const hostButton = document.createElement('button');
    hostButton.className = 'bg-purple-600 text-white py-3 px-6 rounded-lg shadow-md hover:bg-purple-700';
    hostButton.textContent = 'Host a Game';
    hostButton.addEventListener('click', function() { navigateTo('hostPanel'); });
    buttonContainer.appendChild(hostButton);
    
    // Scan QR Code button
    const scanButton = document.createElement('button');
    scanButton.className = 'bg-blue-600 text-white py-3 px-6 rounded-lg shadow-md hover:bg-blue-700';
    scanButton.textContent = 'Scan QR Code';
    scanButton.addEventListener('click', function() { navigateTo('scanQR'); });
    buttonContainer.appendChild(scanButton);
    
    // Logout button
    const logoutButton = document.createElement('button');
    logoutButton.className = 'bg-gray-600 text-white py-2 px-6 rounded-lg shadow-md hover:bg-gray-700';
    logoutButton.textContent = 'Logout';
    logoutButton.addEventListener('click', clearGameData);
    buttonContainer.appendChild(logoutButton);
  } else {
    // Not authenticated, not in a game
    // Scan QR Code button
    const scanButton = document.createElement('button');
    scanButton.className = 'bg-blue-600 text-white py-3 px-6 rounded-lg shadow-md hover:bg-blue-700';
    scanButton.textContent = 'Scan QR Code';
    scanButton.addEventListener('click', function() { navigateTo('scanQR'); });
    buttonContainer.appendChild(scanButton);
    
    // Host Login help text
    const hostLoginLink = document.createElement('p');
    hostLoginLink.className = 'text-sm text-gray-600 mt-2 text-center';
    hostLoginLink.innerHTML = 'Are you a game host?<br><span class="text-purple-600">Scan your host QR code above</span>';
    buttonContainer.appendChild(hostLoginLink);
  }

  container.appendChild(buttonContainer);

  return container;
}

// Game View
function renderGameView() {
  const container = document.createElement('div');

  // Scoreboard section
  const scoreboardSection = document.createElement('div');
  scoreboardSection.className = 'mb-6';

  const scoreboardTitle = document.createElement('h2');
  scoreboardTitle.className = 'text-2xl font-bold mb-2';
  scoreboardTitle.textContent = 'Scoreboard';
  scoreboardSection.appendChild(scoreboardTitle);

  const scoreboardContainer = document.createElement('div');
  scoreboardContainer.className = 'bg-white rounded-lg shadow-md p-4';

  if (appState.gameData.teams && appState.gameData.teams.length > 0) {
    const sortedTeams = [].concat(appState.gameData.teams).sort(function (a, b) {
      return (b.score || 0) - (a.score || 0);
    });

    sortedTeams.forEach(function (team) {
      const teamRow = document.createElement('div');
      teamRow.className = 'flex justify-between py-2 border-b last:border-b-0';
      const teamNameContainer = document.createElement('div');
      teamNameContainer.className = 'flex items-center';
      const teamColorDiv = document.createElement('div');
      teamColorDiv.className = 'w-4 h-4 rounded-full ' + team.color + ' mr-2';
      teamNameContainer.appendChild(teamColorDiv);
      const teamNameSpan = document.createElement('span');
      teamNameSpan.className = 'font-medium';
      teamNameSpan.textContent = team.name;
      teamNameContainer.appendChild(teamNameSpan);
      teamRow.appendChild(teamNameContainer);
      const teamScoreSpan = document.createElement('span');
      teamScoreSpan.className = 'font-bold';
      teamScoreSpan.textContent = (team.score || 0) + ' pts';
      teamRow.appendChild(teamScoreSpan);
      scoreboardContainer.appendChild(teamRow);
    });
  } else {
    const noTeams = document.createElement('p');
    noTeams.className = 'text-center text-gray-600';
    noTeams.textContent = 'No teams available';
    scoreboardContainer.appendChild(noTeams);
  }
  scoreboardSection.appendChild(scoreboardContainer);
  container.appendChild(scoreboardSection);

  // Map section
  const mapSection = document.createElement('div');
  mapSection.className = 'mb-6';

  const mapTitle = document.createElement('h2');
  mapTitle.className = 'text-2xl font-bold mb-2';
  mapTitle.textContent = 'Map';
  mapSection.appendChild(mapTitle);

  const mapContainerElement = document.createElement('div');
  mapContainerElement.id = 'game-map-container';
  mapContainerElement.className = 'bg-gray-200 rounded-lg shadow-md h-80 md:h-96 relative';
  mapSection.appendChild(mapContainerElement);
  container.appendChild(mapSection);

  // Action buttons
  const actionsContainer = document.createElement('div');
  actionsContainer.className = 'flex gap-4';

  const scanButton = document.createElement('button');
  scanButton.className = 'flex-1 bg-green-600 text-white py-3 px-6 rounded-lg shadow-md hover:bg-green-700 flex items-center justify-center';
  scanButton.addEventListener('click', function () { navigateTo('scanQR'); });

  const scanIcon = document.createElement('i');
  scanIcon.setAttribute('data-lucide', 'qr-code');
  scanIcon.className = 'mr-2';
  scanButton.appendChild(scanIcon);

  const scanText = document.createElement('span');
  scanText.textContent = 'Scan QR Code';
  scanButton.appendChild(scanText);

  actionsContainer.appendChild(scanButton);
  container.appendChild(actionsContainer);

  // Initialize the Leaflet map
  setTimeout(() => initGameMap(), 0);

  return container;
}

// First Time Page
function renderFirstTimePage() {
  const container = document.createElement('div');
  container.className = 'text-center py-10';

  // Title
  const title = document.createElement('h2');
  title.className = 'text-3xl font-bold mb-4';
  title.textContent = 'Welcome to QR Conquest!';
  container.appendChild(title);

  // Description
  const description = document.createElement('p');
  description.className = 'mb-8';
  description.textContent = 'You\'ve scanned a QR code, but you\'re not currently part of any game.';
  container.appendChild(description);

  // QR code info
  const qrInfo = document.createElement('div');
  qrInfo.className = 'bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-6 inline-block';
  qrInfo.textContent = `QR Code: ${appState.pendingQRCode}`;
  container.appendChild(qrInfo);

  // Options
  const optionsContainer = document.createElement('div');
  optionsContainer.className = 'flex flex-col space-y-4 max-w-xs mx-auto';

  // Join existing game
  const joinButton = document.createElement('button');
  joinButton.className = 'bg-blue-600 text-white py-3 px-6 rounded-lg shadow-md hover:bg-blue-700';
  joinButton.textContent = 'Join a Game';
  joinButton.addEventListener('click', function () {
    // Store QR code in session storage for later use
    sessionStorage.setItem('pendingQRCode', appState.pendingQRCode);
    navigateTo('joinGame');
  });
  optionsContainer.appendChild(joinButton);

  // Create new game (admin)
  const createButton = document.createElement('button');
  createButton.className = 'bg-green-600 text-white py-3 px-6 rounded-lg shadow-md hover:bg-green-700';
  createButton.textContent = 'Create a New Game';
  createButton.addEventListener('click', function () {
    // Store QR code in session storage for later use
    sessionStorage.setItem('pendingQRCode', appState.pendingQRCode);
    navigateTo('hostPanel');
  });
  optionsContainer.appendChild(createButton);

  // Information about QR code approach
  const infoBox = document.createElement('div');
  infoBox.className = 'mt-6 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded-lg text-left text-sm max-w-xs mx-auto';
  infoBox.innerHTML = '<p><strong>Note:</strong> In QR Conquest, all teams and bases are created by scanning QR codes first. This QR code can be used later to create a team or base after you join or create a game.</p>';

  container.appendChild(optionsContainer);
  container.appendChild(infoBox);

  return container;
}

// Join Game Page
function renderJoinGamePage() {
  const container = document.createElement('div');
  container.className = 'max-w-md mx-auto py-8';

  // Title
  const title = document.createElement('h2');
  title.className = 'text-2xl font-bold mb-6 text-center';
  title.textContent = 'Join a Game';
  container.appendChild(title);

  // Form
  const form = document.createElement('form');
  form.className = 'bg-white rounded-lg shadow-md p-6 mb-6';

  // Game ID
  const idGroup = document.createElement('div');
  idGroup.className = 'mb-4';

  const idLabel = document.createElement('label');
  idLabel.className = 'block text-gray-700 text-sm font-bold mb-2';
  idLabel.htmlFor = 'game-id';
  idLabel.textContent = 'Game ID';
  idGroup.appendChild(idLabel);

  const idInput = document.createElement('input');
  idInput.id = 'game-id';
  idInput.type = 'text';
  idInput.className = 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline';
  idInput.required = true;
  idGroup.appendChild(idInput);

  form.appendChild(idGroup);

  // Join button
  const joinButton = document.createElement('button');
  joinButton.type = 'submit';
  joinButton.className = 'w-full bg-blue-600 text-white py-2 px-4 rounded-lg';
  joinButton.textContent = 'Join Game';
  form.appendChild(joinButton);

  // Handle form submission
  form.addEventListener('submit', function(e) {
    e.preventDefault();

    const gameId = idInput.value.trim();
    if (!gameId) {
      showNotification('Please enter a valid Game ID','warning');
      return;
    }

    // Load the game and store in localStorage
    localStorage.setItem('gameId', gameId);
    fetchGameData(gameId).then(() => {
      // Process the pending QR code after loading game data
      const pendingQR = sessionStorage.getItem('pendingQRCode');
      if (pendingQR) {
        handleQRScan(pendingQR);
        sessionStorage.removeItem('pendingQRCode');
      } else {
        navigateTo('scanQR');
      }
    });
  });

  container.appendChild(form);

  // Back button
  const backButton = document.createElement('button');
  backButton.className = 'text-blue-600 hover:underline';
  backButton.textContent = '← Back to Home';
  backButton.addEventListener('click', function() {
    navigateTo('landing');
  });
  container.appendChild(backButton);

  return container;
}

// QR Scanner - Consolidated and simplified
function renderQRScanner() {
  const container = document.createElement('div');
  container.className = 'text-center';

  // Different title based on context
  const title = document.createElement('h2');
  title.className = 'text-2xl font-bold mb-6';

  if (appState.page === 'qrAssignment') {
    title.textContent = 'Scan QR Code to Assign';
  } else {
    title.textContent = 'Scan QR Code';
  }

  container.appendChild(title);

  // Add instructions for host mode
  const authState = getAuthState();
  if (authState.isHost) {
    const instructionBox = document.createElement('div');
    instructionBox.className = 'bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-4';

    const instructionTitle = document.createElement('p');
    instructionTitle.className = 'font-bold';
    instructionTitle.textContent = 'Host Instructions:';
    instructionBox.appendChild(instructionTitle);

    const instructionText = document.createElement('p');
    instructionText.textContent = 'Scan a QR code to create a new team or base. All team and base creation must start by scanning a QR code first.';
    instructionBox.appendChild(instructionText);

    container.appendChild(instructionBox);
  }

  // Main QR scanner UI
  const scannerContainer = document.createElement('div');
  scannerContainer.className = 'bg-white rounded-lg shadow-md p-4 mb-6';

  // Camera feed container
  const cameraContainer = document.createElement('div');
  cameraContainer.className = 'relative bg-gray-900 rounded-lg overflow-hidden mb-4';
  cameraContainer.style.height = '350px';
  cameraContainer.style.maxWidth = '100%';
  cameraContainer.style.margin = '0 auto';

  // Video element for the camera feed
  const videoElement = document.createElement('video');
  videoElement.id = 'qr-video';
  videoElement.className = 'w-full h-full object-cover';
  videoElement.setAttribute('playsinline', 'true');
  videoElement.setAttribute('autoplay', 'true');
  videoElement.setAttribute('muted', 'true');
  cameraContainer.appendChild(videoElement);

  // Canvas for video processing (hidden)
  const canvasElement = document.createElement('canvas');
  canvasElement.id = 'qr-canvas';
  canvasElement.style.display = 'none';
  cameraContainer.appendChild(canvasElement);

  // Scanner overlay/viewfinder
  const scannerOverlay = document.createElement('div');
  scannerOverlay.className = 'absolute inset-0 flex items-center justify-center';

  const viewfinder = document.createElement('div');
  viewfinder.className = 'border-2 border-blue-500 rounded-lg w-64 h-64 opacity-60';
  scannerOverlay.appendChild(viewfinder);

  cameraContainer.appendChild(scannerOverlay);

  // Loading indicator
  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white';
  loadingIndicator.id = 'camera-loading';

  const loadingSpinner = document.createElement('div');
  loadingSpinner.className = 'animate-spin h-10 w-10 border-4 border-blue-500 rounded-full border-t-transparent mb-2';
  loadingIndicator.appendChild(loadingSpinner);

  const loadingText = document.createElement('p');
  loadingText.className = 'text-sm';
  loadingText.textContent = 'Accessing camera...';
  loadingIndicator.appendChild(loadingText);

  cameraContainer.appendChild(loadingIndicator);

  // Camera selection dropdown
  const cameraSelectContainer = document.createElement('div');
  cameraSelectContainer.className = 'mb-4';

  const cameraSelectLabel = document.createElement('label');
  cameraSelectLabel.htmlFor = 'camera-select';
  cameraSelectLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
  cameraSelectLabel.textContent = 'Select camera:';
  cameraSelectContainer.appendChild(cameraSelectLabel);

  const cameraSelect = document.createElement('select');
  cameraSelect.id = 'camera-select';
  cameraSelect.className = 'w-full px-3 py-2 border rounded-lg text-sm';
  cameraSelectContainer.appendChild(cameraSelect);

  // Status message
  const statusMessage = document.createElement('p');
  statusMessage.id = 'qr-status';
  statusMessage.className = 'text-sm mb-2 h-6 text-gray-600';
  statusMessage.textContent = 'Position QR code within the frame';

  scannerContainer.appendChild(cameraContainer);
  scannerContainer.appendChild(cameraSelectContainer);
  scannerContainer.appendChild(statusMessage);

  // Fallback manual input
  const manualInputContainer = document.createElement('div');
  manualInputContainer.className = 'mt-4 pt-4 border-t border-gray-200';

  const manualInputTitle = document.createElement('p');
  manualInputTitle.className = 'text-sm font-medium text-gray-700 mb-2';
  manualInputTitle.textContent = 'Or enter QR code manually:';
  manualInputContainer.appendChild(manualInputTitle);

  const inputContainer = document.createElement('div');
  inputContainer.className = 'flex space-x-2';

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'manual-qr-input';
  input.className = 'flex-1 px-3 py-2 border rounded-lg text-sm';
  input.placeholder = 'Enter QR code value';
  inputContainer.appendChild(input);

  const submitButton = document.createElement('button');
  submitButton.className = 'bg-blue-600 text-white py-2 px-4 rounded-lg text-sm';
  submitButton.textContent = 'Submit';
  submitButton.addEventListener('click', function () {
    const qrCode = input.value.trim();
    if (!qrCode) {
      setStatusMessage('Please enter a QR code value', 'error');
      return;
    }
    
    // Determine context based on current page
    const context = appState.page === 'qrAssignment' ? 'assignment' : 'scan';
    handleQRCode(qrCode, context);
  });
  inputContainer.appendChild(submitButton);

  manualInputContainer.appendChild(inputContainer);
  scannerContainer.appendChild(manualInputContainer);
  container.appendChild(scannerContainer);

  // Action buttons
  const actionsContainer = document.createElement('div');
  actionsContainer.className = 'flex gap-4';

  const cancelButton = document.createElement('button');
  cancelButton.className = 'flex-1 bg-gray-600 text-white py-3 px-6 rounded-lg shadow-md hover:bg-gray-700';
  cancelButton.textContent = 'Cancel';
  cancelButton.addEventListener('click', function () {
    // Stop camera before navigating away
    stopCamera();

    // Different return destinations based on context
    if (appState.page === 'qrAssignment') {
      navigateTo('hostPanel');
    } else if (authState.isHost) {
      navigateTo('hostPanel');
    } else {
      navigateTo('gameView');
    }
  });
  actionsContainer.appendChild(cancelButton);

  container.appendChild(actionsContainer);

  // Setup function to be called after rendering
  setTimeout(initQRScanner, 100);

  // Helper function to set status message with optional styling
  function setStatusMessage(message, type = 'info') {
    const statusElem = document.getElementById('qr-status');
    if (!statusElem) return;

    statusElem.textContent = message;

    // Reset classes
    statusElem.className = 'text-sm mb-2 h-6';

    // Apply appropriate styling
    if (type === 'error') {
      statusElem.className += ' text-red-600';
    } else if (type === 'success') {
      statusElem.className += ' text-green-600';
    } else {
      statusElem.className += ' text-gray-600';
    }
  }

  let videoStream = null;
  let activeDeviceId = null;
  let scanning = false;

  // Initialize the QR scanner
  async function initQRScanner() {
    try {
      // Get list of video devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');

      // Populate camera selection dropdown
      const cameraSelect = document.getElementById('camera-select');
      if (cameraSelect) {
        cameraSelect.innerHTML = '';

        videoDevices.forEach(device => {
          const option = document.createElement('option');
          option.value = device.deviceId;
          option.text = device.label || `Camera ${cameraSelect.options.length + 1}`;
          cameraSelect.appendChild(option);
        });

        // Select back camera by default if available
        const backCamera = videoDevices.find(device =>
          device.label.toLowerCase().includes('back') ||
          device.label.toLowerCase().includes('rear')
        );

        if (backCamera) {
          cameraSelect.value = backCamera.deviceId;
          activeDeviceId = backCamera.deviceId;
        }

        // Handle camera selection change
        cameraSelect.addEventListener('change', function () {
          activeDeviceId = this.value;
          startCamera(activeDeviceId);
        });
      }

      // Start camera with selected device
      startCamera(activeDeviceId);

    } catch (error) {
      console.error('Error initializing camera:', error);
      setStatusMessage('Error accessing camera: ' + error.message, 'error');

      // Hide loading indicator
      const loadingElem = document.getElementById('camera-loading');
      if (loadingElem) loadingElem.style.display = 'none';
    }
  }

  // Start camera with specific device ID
  async function startCamera(deviceId) {
    try {
      // Stop any existing stream
      stopCamera();

      // Show loading indicator
      const loadingElem = document.getElementById('camera-loading');
      if (loadingElem) loadingElem.style.display = 'flex';

      // Set up camera constraints
      const constraints = {
        video: {
          facingMode: 'environment', // Prefer back camera
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      // Use specific device if provided
      if (deviceId) {
        constraints.video.deviceId = { exact: deviceId };
      }

      // Get camera stream
      videoStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Connect stream to video element
      const videoElement = document.getElementById('qr-video');
      if (videoElement) {
        videoElement.srcObject = videoStream;
        videoElement.play();

        // Wait for video to be ready
        videoElement.onloadedmetadata = function () {
          // Hide loading indicator
          if (loadingElem) loadingElem.style.display = 'none';

          // Start scanning
          startScanning();
        };
      }
    } catch (error) {
      console.error('Error starting camera:', error);
      setStatusMessage('Error starting camera: ' + error.message, 'error');

      // Hide loading indicator
      const loadingElem = document.getElementById('camera-loading');
      if (loadingElem) loadingElem.style.display = 'none';
    }
  }

  // Stop camera and cleanup
  function stopCamera() {
    // Stop scanning
    scanning = false;

    // Stop any video track
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      videoStream = null;
    }

    // Clear video source
    const videoElement = document.getElementById('qr-video');
    if (videoElement && videoElement.srcObject) {
      videoElement.srcObject = null;
    }
  }

  // Start QR code scanning
  function startScanning() {
    scanning = true;

    // Check if BarcodeDetector API is available
    if ('BarcodeDetector' in window) {
      scanWithBarcodeDetector();
    } else {
      // Load jsQR library if BarcodeDetector is not available
      loadJsQR();
    }
  }

  // Scan using the BarcodeDetector API
  async function scanWithBarcodeDetector() {
    try {
      const barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });

      const videoElement = document.getElementById('qr-video');
      const canvasElement = document.getElementById('qr-canvas');

      if (!videoElement || !canvasElement) return;

      const scanFrame = async () => {
        if (!scanning) return;

        if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
          // Set canvas dimensions to match video
          canvasElement.width = videoElement.videoWidth;
          canvasElement.height = videoElement.videoHeight;

          // Draw video frame to canvas
          const context = canvasElement.getContext('2d');
          context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

          try {
            // Detect QR codes in the current frame
            const barcodes = await barcodeDetector.detect(canvasElement);

            if (barcodes.length > 0) {
              // QR code found
              const qrCode = barcodes[0].rawValue;

              // Give visual feedback
              setStatusMessage('QR Code detected!', 'success');

              // Stop scanning and handle the QR code
              stopCamera();
              
              // Determine context based on current page
              const context = appState.page === 'qrAssignment' ? 'assignment' : 'scan';
              setTimeout(() => handleQRCode(qrCode, context), 500);
              return;
            }
          } catch (err) {
            console.error('Barcode detection error:', err);
          }
        }

        // Continue scanning
        requestAnimationFrame(scanFrame);
      };

      scanFrame();

    } catch (error) {
      console.error('BarcodeDetector error:', error);
      // Fall back to jsQR
      loadJsQR();
    }
  }

  // Load the jsQR library and scan with it
  function loadJsQR() {
    // Check if jsQR is already loaded
    if (window.jsQR) {
      scanWithJsQR();
      return;
    }

    setStatusMessage('Loading QR scanner...');

    // Create script element to load jsQR
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
    script.onload = scanWithJsQR;
    script.onerror = () => {
      setStatusMessage('Failed to load QR scanner library', 'error');
    };

    document.head.appendChild(script);
  }

  // Scan using the jsQR library
  function scanWithJsQR() {
    const videoElement = document.getElementById('qr-video');
    const canvasElement = document.getElementById('qr-canvas');

    if (!videoElement || !canvasElement) return;

    const scanFrame = () => {
      if (!scanning) return;

      if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
        // Set canvas dimensions to match video
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;

        // Draw video frame to canvas
        const context = canvasElement.getContext('2d');
        context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

        // Get image data from canvas
        const imageData = context.getImageData(0, 0, canvasElement.width, canvasElement.height);

        // Scan for QR code
        const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (code) {
          // QR code found
          const qrCode = code.data;

          // Give visual feedback
          setStatusMessage('QR Code detected!', 'success');

          // Stop scanning and handle the QR code
          stopCamera();
          
          // Determine context based on current page
          const context = appState.page === 'qrAssignment' ? 'assignment' : 'scan';
          setTimeout(() => handleQRCode(qrCode, context), 500);
          return;
        }
      }

      // Continue scanning
      requestAnimationFrame(scanFrame);
    };

    scanFrame();
  }

  return container;
}

// =============================================================================
// HOST BUTTON FUNCTIONALITY (moved from core.js)
// =============================================================================

// Function to handle host button click
function handleHostButtonClick() {
  // Check if user is already authenticated as a host
  const authState = getAuthState();
  if (authState.isHost) {
    // If already a host, navigate to host panel
    navigateTo('hostPanel');
  } else {
    // If not a host, show scan prompt
    showHostScanPrompt();
  }
}

function showHostScanPrompt() {
  // Create modal backdrop
  const modalBackdrop = document.createElement('div');
  modalBackdrop.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  modalBackdrop.id = 'host-scan-modal';
  document.body.appendChild(modalBackdrop);

  // Create modal container
  const modalContainer = document.createElement('div');
  modalContainer.className = 'bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4';
  modalBackdrop.appendChild(modalContainer);

  // Modal title
  const modalTitle = document.createElement('h3');
  modalTitle.className = 'text-xl font-bold mb-4';
  modalTitle.textContent = 'Host Authentication';
  modalContainer.appendChild(modalTitle);

  // Instructions
  const instructions = document.createElement('p');
  instructions.className = 'mb-4 text-gray-600';
  instructions.textContent = 'Scan your host QR code to access the game management features.';
  modalContainer.appendChild(instructions);

  // Scan button
  const scanButton = document.createElement('button');
  scanButton.className = 'w-full bg-purple-600 text-white py-2 px-4 rounded-lg flex items-center justify-center mb-4';

  const scanIcon = document.createElement('i');
  scanIcon.setAttribute('data-lucide', 'qr-code');
  scanIcon.className = 'mr-2';
  scanButton.appendChild(scanIcon);

  const scanText = document.createElement('span');
  scanText.textContent = 'Scan Host QR Code';
  scanButton.appendChild(scanText);

  scanButton.addEventListener('click', function () {
    document.body.removeChild(modalBackdrop);
    navigateTo('scanQR');
  });

  modalContainer.appendChild(scanButton);

  // Close button
  const closeButton = document.createElement('button');
  closeButton.className = 'w-full bg-gray-500 text-white py-2 px-4 rounded-lg';
  closeButton.textContent = 'Cancel';
  closeButton.addEventListener('click', function () {
    document.body.removeChild(modalBackdrop);
  });
  modalContainer.appendChild(closeButton);

  // Initialize Lucide icons
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }

  // Allow closing modal with Escape key
  function handleEscapeKey(e) {
    if (e.key === 'Escape') {
      document.body.removeChild(modalBackdrop);
      document.removeEventListener('keydown', handleEscapeKey);
    }
  }
  document.addEventListener('keydown', handleEscapeKey);
}

// =============================================================================
// PWA INSTALLATION AND OFFLINE SUPPORT
// =============================================================================

// PWA installation prompt functionality
let deferredPrompt;

// Listen for the beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  // Stash the event so it can be triggered later
  deferredPrompt = e;
  // Show the install button
  showInstallButton();
});

// Function to show the install button
function showInstallButton() {
  // Only show if we have a deferred prompt and we're on the landing page
  if (!deferredPrompt || appState.page !== 'landing') return;

  const container = document.querySelector('.flex.flex-col.space-y-4');
  if (!container) return;

  // Check if we already added the button
  if (document.getElementById('pwa-install-btn')) return;

  // Create install button
  const installButton = document.createElement('button');
  installButton.id = 'pwa-install-btn';
  installButton.className = 'bg-purple-600 text-white py-3 px-6 rounded-lg shadow-md hover:bg-purple-700 flex items-center justify-center';

  const installIcon = document.createElement('i');
  installIcon.setAttribute('data-lucide', 'download');
  installIcon.className = 'mr-2';
  installButton.appendChild(installIcon);

  const installText = document.createElement('span');
  installText.textContent = 'Install QR Conquest';
  installButton.appendChild(installText);

  installButton.addEventListener('click', showInstallPrompt);

  // Insert at the beginning of the container
  container.prepend(installButton);

  // Initialize Lucide icons
  if (window.lucide) window.lucide.createIcons();
}

// Function to show the installation prompt
function showInstallPrompt() {
  if (!deferredPrompt) return;

  // Show the installation prompt
  deferredPrompt.prompt();

  // Wait for the user to respond to the prompt
  deferredPrompt.userChoice.then((choiceResult) => {
    if (choiceResult.outcome === 'accepted') {
      console.log('User accepted the install prompt');

      // Show success notification
      showNotification('QR Conquest has been installed! For the best experience, please restart the app.', 'success');
    } else {
      console.log('User dismissed the install prompt');
    }

    // Clear the deferred prompt variable
    deferredPrompt = null;

    // Remove the install button
    const installButton = document.getElementById('pwa-install-btn');
    if (installButton) installButton.remove();
  });
}

// Add to renderApp function to check for showing install button
const originalRenderApp = renderApp;
renderApp = function () {
  // Call the original function
  originalRenderApp.apply(this, arguments);

  // Check if we should show the install button
  setTimeout(showInstallButton, 100);
};

// Online/offline status handling
function setupOnlineStatusMonitoring() {
  // Handle online event
  window.addEventListener('online', function () {
    console.log('App is now online');
    showNotification('You are back online', 'success');
    updateOnlineStatus(true);

    // Attempt to sync any pending captures
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready
        .then(registration => registration.sync.register('sync-captures'))
        .catch(err => console.error('Background sync registration failed:', err));
    }
  });

  // Handle offline event
  window.addEventListener('offline', function () {
    console.log('App is now offline');
    showNotification('You are offline. Some features may be limited.', 'warning');
    updateOnlineStatus(false);
  });

  // Update status initially
  updateOnlineStatus(navigator.onLine);
}

// Update the UI based on online status
function updateOnlineStatus(isOnline) {
  // Find the status indicator or create it if it doesn't exist
  let statusIndicator = document.getElementById('online-status-indicator');

  if (!statusIndicator) {
    // Create the indicator if it doesn't exist
    statusIndicator = document.createElement('div');
    statusIndicator.id = 'online-status-indicator';
    statusIndicator.className = 'fixed bottom-2 right-2 z-50 px-3 py-1 rounded-full text-xs font-medium flex items-center';

    const statusDot = document.createElement('span');
    statusDot.id = 'status-dot';
    statusDot.className = 'w-2 h-2 rounded-full mr-1';
    statusIndicator.appendChild(statusDot);

    const statusText = document.createElement('span');
    statusText.id = 'status-text';
    statusIndicator.appendChild(statusText);

    document.body.appendChild(statusIndicator);
  }

  // Update the indicator
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');

  if (isOnline) {
    statusIndicator.className = 'fixed bottom-2 right-2 z-50 px-3 py-1 rounded-full text-xs font-medium flex items-center bg-green-100 text-green-800';
    statusDot.className = 'w-2 h-2 rounded-full mr-1 bg-green-500';
    statusText.textContent = 'Online';
  } else {
    statusIndicator.className = 'fixed bottom-2 right-2 z-50 px-3 py-1 rounded-full text-xs font-medium flex items-center bg-amber-100 text-amber-800';
    statusDot.className = 'w-2 h-2 rounded-full mr-1 bg-amber-500';
    statusText.textContent = 'Offline';
  }
}

// Initialize online status monitoring
document.addEventListener('DOMContentLoaded', setupOnlineStatusMonitoring);

// =============================================================================
// GLOBAL INTERFACE FUNCTIONS (exported to window for core.js)
// =============================================================================

// Export UI functions to global scope so core.js can call them
window.navigateTo = navigateTo;
window.renderApp = renderApp;
window.showNotification = showNotification;
window.updateMapMarkers = updateMapMarkers;