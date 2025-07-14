// DOM elements cache
const elements = {};

// =============================================================================
// REUSABLE UI COMPONENT BUILDERS
// =============================================================================

const UIBuilder = {
  // Create element with properties and children
  createElement(tag, props = {}, children = []) {
    const element = document.createElement(tag);

    // Set properties
    Object.entries(props).forEach(([key, value]) => {
      if (key === 'onClick' && typeof value === 'function') {
        // Special handling for onClick to ensure it works
        element.addEventListener('click', value);
      } else if (key.startsWith('on') && typeof value === 'function') {
        // Other event handlers
        const eventName = key.slice(2).toLowerCase();
        element.addEventListener(eventName, value);
      } else if (key === 'className') {
        element.className = value;
      } else if (key === 'textContent') {
        element.textContent = value;
      } else if (key === 'innerHTML') {
        element.innerHTML = value;
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(element.style, value);
      } else {
        element.setAttribute(key, value);
      }
    });

    // Add children
    children.forEach(child => {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else if (child && child.nodeType) {
        element.appendChild(child);
      }
    });

    return element;
  },

  // Create a simple button
  createButton(text, onClick, className = '', icon = null) {
    const button = document.createElement('button');
    button.className = `font-medium rounded-lg transition-colors flex items-center justify-center ${className}`;

    if (icon) {
      const iconEl = document.createElement('i');
      iconEl.setAttribute('data-lucide', icon);
      iconEl.className = 'mr-2';
      button.appendChild(iconEl);
    }

    button.appendChild(document.createTextNode(text));

    if (onClick) {
      button.addEventListener('click', onClick);
    }

    return button;
  },

  createModal(config) {
    const {
      title,        // string - Modal title
      content,      // HTMLElement|string - Modal content
      actions = [], // Array of action button configs
      size = 'md',  // Modal size ('sm', 'md', 'lg', 'xl')
      onClose = null// Callback when modal is closed
    } = config;

    // Size classes
    const sizeClasses = {
      'sm': 'max-w-sm',
      'md': 'max-w-md',
      'lg': 'max-w-lg',
      'xl': 'max-w-2xl'
    };

    // Create modal backdrop
    const modalBackdrop = this.createElement('div', {
      className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000]'
    });

    // Create modal container
    const modalContainer = this.createElement('div', {
      className: `bg-white rounded-lg shadow-xl p-6 w-full ${sizeClasses[size]} mx-4 max-h-[90vh] overflow-y-auto`
    });

    // Add title if provided
    if (title) {
      const titleElement = this.createElement('h3', {
        className: 'text-xl font-bold mb-4',
        textContent: title
      });
      modalContainer.appendChild(titleElement);
    }

    // Add content
    if (content) {
      const contentContainer = this.createElement('div', {
        className: 'modal-content'
      });

      if (typeof content === 'string') {
        contentContainer.innerHTML = content;
      } else if (content.nodeType) {
        contentContainer.appendChild(content);
      }

      modalContainer.appendChild(contentContainer);
    }

    // Add actions if provided
    if (actions.length > 0) {
      const actionsContainer = this.createElement('div', {
        className: 'flex gap-4 mt-6 pt-4 border-t'
      });

      actions.forEach(action => {
        const button = this.createButton(
          action.text,
          action.onClick,
          action.className || 'flex-1 py-2 px-4 rounded-lg transition-colors',
          action.icon
        );

        if (action.type) {
          button.type = action.type;
        }

        actionsContainer.appendChild(button);
      });

      modalContainer.appendChild(actionsContainer);
    }

    modalBackdrop.appendChild(modalContainer);

    // Close function
    const closeModal = () => {
      if (onClose) onClose();
      if (modalBackdrop.parentNode) {
        modalBackdrop.parentNode.removeChild(modalBackdrop);
      }
      document.removeEventListener('keydown', handleEscapeKey);
    };

    // Handle escape key
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };
    document.addEventListener('keydown', handleEscapeKey);

    // Add close method to modal for external access
    modalBackdrop.close = closeModal;

    return modalBackdrop;
  },

  createLoadingDisplay(message = 'Loading...') {
    const loadingDiv = this.createElement('div', {
      className: 'flex items-center justify-center py-12'
    });

    const loadingSpinner = this.createElement('div', {
      className: 'animate-spin h-8 w-8 border-4 border-gray-300 rounded-full border-t-purple-600 mr-4'
    });
    loadingDiv.appendChild(loadingSpinner);

    const loadingText = this.createElement('p', {
      className: 'text-gray-600',
      textContent: message
    });
    loadingDiv.appendChild(loadingText);

    return loadingDiv;
  },

  createEmptyState(config) {
    const {
      icon = 'inbox',
      title = 'No items found',
      message = 'There are no items to display',
      action = null
    } = config;

    const emptyDiv = this.createElement('div', {
      className: 'text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300'
    });

    const emptyIcon = this.createElement('i', {
      'data-lucide': icon,
      className: 'w-12 h-12 text-gray-400 mx-auto mb-3'
    });
    emptyDiv.appendChild(emptyIcon);

    const emptyTitle = this.createElement('h4', {
      className: 'text-lg font-medium text-gray-900 mb-2',
      textContent: title
    });
    emptyDiv.appendChild(emptyTitle);

    const emptyText = this.createElement('p', {
      className: 'text-gray-600 mb-4',
      textContent: message
    });
    emptyDiv.appendChild(emptyText);

    if (action) {
      const actionButton = this.createButton(
        action.text,
        action.onClick,
        action.className || 'bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors inline-flex items-center',
        action.icon
      );
      emptyDiv.appendChild(actionButton);
    }

    return emptyDiv;
  }
};

// =============================================================================
// INITIALIZATION
// =============================================================================

// Initialize app immediately when script is loaded
(function initializeApp() {
  console.log('UI system loaded, initializing app immediately');

  // Cache main elements
  elements.root = document.getElementById('root');
  elements.errorContainer = document.getElementById('error-container');

  if (!elements.root) {
    console.error('Root element not found! Initialization failed.');
    return;
  }

  // Parse URL parameters for QR code
  const urlParams = new URLSearchParams(window.location.search);
  let qrIdToProcess = urlParams.get('id');

  if (qrIdToProcess) {
    console.log('QR code ID found in URL:', qrIdToProcess);
    // Clean the URL immediately
    try {
      const baseUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.replaceState({ path: baseUrl }, "", baseUrl);
      console.log('URL cleaned. Proceeding with QR ID:', qrIdToProcess);
    } catch (e) {
      console.warn('Could not clean URL using history.replaceState:', e);
    }
  }

  // Initialize authentication state from localStorage
  const authState = getAuthState();
  if (authState.isHost) {
    appState.hostId = authState.hostId;
    console.log('Found host ID in localStorage:', authState.hostId);
  }

  // Load game data if we have a game ID, then process QR code
  if (authState.hasGame) {
    console.log('Found game ID in localStorage:', authState.gameId);
    fetchGameData(authState.gameId)
      .then(() => {
        if (qrIdToProcess) {
          console.log('Processing stored QR ID after game data load:', qrIdToProcess);
          handleQRCode(qrIdToProcess);
          qrIdToProcess = null;
        }
      })
      .catch(err => {
        console.error('Error loading game data:', err);
        if (qrIdToProcess) {
          console.log('Processing stored QR ID after game data load error:', qrIdToProcess);
          handleQRCode(qrIdToProcess);
          qrIdToProcess = null;
        }
      });
  } else if (qrIdToProcess) {
    console.log('No game loaded, processing stored QR ID:', qrIdToProcess);
    handleQRCode(qrIdToProcess);
    qrIdToProcess = null;
  } else {
    renderApp();
  }

  // Set team/player info from localStorage if available
  if (authState.hasTeam) {
    appState.gameData.currentTeam = authState.teamId;
    appState.gameData.currentPlayer = authState.playerId;
    console.log('Found team ID in localStorage:', authState.teamId);
  }
})();


function loadQRCodeLibrary() {
  return new Promise((resolve, reject) => {
    // Check if QRCode library is already loaded
    if (window.QRCode) {
      resolve();
      return;
    }

    // Create script element to load QRCode.js
    const script = UIBuilder.createElement('script', {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
      onLoad: () => {
        console.log('QRCode library loaded successfully');
        resolve();
      },
      onError: () => {
        console.error('Failed to load QRCode library');
        reject(new Error('Failed to load QR code library'));
      }
    });
    document.head.appendChild(script);
  });
}

// =============================================================================
// NAVIGATION AND STATE MANAGEMENT
// =============================================================================

function navigateTo(page) {
  console.log('Navigating to:', page);
  const previousPage = appState.page;
  appState.page = page;

  // Stop polling if leaving game view
  if (page !== 'gameView') {
    stopScorePolling();
  }

  // Start polling if entering game view
  if (page === 'gameView') {
    startScorePolling();
  }

  // GPS tracking management
  const gpsPages = ['gameView', 'scanQR', 'hostPanel', 'qrAssignment'];
  const wasOnGPSPage = gpsPages.includes(previousPage);
  const isOnGPSPage = gpsPages.includes(page);

  if (!wasOnGPSPage && isOnGPSPage) {
    // Starting GPS tracking
    startGPSTracking();
  } else if (wasOnGPSPage && !isOnGPSPage) {
    // Stopping GPS tracking
    stopGPSTracking();
  }

  if (appState.page === 'gameView' || appState.page === 'hostPanel') {
    if (gameMapInstance) {
      try {
        gameMapInstance.remove();
      } catch (e) {
        console.warn('Error cleaning up map:', e);
      }
      gameMapInstance = null;
    }
  }

  if (page === 'siteAdminPanel' && appState.siteAdmin.isAuthenticated) {
    // Trigger host data loading if not already loaded/loading
    if (!appState.siteAdmin.hostsLoaded && !appState.siteAdmin.hostsLoading) {
      loadSiteAdminHosts();
    }
  }

  // Clear admin data when leaving site admin
  if (appState.page !== 'siteAdminPanel' && appState.page !== 'siteAdminLogin') {
    clearSiteAdminData();
  }

  renderApp();
}

function clearError() {
  appState.error = null;
  renderApp();
}

// =============================================================================
// PAGE RENDERING COMPONENTS
// =============================================================================

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

    // Continue Game button (if in a team)
    if (authState.hasTeam) {
      const continueButton = UIBuilder.createButton('Continue Game', function() {
        navigateTo('gameView');
      }, 'bg-green-600 text-white py-3 px-6 rounded-lg shadow-md hover:bg-green-700 w-full');
      buttonContainer.appendChild(continueButton);
    } else {
      // Join Game button
      const joinButton = UIBuilder.createButton('Scan Team QR Code', function() {
        navigateTo('scanQR');
      }, 'bg-purple-600 text-white py-3 px-6 rounded-lg shadow-md hover:bg-purple-700 w-full');
      buttonContainer.appendChild(joinButton);
    }

    // Host Panel button (if host)
    if (authState.isHost) {
      const hostButton = UIBuilder.createButton('Game Management', function() {
        navigateTo('hostPanel');
      }, 'bg-purple-600 text-white py-3 px-6 rounded-lg shadow-md hover:bg-purple-700 w-full');
      buttonContainer.appendChild(hostButton);
    }

    // Leave Game button
    const leaveButton = UIBuilder.createButton('Leave Game', function() {
      clearGameData();
    }, 'bg-gray-600 text-white py-2 px-6 rounded-lg shadow-md hover:bg-gray-700 w-full');
    buttonContainer.appendChild(leaveButton);
  } else if (authState.isHost) {
    // Host is authenticated but no game loaded
    const hostWelcome = document.createElement('p');
    hostWelcome.className = 'mb-6 text-purple-700';
    hostWelcome.textContent = `Welcome, ${authState.hostName || 'Host'}!`;
    container.appendChild(hostWelcome);

    // Host Game button
    const hostButton = UIBuilder.createButton('Host a Game', function() {
      navigateTo('hostPanel');
    }, 'bg-purple-600 text-white py-3 px-6 rounded-lg shadow-md hover:bg-purple-700 w-full');
    buttonContainer.appendChild(hostButton);

    // Scan QR Code button
    const scanButton = UIBuilder.createButton('Scan QR Code', function() {
      navigateTo('scanQR');
    }, 'bg-purple-600 text-white py-3 px-6 rounded-lg shadow-md hover:bg-purple-700 w-full');
    buttonContainer.appendChild(scanButton);

    // Logout button
    const logoutButton = UIBuilder.createButton('Logout', function() {
      logoutHost();
    }, 'bg-gray-600 text-white py-2 px-6 rounded-lg shadow-md hover:bg-gray-700 w-full');
    buttonContainer.appendChild(logoutButton);
  } else {
    // Not authenticated, not in a game
    // Scan QR Code button
    const scanButton = UIBuilder.createButton('Scan QR Code', function() {
      navigateTo('scanQR');
    }, 'bg-purple-600 text-white py-3 px-6 rounded-lg shadow-md hover:bg-purple-700 w-full');
    buttonContainer.appendChild(scanButton);
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
  scoreboardContainer.id = 'scoreboard-container'; // Add ID for updates
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
  mapContainerElement.id = 'map-container';
  mapContainerElement.className = 'bg-gray-200 rounded-lg shadow-md h-80 md:h-96 relative';
  mapSection.appendChild(mapContainerElement);

  // GPS status below map (unobtrusive)
  const gpsStatusContainer = document.createElement('div');
  gpsStatusContainer.className = 'mt-2 flex justify-center';
  gpsStatusContainer.appendChild(createGPSStatusIndicator());
  mapSection.appendChild(gpsStatusContainer);

  container.appendChild(mapSection);

  // Action buttons
  const actionsContainer = document.createElement('div');
  actionsContainer.className = 'flex gap-4';

  const scanButton = UIBuilder.createButton('Scan QR Code', function() {
    navigateTo('scanQR');
  }, 'flex-1 bg-green-600 text-white py-3 px-6 rounded-lg shadow-md hover:bg-green-700', 'qr-code');
  actionsContainer.appendChild(scanButton);
  container.appendChild(actionsContainer);

  // Initialise the scoreboard with current data
  setTimeout(() => {
    updateScoreboard();
    initGameMap();
    updateGPSStatusDisplay();
  }, 0);

  return container;
}

// Loading Screen
function renderLoadingScreen() {
  const container = document.createElement('div');
  container.className = 'flex flex-col items-center justify-center h-64';

  const spinner = document.createElement('div');
  spinner.className = 'animate-spin h-12 w-12 border-4 border-purple-600 rounded-full border-t-transparent mb-4';
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

  const button = UIBuilder.createButton('Dismiss', function() {
    clearError();
  }, 'bg-purple-600 text-white py-2 px-4 rounded-lg');
  container.appendChild(button);

  return container;
}

// Results Page
function renderResultsPage() {
  const container = UIBuilder.createElement('div', { className: 'text-center py-10' });

  // Find the winner (team with highest score)
  let winner = { name: 'No Team', score: 0, color: 'bg-gray-500' };

  if (appState.gameData.teams && appState.gameData.teams.length > 0) {
    winner = appState.gameData.teams.reduce(function(prev, current) {
      return (prev.score || 0) > (current.score || 0) ? prev : current;
    }, appState.gameData.teams[0]);
  }

  // Title
  const title = UIBuilder.createElement('h2', {
    className: 'text-3xl font-bold mb-8',
    textContent: 'Game Results'
  });
  container.appendChild(title);

  // Winner section
  const winnerSection = UIBuilder.createElement('div', { className: 'mb-10' });

  const trophyContainer = UIBuilder.createElement('div', {
    className: 'inline-block p-6 rounded-full ' + winner.color + ' text-white mb-4'
  });

  const trophy = UIBuilder.createElement('span', {
    className: 'text-3xl',
    textContent: '🏆'
  });
  trophyContainer.appendChild(trophy);

  winnerSection.appendChild(trophyContainer);

  const winnerName = UIBuilder.createElement('h3', {
    className: 'text-2xl font-bold',
    textContent: winner.name + ' Wins!'
  });
  winnerSection.appendChild(winnerName);

  const winnerScore = UIBuilder.createElement('p', {
    className: 'text-xl',
    textContent: (winner.score || 0) + ' points'
  });
  winnerSection.appendChild(winnerScore);

  container.appendChild(winnerSection);

  // Final scores section
  const scoresSection = UIBuilder.createElement('div', {
    className: 'max-w-md mx-auto bg-white rounded-lg shadow-md p-6 mb-8'
  });

  const scoresTitle = UIBuilder.createElement('h3', {
    className: 'text-xl font-semibold mb-4',
    textContent: 'Final Scores'
  });
  scoresSection.appendChild(scoresTitle);

  if (appState.gameData.teams && appState.gameData.teams.length > 0) {
    // Sort teams by score (descending)
    const sortedTeams = [].concat(appState.gameData.teams).sort(function(a, b) {
      return (b.score || 0) - (a.score || 0);
    });

    sortedTeams.forEach(function(team, index) {
      const teamRow = UIBuilder.createElement('div', {
        className: 'flex justify-between py-2 border-b last:border-b-0'
      });

      const teamNameContainer = UIBuilder.createElement('div', {
        className: 'flex items-center'
      });

      const rank = UIBuilder.createElement('span', {
        className: 'font-bold mr-2',
        textContent: '#' + (index + 1)
      });
      teamNameContainer.appendChild(rank);

      const teamColor = UIBuilder.createElement('div', {
        className: 'w-3 h-3 rounded-full ' + team.color + ' mr-2'
      });
      teamNameContainer.appendChild(teamColor);

      const teamName = UIBuilder.createElement('span', {
        textContent: team.name
      });
      teamNameContainer.appendChild(teamName);

      teamRow.appendChild(teamNameContainer);

      const teamScore = UIBuilder.createElement('span', {
        className: 'font-bold',
        textContent: (team.score || 0) + ' pts'
      });
      teamRow.appendChild(teamScore);

      scoresSection.appendChild(teamRow);
    });
  } else {
    const noTeams = UIBuilder.createElement('p', {
      className: 'text-center text-gray-600',
      textContent: 'No teams available'
    });
    scoresSection.appendChild(noTeams);
  }

  container.appendChild(scoresSection);

  // Action buttons
  const actionsContainer = UIBuilder.createElement('div', {
    className: 'flex flex-col space-y-4 max-w-xs mx-auto'
  });

  const homeButton = UIBuilder.createButton('Back to Home', function() {
    navigateTo('landing');
  }, 'bg-purple-600 text-white py-3 px-6 rounded-lg shadow-md hover:bg-purple-700');
  actionsContainer.appendChild(homeButton);

  const newGameButton = UIBuilder.createButton('New Game', clearGameData, 'bg-gray-600 text-white py-2 px-6 rounded-lg shadow-md hover:bg-gray-700');
  actionsContainer.appendChild(newGameButton);

  container.appendChild(actionsContainer);

  return container;
}

// QR Scanner
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
    instructionBox.className = 'bg-purple-100 border border-purple-400 text-purple-700 px-4 py-3 rounded mb-4';

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
  viewfinder.className = 'border-2 border-purple-500 rounded-lg w-64 h-64 opacity-60';
  scannerOverlay.appendChild(viewfinder);

  cameraContainer.appendChild(scannerOverlay);

  // Loading indicator
  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white';
  loadingIndicator.id = 'camera-loading';

  const loadingSpinner = document.createElement('div');
  loadingSpinner.className = 'animate-spin h-10 w-10 border-4 border-purple-500 rounded-full border-t-transparent mb-2';
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

  // GPS status below camera feed (unobtrusive)
  const gpsStatusContainer = document.createElement('div');
  gpsStatusContainer.className = 'mt-2 flex justify-center';
  gpsStatusContainer.appendChild(createGPSStatusIndicator());
  scannerContainer.appendChild(gpsStatusContainer);

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

  const submitButton = UIBuilder.createButton('Submit', function() {
    const qrCode = input.value.trim();
    if (!qrCode) {
      setStatusMessage('Please enter a QR code value', 'error');
      return;
    }

    // Determine context based on current page
    const context = appState.page === 'qrAssignment' ? 'assignment' : 'scan';
    handleQRCode(qrCode, context);
  }, 'bg-purple-600 text-white py-2 px-4 rounded-lg text-sm');
  inputContainer.appendChild(submitButton);

  manualInputContainer.appendChild(inputContainer);
  scannerContainer.appendChild(manualInputContainer);
  container.appendChild(scannerContainer);

  // Action buttons
  const actionsContainer = document.createElement('div');
  actionsContainer.className = 'flex gap-4';

  const cancelButton = UIBuilder.createButton('Cancel', function() {
    // Stop camera before navigating away
    stopCamera();

    // Different return destinations based on context
    if (appState.page === 'qrAssignment') {
      navigateTo('hostPanel');
    } else if (authState.isHost) {
      navigateTo('hostPanel');
    } else if (authState.hasGame) {
      navigateTo('gameView');
    } else {
      navigateTo('landing');
    }
  }, 'flex-1 bg-gray-600 text-white py-3 px-6 rounded-lg shadow-md hover:bg-gray-700');
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
    script.src = '/libs/jsQR.js';
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
// MAP FUNCTIONALITY
// =============================================================================

let gameMapInstance = null;

// Helper function to map Tailwind colors to hex for Leaflet
function getHexColorForTailwind(tailwindColorClass) {
  const colorMap = {
    'bg-red-500': '#ef4444',
    'bg-blue-500': '#3b82f6',
    'bg-green-500': '#22c55e',
    'bg-yellow-500': '#eab308',
    'bg-purple-500': '#a855f7',
    'bg-orange-500': '#ed8936',
    'bg-pink-500': '#ec4899',
    'bg-indigo-500': '#6366f1',
    'bg-teal-500': '#14b8a6',
    'bg-gray-400': '#9ca3af', // A slightly different gray for uncaptured
    'bg-gray-500': '#6b7280'  // Default if color not in map
  };
  return colorMap[tailwindColorClass] || colorMap['bg-gray-500'];
}

function initGameMap() {
  const mapElement = document.getElementById('map-container');
  if (!mapElement) {
    console.error('Map container (map-container) not found.');
    return;
  }

  // Check if there are bases to display
  if (!appState.gameData.bases || appState.gameData.bases.length === 0) {
    mapElement.innerHTML = `<div class="flex items-center justify-center h-full text-gray-600">No bases to display on the map.</div>`;
    return;
  }

  // Clean up existing map instance if it exists
  if (gameMapInstance) {
    try {
      gameMapInstance.remove();
    } catch (e) {
      console.warn('Error removing existing map:', e);
    }
    gameMapInstance = null;
  }

  // Always initialize a new map instance
  gameMapInstance = L.map(mapElement);

  // Add OpenStreetMap tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(gameMapInstance);

  // Initialize empty markers array
  gameMapInstance.baseMarkers = [];

  // Create or update all markers
  updateMapMarkers();

  // Set initial view
  const latLngs = [];
  appState.gameData.bases.forEach(base => {
    if (typeof base.lat === 'number' && typeof base.lng === 'number') {
      latLngs.push([base.lat, base.lng]);
    }
  });

  if (latLngs.length > 0) {
    const bounds = L.latLngBounds(latLngs);
    gameMapInstance.fitBounds(bounds.pad(0.2));
  } else {
    gameMapInstance.setView([55.94763, -3.16202], 16);
    mapElement.innerHTML = `<div class="flex items-center justify-center h-full text-gray-600">No valid bases to display on the map.</div>`;
  }
}

function updateMapMarkers() {
  if (!gameMapInstance) {
    console.warn('Map instance not found in updateMapMarkers. Map may not be initialised.');

    // Try to initialise the map if we're on the game view page
    if (appState.page === 'gameView' && document.getElementById('map-container')) {
      console.log('Attempting to initialise map from updateMapMarkers');
      initGameMap();
      return; // initGameMap will call updateMapMarkers again
    }
    return;
  }

  // Initialise markers array if it doesn't exist
  if (!gameMapInstance.baseMarkers) {
    gameMapInstance.baseMarkers = [];
  }

  // If no bases, clear all markers and return
  if (!appState.gameData.bases || appState.gameData.bases.length === 0) {
    gameMapInstance.baseMarkers.forEach(marker => {
      gameMapInstance.removeLayer(marker);
    });
    gameMapInstance.baseMarkers = [];
    return;
  }

  const captureRadius = appState.gameData.settings?.capture_radius_meters || 15;

  // Track which bases we've processed
  const processedBaseIds = new Set();

  // Update or create markers for current bases
  appState.gameData.bases.forEach(base => {
    if (typeof base.lat !== 'number' || typeof base.lng !== 'number') {
      console.warn('Base has invalid coordinates:', base.name, base.lat, base.lng);
      return;
    }

    processedBaseIds.add(base.id);
    const latLng = [base.lat, base.lng];

    // Find existing marker for this base
    let existingMarker = gameMapInstance.baseMarkers.find(m => m.baseId === base.id);

    // Determine marker colour and popup content
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

    if (existingMarker) {
      // Update existing marker
      existingMarker.setLatLng(latLng);
      existingMarker.setRadius(captureRadius); // This works for L.circle
      existingMarker.setStyle({
        fillColor: markerColor,
        color: '#000000',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.6
      });
      existingMarker.getPopup().setContent(popupContent);
    } else {
      // Create new marker using L.circle to show actual radius in metres
      const circleMarker = L.circle(latLng, {
        radius: captureRadius, // radius in metres
        fillColor: markerColor,
        color: '#000000',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.6
      }).addTo(gameMapInstance);

      circleMarker.bindPopup(popupContent);
      circleMarker.baseId = base.id;
      gameMapInstance.baseMarkers.push(circleMarker);
    }
  });

  // Remove markers for bases that no longer exist
  gameMapInstance.baseMarkers = gameMapInstance.baseMarkers.filter(marker => {
    if (!processedBaseIds.has(marker.baseId)) {
      // Base no longer exists, remove marker
      gameMapInstance.removeLayer(marker);
      return false;
    }
    return true;
  });
}

function updateScoreboard() {
  const scoreboardContainer = document.querySelector('#scoreboard-container');
  if (!scoreboardContainer) {
    console.warn('Scoreboard container not found for update');
    return;
  }

  // Clear existing content
  scoreboardContainer.innerHTML = '';

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
    header.className = 'bg-purple-600 text-white p-4 shadow-md relative';

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

    // Create status section in header
    if (appState.gameData.status && appState.gameData.status !== '') {
      const statusDiv = document.createElement('div');
      statusDiv.className = 'flex justify-between items-center mt-1';

      const statusText = document.createElement('p');
      statusText.id = 'game-status-text';

      // Use the shared function for initial setup
      const needsTimer = updateGameStatusText(statusText);
      statusDiv.appendChild(statusText);

      // Always show team info if player is on a team
      if (appState.gameData.currentTeam) {
        const teamText = document.createElement('p');
        teamText.className = 'text-sm';
        teamText.textContent = 'Team: ' + getTeamName(appState.gameData.currentTeam);
        statusDiv.appendChild(teamText);
      }

      leftSection.appendChild(statusDiv);

      // Start timer if needed
      if (needsTimer) {
        startHeaderTimer();
      }
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
      const hostButton = UIBuilder.createButton('Host Menu', function() {
        handleHostButtonClick();
      }, 'bg-white bg-opacity-20 hover:bg-opacity-30 text-white py-2 px-4 rounded-lg transition-all duration-200', 'shield');
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
  } finally {
    // Always clear the render lock
    window.renderingInProgress = false;
  }
}

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
  const modal = UIBuilder.createModal({
    title: 'Host Authentication',
    content: UIBuilder.createElement('p', {
      className: 'mb-4 text-gray-600',
      textContent: 'Scan your host QR code to access the game management features.'
    }),
    actions: [
      {
        text: 'Scan Host QR Code',
        onClick: () => {
          modal.close();
          navigateTo('scanQR');
        },
        className: 'bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors',
        icon: 'qr-code'
      },
      {
        text: 'Cancel',
        onClick: () => modal.close(),
        className: 'bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors'
      }
    ]
  });

  document.body.appendChild(modal);
}

// Helper function to format time duration
function formatTimeRemaining(seconds) {
  if (seconds <= 0) return null;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

// Function to update game status text (used for both initial render and timer updates)
function updateGameStatusText(statusElement) {
  if (!statusElement || !appState.gameData.status) return false;

  const now = Math.floor(Date.now() / 1000);
  let needsTimer = false;

  if (appState.gameData.status === 'setup') {
    const autoStartTime = appState.gameData.settings?.auto_start_time;

    if (autoStartTime) {
      const timeUntilStart = autoStartTime - now;
      const timeString = formatTimeRemaining(timeUntilStart);

      if (timeString) {
        statusElement.textContent = `Game starts in ${timeString}`;
        needsTimer = true;
      } else {
        statusElement.textContent = 'Game should start now';
        if (appState.gameData.id) {
          fetchGameData(appState.gameData.id);
        }
      }
    } else {
      statusElement.textContent = 'Game setup';
      statusElement.className = 'text-sm';
    }

  } else if (appState.gameData.status === 'active') {
    const endTime = appState.gameData.settings?.calculated_end_time;

    if (endTime) {
      const remaining = endTime - now;
      const timeString = formatTimeRemaining(remaining);

      if (timeString) {
        statusElement.textContent = `Game in progress • ${timeString} remaining`;
        needsTimer = true;
      } else {
        statusElement.textContent = 'Game ended';
        if (appState.gameData.id) {
          fetchGameData(appState.gameData.id);
        }
      }
    } else {
      statusElement.textContent = 'Game in progress';
      statusElement.className = 'text-sm';
    }

  } else if (appState.gameData.status === 'ended') {
    statusElement.textContent = 'Game ended';
    statusElement.className = 'text-sm text-gray-200';
  }

  return needsTimer;
}

function updateGPSStatusDisplay() {
  const statusElement = document.getElementById('gps-status-indicator');
  if (!statusElement) return;

  const { status, accuracy } = appState.gps;

  // Clear existing classes
  statusElement.className = 'text-xs px-2 py-1 rounded-full flex items-center';

  let statusText = '';
  let statusIcon = '';

  switch (status) {
    case 'getting':
      statusElement.className += ' bg-blue-100 text-blue-700';
      statusText = 'Getting GPS...';
      statusIcon = 'loader-2';
      break;
    case 'ready':
      statusElement.className += ' bg-green-100 text-green-700';
      statusText = `GPS Ready (±${accuracy.toFixed(0)}m)`;
      statusIcon = 'navigation';
      break;
    case 'poor':
      statusElement.className += ' bg-amber-100 text-amber-700';
      statusText = `Poor GPS (±${accuracy.toFixed(0)}m)`;
      statusIcon = 'navigation';
      break;
    case 'error':
      statusElement.className += ' bg-red-100 text-red-700';
      statusText = 'GPS Error';
      statusIcon = 'navigation-off';
      break;
    case 'inactive':
    default:
      statusElement.style.display = 'none';
      return;
  }

  statusElement.style.display = 'flex';
  statusElement.innerHTML = `
    <i data-lucide="${statusIcon}" class="w-3 h-3 mr-1 ${status === 'getting' ? 'animate-spin' : ''}"></i>
    <span>${statusText}</span>
  `;

  // Re-initialize Lucide icons for the new icon
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function createGPSStatusIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'gps-status-indicator';
  indicator.className = 'text-xs px-2 py-1 rounded-full flex items-center';
  indicator.style.display = 'none';
  return indicator;
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
  const installButton = UIBuilder.createButton('Install QR Conquest', function() {
    showInstallPrompt();
  }, 'bg-purple-600 text-white py-3 px-6 rounded-lg shadow-md hover:bg-purple-700 w-full', 'download');
  installButton.id = 'pwa-install-btn';

  // Insert at the beginning of the container
  container.prepend(installButton);
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

// Generate QR codes with library loading
async function generateQRCode(elementId, url) {
  const qrDiv = document.getElementById(elementId);
  if (!qrDiv) {
    console.error('QR code container not found:', elementId);
    return;
  }

  try {
    // Load QR code library if not already loaded
    await loadQRCodeLibrary();

    // Clear any existing content
    qrDiv.innerHTML = '';

    // Generate QR code
    new QRCode(qrDiv, {
      text: url,
      width: 200,
      height: 200,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });

  } catch (error) {
    console.error('Failed to generate QR code:', error);

    // Show fallback content
    qrDiv.innerHTML = '';
    const fallbackContainer = UIBuilder.createElement('div', {
      className: 'text-center text-gray-600 p-8'
    });

    const fallbackIcon = UIBuilder.createElement('i', {
      'data-lucide': 'alert-circle',
      className: 'mx-auto h-12 w-12 text-gray-400 mb-2'
    });
    fallbackContainer.appendChild(fallbackIcon);

    const fallbackText1 = UIBuilder.createElement('p', {
      textContent: 'QR Code generation failed'
    });
    fallbackContainer.appendChild(fallbackText1);

    const fallbackText2 = UIBuilder.createElement('p', {
      className: 'text-xs mt-1',
      textContent: 'Use the link above instead'
    });
    fallbackContainer.appendChild(fallbackText2);

    qrDiv.appendChild(fallbackContainer);
  }
}

let headerTimerInterval = null;

function startHeaderTimer() {
  // Clear any existing timer first
  if (headerTimerInterval) {
    clearInterval(headerTimerInterval);
  }

  headerTimerInterval = setInterval(() => {
    const statusElement = document.getElementById('game-status-text');

    // Use the same function for updates - it returns whether to continue
    const shouldContinue = updateGameStatusText(statusElement);

    // Self-cancel if no longer needed
    if (!shouldContinue) {
      clearInterval(headerTimerInterval);
      headerTimerInterval = null;
    }
  }, 1000);
}

// Initialize online status monitoring
document.addEventListener('DOMContentLoaded', setupOnlineStatusMonitoring);

// =============================================================================
// GLOBAL INTERFACE FUNCTIONS (exported to window for core.js)
// =============================================================================

// Export UI functions to global scope so core.js can call them
window.navigateTo = navigateTo;
window.renderApp = renderApp;
window.updateMapMarkers = updateMapMarkers;
window.updateScoreboard = updateScoreboard;
window.updateGameStatusText = updateGameStatusText;
window.updateGPSStatusDisplay = updateGPSStatusDisplay;
window.generateQRCode = generateQRCode;