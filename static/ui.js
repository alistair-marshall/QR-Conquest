// DOM elements cache
const elements = {};

// =============================================================================
// REUSABLE UI COMPONENT BUILDERS - Modular DOM manipulation
// =============================================================================

const UIBuilder = {
  // Create element with properties and children
  createElement(tag, props = {}, children = []) {
    const element = document.createElement(tag);
    
    // Set properties
    Object.entries(props).forEach(([key, value]) => {
      if (key.startsWith('on') && typeof value === 'function') {
        // Event handlers
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
      } else if (key === 'dataset' && typeof value === 'object') {
        Object.entries(value).forEach(([dataKey, dataValue]) => {
          element.dataset[dataKey] = dataValue;
        });
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

  // Common button variants
  createButton(options = {}) {
    const {
      text = 'Button',
      variant = 'primary',
      size = 'md',
      className = '',
      icon = null,
      onClick = null,
      disabled = false,
      ...otherProps
    } = options;

    const baseClasses = 'font-medium rounded-lg transition-colors flex items-center justify-center';
    const variants = {
      primary: 'bg-blue-600 text-white hover:bg-blue-700',
      secondary: 'bg-gray-600 text-white hover:bg-gray-700',
      success: 'bg-green-600 text-white hover:bg-green-700',
      danger: 'bg-red-600 text-white hover:bg-red-700',
      warning: 'bg-amber-600 text-white hover:bg-amber-700',
      purple: 'bg-purple-600 text-white hover:bg-purple-700'
    };
    const sizes = {
      sm: 'py-1 px-3 text-sm',
      md: 'py-2 px-4',
      lg: 'py-3 px-6 text-lg'
    };

    const button = this.createElement('button', {
      className: `${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`,
      disabled,
      onClick,
      ...otherProps
    });

    // Add icon if provided
    if (icon) {
      const iconElement = this.createIcon(icon, 'mr-2');
      button.appendChild(iconElement);
    }

    // Add text
    button.appendChild(document.createTextNode(text));

    return button;
  },

  // Icon component
  createIcon(name, className = 'w-4 h-4') {
    return this.createElement('i', {
      'data-lucide': name,
      className
    });
  },

  // Loading spinner
  createSpinner(className = 'h-8 w-8') {
    return this.createElement('div', {
      className: `animate-spin border-4 border-gray-300 rounded-full border-t-blue-600 ${className}`
    });
  },

  // Form input with label
  createFormGroup(options = {}) {
    const { label, required = false, className = 'mb-4', children = [] } = options;
    
    const group = this.createElement('div', { className });
    
    if (label) {
      const labelElement = this.createElement('label', {
        className: 'block text-gray-700 text-sm font-bold mb-2'
      }, [label]);
      
      if (required) {
        const asterisk = this.createElement('span', {
          className: 'text-red-500 ml-1',
          textContent: '*'
        });
        labelElement.appendChild(asterisk);
      }
      
      group.appendChild(labelElement);
    }
    
    children.forEach(child => group.appendChild(child));
    
    return group;
  },

  // Input field
  createInput(options = {}) {
    const { label, required = false, className = '', ...otherProps } = options;
    
    const input = this.createElement('input', {
      className: `w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${className}`,
      required,
      ...otherProps
    });
    
    if (label) {
      return this.createFormGroup({ label, required, children: [input] });
    }
    
    return input;
  },

  // Select dropdown
  createSelect(options = {}) {
    const { label, options: selectOptions = [], required = false, className = '', ...otherProps } = options;
    
    const select = this.createElement('select', {
      className: `w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${className}`,
      required,
      ...otherProps
    });
    
    selectOptions.forEach(opt => {
      const option = this.createElement('option', {
        value: opt.value,
        textContent: opt.label || opt.value
      });
      select.appendChild(option);
    });
    
    if (label) {
      return this.createFormGroup({ label, required, children: [select] });
    }
    
    return select;
  },

  // Card container
  createCard(options = {}) {
    const { title, className = '', children = [] } = options;
    
    const card = this.createElement('div', {
      className: `bg-white rounded-lg shadow-md p-6 ${className}`
    });
    
    if (title) {
      const titleElement = this.createElement('h3', {
        className: 'text-xl font-semibold mb-4',
        textContent: title
      });
      card.appendChild(titleElement);
    }
    
    children.forEach(child => card.appendChild(child));
    
    return card;
  },

  // Modal
  createModal(options = {}) {
    const { title, className = '', onClose = null, children = [] } = options;
    
    const backdrop = this.createElement('div', {
      className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
      onClick: (e) => {
        if (e.target === backdrop && onClose) {
          onClose();
        }
      }
    });
    
    const modal = this.createElement('div', {
      className: `bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4 ${className}`
    });
    
    if (title) {
      const titleElement = this.createElement('h3', {
        className: 'text-xl font-bold mb-4',
        textContent: title
      });
      modal.appendChild(titleElement);
    }
    
    children.forEach(child => modal.appendChild(child));
    backdrop.appendChild(modal);
    
    // ESC key handler
    const handleEscape = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
    
    return backdrop;
  },

  // Status badge
  createBadge(options = {}) {
    const { text, variant = 'default', className = '' } = options;
    
    const variants = {
      default: 'bg-gray-100 text-gray-800',
      success: 'bg-green-100 text-green-800',
      warning: 'bg-yellow-100 text-yellow-800',
      danger: 'bg-red-100 text-red-800',
      info: 'bg-blue-100 text-blue-800'
    };
    
    return this.createElement('span', {
      className: `px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${variants[variant]} ${className}`,
      textContent: text
    });
  },

  // Empty state
  createEmptyState(options = {}) {
    const { icon, title, description, action, className = '' } = options;
    
    const container = this.createElement('div', {
      className: `text-center py-12 ${className}`
    });
    
    if (icon) {
      const iconContainer = this.createElement('div', {
        className: 'mx-auto h-12 w-12 text-gray-400 mb-4'
      });
      iconContainer.appendChild(this.createIcon(icon, 'h-12 w-12'));
      container.appendChild(iconContainer);
    }
    
    if (title) {
      const titleElement = this.createElement('h3', {
        className: 'text-lg font-medium text-gray-900 mb-2',
        textContent: title
      });
      container.appendChild(titleElement);
    }
    
    if (description) {
      const descElement = this.createElement('p', {
        className: 'text-gray-500 mb-6',
        textContent: description
      });
      container.appendChild(descElement);
    }
    
    if (action) {
      container.appendChild(action);
    }
    
    return container;
  },

  // Loading state
  createLoadingState(text = 'Loading...') {
    const container = this.createElement('div', {
      className: 'flex items-center justify-center py-12'
    });
    
    container.appendChild(this.createSpinner('mr-4'));
    container.appendChild(this.createElement('p', {
      className: 'text-gray-600',
      textContent: text
    }));
    
    return container;
  },

  // Error state
  createErrorState(options = {}) {
    const { title = 'Error', message, onRetry } = options;
    
    const container = this.createElement('div', {
      className: 'text-center py-12'
    });
    
    const iconContainer = this.createElement('div', {
      className: 'mx-auto h-12 w-12 text-red-400 mb-4'
    });
    iconContainer.appendChild(this.createIcon('alert-circle', 'h-12 w-12'));
    container.appendChild(iconContainer);
    
    container.appendChild(this.createElement('h3', {
      className: 'text-lg font-medium text-gray-900 mb-2',
      textContent: title
    }));
    
    if (message) {
      container.appendChild(this.createElement('p', {
        className: 'text-gray-500 mb-6',
        textContent: message
      }));
    }
    
    if (onRetry) {
      container.appendChild(this.createButton({
        text: 'Retry',
        variant: 'danger',
        onClick: onRetry
      }));
    }
    
    return container;
  }
};

// =============================================================================
// PAGE RENDERING MODULES
// =============================================================================

const PageRenderer = {
  // Landing Page
  renderLandingPage() {
    const authState = getAuthState();
    
    const container = UIBuilder.createElement('div', {
      className: 'text-center py-10'
    });
    
    // Icons section
    const iconSection = UIBuilder.createElement('div', {
      className: 'flex justify-center mb-8'
    });
    iconSection.appendChild(UIBuilder.createIcon('map', 'w-16 h-16 text-blue-600'));
    iconSection.appendChild(UIBuilder.createIcon('flag', 'w-16 h-16 ml-4 text-green-600'));
    container.appendChild(iconSection);
    
    // Title and description
    container.appendChild(UIBuilder.createElement('h2', {
      className: 'text-3xl font-bold mb-4',
      textContent: 'Welcome to QR Conquest!'
    }));
    
    container.appendChild(UIBuilder.createElement('p', {
      className: 'mb-8',
      textContent: 'Scan QR codes, capture bases, and score points for your team.'
    }));
    
    // Button container
    const buttonContainer = UIBuilder.createElement('div', {
      className: 'flex flex-col space-y-4 max-w-xs mx-auto'
    });
    
    if (authState.hasGame) {
      // Game-specific buttons
      buttonContainer.appendChild(UIBuilder.createElement('p', {
        className: 'mb-6 text-sm text-gray-600',
        textContent: 'To join a team, you must scan its QR code. Ask the game host for team QR codes.'
      }));
      
      buttonContainer.appendChild(UIBuilder.createButton({
        text: 'Scan Team QR Code',
        onClick: () => navigateTo('scanQR')
      }));
      
      if (authState.hasTeam) {
        buttonContainer.appendChild(UIBuilder.createButton({
          text: 'Continue Game',
          variant: 'success',
          onClick: () => navigateTo('gameView')
        }));
      }
      
      if (authState.isHost) {
        buttonContainer.appendChild(UIBuilder.createButton({
          text: 'Game Management',
          variant: 'purple',
          onClick: () => navigateTo('hostPanel')
        }));
      }
      
      buttonContainer.appendChild(UIBuilder.createButton({
        text: 'Leave Game',
        variant: 'secondary',
        onClick: clearGameData
      }));
      
    } else if (authState.isHost) {
      // Host-specific buttons
      const welcomeText = UIBuilder.createElement('p', {
        className: 'mb-6 text-purple-700',
        textContent: `Welcome, ${authState.hostName || 'Host'}!`
      });
      buttonContainer.appendChild(welcomeText);
      
      buttonContainer.appendChild(UIBuilder.createButton({
        text: 'Host a Game',
        variant: 'purple',
        onClick: () => navigateTo('hostPanel')
      }));
      
      buttonContainer.appendChild(UIBuilder.createButton({
        text: 'Scan QR Code',
        onClick: () => navigateTo('scanQR')
      }));
      
      buttonContainer.appendChild(UIBuilder.createButton({
        text: 'Logout',
        variant: 'secondary',
        onClick: clearGameData
      }));
      
    } else {
      // General user buttons
      buttonContainer.appendChild(UIBuilder.createButton({
        text: 'Scan QR Code',
        onClick: () => navigateTo('scanQR')
      }));
      
      const hostInfo = UIBuilder.createElement('p', {
        className: 'text-sm text-gray-600 mt-2 text-center'
      });
      hostInfo.appendChild(document.createTextNode('Are you a game host?'));
      hostInfo.appendChild(UIBuilder.createElement('br'));
      
      const hostSpan = UIBuilder.createElement('span', {
        className: 'text-purple-600',
        textContent: 'Scan your host QR code above'
      });
      hostInfo.appendChild(hostSpan);
      buttonContainer.appendChild(hostInfo);
    }
    
    container.appendChild(buttonContainer);
    return container;
  },

  // Game View
  renderGameView() {
    const container = UIBuilder.createElement('div');
    
    // Scoreboard section
    const scoreboardSection = UIBuilder.createElement('div', { className: 'mb-6' });
    scoreboardSection.appendChild(UIBuilder.createElement('h2', {
      className: 'text-2xl font-bold mb-2',
      textContent: 'Scoreboard'
    }));
    
    const scoreboardCard = UIBuilder.createCard({ className: 'p-4' });
    
    if (appState.gameData.teams && appState.gameData.teams.length > 0) {
      const sortedTeams = [...appState.gameData.teams].sort((a, b) => (b.score || 0) - (a.score || 0));
      
      sortedTeams.forEach(team => {
        const teamRow = UIBuilder.createElement('div', {
          className: 'flex justify-between py-2 border-b last:border-b-0'
        });
        
        const teamInfo = UIBuilder.createElement('div', {
          className: 'flex items-center'
        });
        
        teamInfo.appendChild(UIBuilder.createElement('div', {
          className: `w-4 h-4 rounded-full ${team.color} mr-2`
        }));
        
        teamInfo.appendChild(UIBuilder.createElement('span', {
          className: 'font-medium',
          textContent: team.name
        }));
        
        teamRow.appendChild(teamInfo);
        teamRow.appendChild(UIBuilder.createElement('span', {
          className: 'font-bold',
          textContent: `${team.score || 0} pts`
        }));
        
        scoreboardCard.appendChild(teamRow);
      });
    } else {
      scoreboardCard.appendChild(UIBuilder.createElement('p', {
        className: 'text-center text-gray-600',
        textContent: 'No teams available'
      }));
    }
    
    scoreboardSection.appendChild(scoreboardCard);
    container.appendChild(scoreboardSection);
    
    // Map section
    const mapSection = UIBuilder.createElement('div', { className: 'mb-6' });
    mapSection.appendChild(UIBuilder.createElement('h2', {
      className: 'text-2xl font-bold mb-2',
      textContent: 'Map'
    }));
    
    const mapContainer = UIBuilder.createElement('div', {
      id: 'map-container',
      className: 'bg-gray-200 rounded-lg shadow-md h-80 md:h-96 relative'
    });
    mapSection.appendChild(mapContainer);
    container.appendChild(mapSection);
    
    // Action buttons
    const buttonContainer = UIBuilder.createElement('div', { className: 'flex gap-4' });
    buttonContainer.appendChild(UIBuilder.createButton({
      text: 'Scan QR Code',
      variant: 'success',
      className: 'flex-1',
      icon: 'qr-code',
      onClick: () => navigateTo('scanQR')
    }));
    container.appendChild(buttonContainer);
    
    // Initialize map after render
    setTimeout(() => initGameMap(), 0);
    
    return container;
  },

  // Loading Screen
  renderLoadingScreen() {
    const container = UIBuilder.createElement('div', {
      className: 'flex flex-col items-center justify-center h-64'
    });
    
    container.appendChild(UIBuilder.createSpinner('h-12 w-12 mb-4'));
    container.appendChild(UIBuilder.createElement('p', {
      textContent: 'Loading...'
    }));
    
    return container;
  },

  // Error Screen
  renderErrorScreen() {
    const container = UIBuilder.createElement('div', {
      className: 'bg-red-100 border border-red-400 rounded p-4 text-center'
    });
    
    container.appendChild(UIBuilder.createElement('h2', {
      className: 'text-xl font-bold text-red-800 mb-2',
      textContent: 'Error'
    }));
    
    container.appendChild(UIBuilder.createElement('p', {
      className: 'text-red-700 mb-4',
      textContent: appState.error
    }));
    
    container.appendChild(UIBuilder.createButton({
      text: 'Dismiss',
      onClick: clearError
    }));
    
    return container;
  },

  // First Time Page
  renderFirstTimePage() {
    const container = UIBuilder.createElement('div', {
      className: 'text-center py-10'
    });
    
    container.appendChild(UIBuilder.createElement('h2', {
      className: 'text-3xl font-bold mb-4',
      textContent: 'Welcome to QR Conquest!'
    }));
    
    container.appendChild(UIBuilder.createElement('p', {
      className: 'mb-8',
      textContent: 'You\'ve scanned a QR code, but you\'re not currently part of any game.'
    }));
    
    const qrDisplay = UIBuilder.createElement('div', {
      className: 'bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-6 inline-block',
      textContent: `QR Code: ${appState.pendingQRCode}`
    });
    container.appendChild(qrDisplay);
    
    const buttonContainer = UIBuilder.createElement('div', {
      className: 'flex flex-col space-y-4 max-w-xs mx-auto'
    });
    
    buttonContainer.appendChild(UIBuilder.createButton({
      text: 'Join a Game',
      onClick: () => {
        sessionStorage.setItem('pendingQRCode', appState.pendingQRCode);
        navigateTo('joinGame');
      }
    }));
    
    buttonContainer.appendChild(UIBuilder.createButton({
      text: 'Create a New Game',
      variant: 'success',
      onClick: () => {
        sessionStorage.setItem('pendingQRCode', appState.pendingQRCode);
        navigateTo('hostPanel');
      }
    }));
    
    container.appendChild(buttonContainer);
    
    const noteContainer = UIBuilder.createElement('div', {
      className: 'mt-6 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded-lg text-left text-sm max-w-xs mx-auto'
    });
    
    const noteText = UIBuilder.createElement('p');
    noteText.appendChild(UIBuilder.createElement('strong', { textContent: 'Note:' }));
    noteText.appendChild(document.createTextNode(' In QR Conquest, all teams and bases are created by scanning QR codes first. This QR code can be used later to create a team or base after you join or create a game.'));
    noteContainer.appendChild(noteText);
    container.appendChild(noteContainer);
    
    return container;
  },

  // Join Game Page
  renderJoinGamePage() {
    const container = UIBuilder.createElement('div', {
      className: 'max-w-md mx-auto py-8'
    });
    
    container.appendChild(UIBuilder.createElement('h2', {
      className: 'text-2xl font-bold mb-6 text-center',
      textContent: 'Join a Game'
    }));
    
    const card = UIBuilder.createCard();
    const form = UIBuilder.createElement('form', {
      onSubmit: (e) => {
        e.preventDefault();
        const gameId = e.target.querySelector('#game-id').value.trim();
        if (!gameId) {
          showNotification('Please enter a valid Game ID', 'warning');
          return;
        }

        localStorage.setItem('gameId', gameId);
        fetchGameData(gameId).then(() => {
          const pendingQR = sessionStorage.getItem('pendingQRCode');
          if (pendingQR) {
            handleQRScan(pendingQR);
            sessionStorage.removeItem('pendingQRCode');
          } else {
            navigateTo('scanQR');
          }
        });
      }
    });
    
    form.appendChild(UIBuilder.createInput({
      id: 'game-id',
      label: 'Game ID',
      type: 'text',
      required: true
    }));
    
    form.appendChild(UIBuilder.createButton({
      text: 'Join Game',
      type: 'submit',
      className: 'w-full'
    }));
    
    card.appendChild(form);
    container.appendChild(card);
    
    container.appendChild(UIBuilder.createButton({
      text: '← Back to Home',
      variant: 'secondary',
      className: 'text-blue-600 hover:underline mt-4',
      onClick: () => navigateTo('landing')
    }));
    
    return container;
  }
};

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
    appState.gameData.hostId = authState.hostId;
    appState.gameData.hostName = authState.hostName;
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
// QR SCANNER FUNCTIONALITY
// =============================================================================

function renderQRScanner() {
  const authState = getAuthState();
  const title = appState.page === 'qrAssignment' ? 'Scan QR Code to Assign' : 'Scan QR Code';

  const container = UIBuilder.createElement('div', {
    className: 'text-center'
  });

  container.appendChild(UIBuilder.createElement('h2', {
    className: 'text-2xl font-bold mb-6',
    textContent: title
  }));

  // Instructions for host mode
  if (authState.isHost) {
    const instructions = UIBuilder.createElement('div', {
      className: 'bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-4'
    });
    
    instructions.appendChild(UIBuilder.createElement('p', {
      className: 'font-bold',
      textContent: 'Host Instructions:'
    }));
    
    instructions.appendChild(UIBuilder.createElement('p', {
      textContent: 'Scan a QR code to create a new team or base. All team and base creation must start by scanning a QR code first.'
    }));
    
    container.appendChild(instructions);
  }

  // Main QR scanner UI
  const scannerCard = UIBuilder.createCard({ className: 'mb-6' });

  // Camera container
  const cameraContainer = UIBuilder.createElement('div', {
    className: 'relative bg-gray-900 rounded-lg overflow-hidden mb-4',
    style: { height: '350px', maxWidth: '100%', margin: '0 auto' }
  });

  const video = UIBuilder.createElement('video', {
    id: 'qr-video',
    className: 'w-full h-full object-cover',
    playsInline: true,
    autoplay: true,
    muted: true
  });
  cameraContainer.appendChild(video);

  const canvas = UIBuilder.createElement('canvas', {
    id: 'qr-canvas',
    style: { display: 'none' }
  });
  cameraContainer.appendChild(canvas);

  // Scanner overlay
  const overlay = UIBuilder.createElement('div', {
    className: 'absolute inset-0 flex items-center justify-center'
  });
  overlay.appendChild(UIBuilder.createElement('div', {
    className: 'border-2 border-blue-500 rounded-lg w-64 h-64 opacity-60'
  }));
  cameraContainer.appendChild(overlay);

  // Loading indicator
  const loadingIndicator = UIBuilder.createElement('div', {
    id: 'camera-loading',
    className: 'absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white'
  });
  loadingIndicator.appendChild(UIBuilder.createSpinner('mb-2'));
  loadingIndicator.appendChild(UIBuilder.createElement('p', {
    className: 'text-sm',
    textContent: 'Accessing camera...'
  }));
  cameraContainer.appendChild(loadingIndicator);

  scannerCard.appendChild(cameraContainer);

  // Camera selection
  const cameraGroup = UIBuilder.createElement('div', { className: 'mb-4' });
  cameraGroup.appendChild(UIBuilder.createElement('label', {
    htmlFor: 'camera-select',
    className: 'block text-sm font-medium text-gray-700 mb-1',
    textContent: 'Select camera:'
  }));
  
  const cameraSelect = UIBuilder.createElement('select', {
    id: 'camera-select',
    className: 'w-full px-3 py-2 border rounded-lg text-sm'
  });
  cameraGroup.appendChild(cameraSelect);
  scannerCard.appendChild(cameraGroup);

  // Status message
  const statusMessage = UIBuilder.createElement('p', {
    id: 'qr-status',
    className: 'text-sm mb-2 h-6 text-gray-600',
    textContent: 'Position QR code within the frame'
  });
  scannerCard.appendChild(statusMessage);

  // Manual input fallback
  const manualSection = UIBuilder.createElement('div', {
    className: 'mt-4 pt-4 border-t border-gray-200'
  });
  
  manualSection.appendChild(UIBuilder.createElement('p', {
    className: 'text-sm font-medium text-gray-700 mb-2',
    textContent: 'Or enter QR code manually:'
  }));
  
  const inputContainer = UIBuilder.createElement('div', { className: 'flex space-x-2' });
  
  const manualInput = UIBuilder.createElement('input', {
    type: 'text',
    id: 'manual-qr-input',
    className: 'flex-1 px-3 py-2 border rounded-lg text-sm',
    placeholder: 'Enter QR code value'
  });
  inputContainer.appendChild(manualInput);
  
  const submitButton = UIBuilder.createButton({
    text: 'Submit',
    onClick: () => {
      const qrCode = manualInput.value.trim();
      if (!qrCode) {
        setStatusMessage('Please enter a QR code value', 'error');
        return;
      }
      
      const context = appState.page === 'qrAssignment' ? 'assignment' : 'scan';
      handleQRCode(qrCode, context);
    }
  });
  inputContainer.appendChild(submitButton);
  
  manualSection.appendChild(inputContainer);
  scannerCard.appendChild(manualSection);
  container.appendChild(scannerCard);

  // Action buttons
  const buttonContainer = UIBuilder.createElement('div', { className: 'flex gap-4' });
  buttonContainer.appendChild(UIBuilder.createButton({
    text: 'Cancel',
    variant: 'secondary',
    className: 'flex-1',
    onClick: () => {
      stopCamera();
      if (appState.page === 'qrAssignment') {
        navigateTo('hostPanel');
      } else if (authState.isHost) {
        navigateTo('hostPanel');
      } else {
        navigateTo('gameView');
      }
    }
  }));
  container.appendChild(buttonContainer);

  // Setup QR scanner after render
  setTimeout(initQRScanner, 100);

  return container;

  // Helper function to set status message with optional styling
  function setStatusMessage(message, type = 'info') {
    const statusElem = document.getElementById('qr-status');
    if (!statusElem) return;

    statusElem.textContent = message;
    statusElem.className = 'text-sm mb-2 h-6';

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
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');

      const cameraSelect = document.getElementById('camera-select');
      if (cameraSelect) {
        cameraSelect.innerHTML = '';

        videoDevices.forEach(device => {
          const option = UIBuilder.createElement('option', {
            value: device.deviceId,
            textContent: device.label || `Camera ${cameraSelect.options.length + 1}`
          });
          cameraSelect.appendChild(option);
        });

        const backCamera = videoDevices.find(device =>
          device.label.toLowerCase().includes('back') ||
          device.label.toLowerCase().includes('rear')
        );

        if (backCamera) {
          cameraSelect.value = backCamera.deviceId;
          activeDeviceId = backCamera.deviceId;
        }

        cameraSelect.addEventListener('change', function () {
          activeDeviceId = this.value;
          startCamera(activeDeviceId);
        });
      }

      startCamera(activeDeviceId);

    } catch (error) {
      console.error('Error initializing camera:', error);
      setStatusMessage('Error accessing camera: ' + error.message, 'error');

      const loadingElem = document.getElementById('camera-loading');
      if (loadingElem) loadingElem.style.display = 'none';
    }
  }

  // Start camera with specific device ID
  async function startCamera(deviceId) {
    try {
      stopCamera();

      const loadingElem = document.getElementById('camera-loading');
      if (loadingElem) loadingElem.style.display = 'flex';

      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      if (deviceId) {
        constraints.video.deviceId = { exact: deviceId };
      }

      videoStream = await navigator.mediaDevices.getUserMedia(constraints);

      const videoElement = document.getElementById('qr-video');
      if (videoElement) {
        videoElement.srcObject = videoStream;
        videoElement.play();

        videoElement.onloadedmetadata = function () {
          if (loadingElem) loadingElem.style.display = 'none';
          startScanning();
        };
      }
    } catch (error) {
      console.error('Error starting camera:', error);
      setStatusMessage('Error starting camera: ' + error.message, 'error');

      const loadingElem = document.getElementById('camera-loading');
      if (loadingElem) loadingElem.style.display = 'none';
    }
  }

  // Stop camera and cleanup
  function stopCamera() {
    scanning = false;

    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      videoStream = null;
    }

    const videoElement = document.getElementById('qr-video');
    if (videoElement && videoElement.srcObject) {
      videoElement.srcObject = null;
    }
  }

  // Start QR code scanning
  function startScanning() {
    scanning = true;

    if ('BarcodeDetector' in window) {
      scanWithBarcodeDetector();
    } else {
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
          canvasElement.width = videoElement.videoWidth;
          canvasElement.height = videoElement.videoHeight;

          const context = canvasElement.getContext('2d');
          context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

          try {
            const barcodes = await barcodeDetector.detect(canvasElement);

            if (barcodes.length > 0) {
              const qrCode = barcodes[0].rawValue;
              setStatusMessage('QR Code detected!', 'success');
              stopCamera();
              
              const context = appState.page === 'qrAssignment' ? 'assignment' : 'scan';
              setTimeout(() => handleQRCode(qrCode, context), 500);
              return;
            }
          } catch (err) {
            console.error('Barcode detection error:', err);
          }
        }

        requestAnimationFrame(scanFrame);
      };

      scanFrame();

    } catch (error) {
      console.error('BarcodeDetector error:', error);
      loadJsQR();
    }
  }

  // Load the jsQR library and scan with it
  function loadJsQR() {
    if (window.jsQR) {
      scanWithJsQR();
      return;
    }

    setStatusMessage('Loading QR scanner...');

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
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;

        const context = canvasElement.getContext('2d');
        context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

        const imageData = context.getImageData(0, 0, canvasElement.width, canvasElement.height);

        const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (code) {
          const qrCode = code.data;
          setStatusMessage('QR Code detected!', 'success');
          stopCamera();
          
          const context = appState.page === 'qrAssignment' ? 'assignment' : 'scan';
          setTimeout(() => handleQRCode(qrCode, context), 500);
          return;
        }
      }

      requestAnimationFrame(scanFrame);
    };

    scanFrame();
  }
}

// =============================================================================
// MAP FUNCTIONALITY
// =============================================================================

let gameMapInstance = null;

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
    'bg-gray-400': '#9ca3af',
    'bg-gray-500': '#6b7280'
  };
  return colorMap[tailwindColorClass] || colorMap['bg-gray-500'];
}

function initGameMap() {
  const mapElement = document.getElementById('map-container');
  if (!mapElement) {
    console.error('Map container (map-container) not found.');
    return;
  }

  if (gameMapInstance) {
    gameMapInstance.remove();
    gameMapInstance = null;
  }

  if (!appState.gameData.bases || appState.gameData.bases.length === 0) {
    mapElement.innerHTML = `<div class="flex items-center justify-center h-full text-gray-600">No bases to display on the map.</div>`;
    return;
  }

  gameMapInstance = L.map(mapElement);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(gameMapInstance);

  const latLngs = [];
  const markers = [];

  appState.gameData.bases.forEach(base => {
    if (typeof base.lat !== 'number' || typeof base.lng !== 'number') {
      console.warn('Base has invalid coordinates:', base.name, base.lat, base.lng);
      return;
    }
    const latLng = [base.lat, base.lng];
    latLngs.push(latLng);

    let markerColor = getHexColorForTailwind('bg-gray-400');
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
      radius: 15,
      fillColor: markerColor,
      color: '#000000',
      weight: 1,
      opacity: 1,
      fillOpacity: 0.75
    }).addTo(gameMapInstance);

    circleMarker.bindPopup(popupContent);
    circleMarker.baseId = base.id;
    markers.push(circleMarker);
  });

  gameMapInstance.baseMarkers = markers;

  if (latLngs.length > 0) {
    const bounds = L.latLngBounds(latLngs);
    gameMapInstance.fitBounds(bounds.pad(0.2));
  } else {
    gameMapInstance.setView([55.94763, -3.16202], 16);
    mapElement.innerHTML = `<div class="flex items-center justify-center h-full text-gray-600">No valid bases to display on the map.</div>`;
  }
}

function updateMapMarkers() {
  if (!gameMapInstance || !appState.gameData.bases || appState.gameData.bases.length === 0) {
    return;
  }

  if (!gameMapInstance.baseMarkers) {
    console.warn('No markers to update. Reinitialize map.');
    initGameMap()
    return;
  }

  appState.gameData.bases.forEach(base => {
    const marker = gameMapInstance.baseMarkers.find(m => m.baseId === base.id);
    if (!marker) return;

    let markerColor = getHexColorForTailwind('bg-gray-400');
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

    marker.setStyle({
      fillColor: markerColor
    });

    marker.getPopup().setContent(popupContent);
  });
}

// =============================================================================
// MAIN RENDER FUNCTION
// =============================================================================

function renderApp() {
  console.log('Rendering app, current page:', appState.page);

  if (window.renderingInProgress) {
    console.warn('Render already in progress, preventing loop');
    return;
  }
  window.renderingInProgress = true;

  try {
    elements.root.innerHTML = '';

    // Add header
    const header = UIBuilder.createElement('header', {
      className: 'bg-blue-600 text-white p-4 shadow-md relative'
    });

    const headerContent = UIBuilder.createElement('div', {
      className: 'flex justify-between items-start'
    });

    // Left section: Title and status
    const leftSection = UIBuilder.createElement('div', { className: 'flex-1' });
    leftSection.appendChild(UIBuilder.createElement('h1', {
      className: 'text-2xl font-bold',
      textContent: appState.gameData.name || 'QR Conquest'
    }));

    if (appState.gameData.status === 'active') {
      const statusContainer = UIBuilder.createElement('div', {
        className: 'flex justify-between items-center mt-1'
      });
      
      statusContainer.appendChild(UIBuilder.createElement('p', {
        className: 'text-sm',
        textContent: 'Game in progress'
      }));

      if (appState.gameData.currentTeam) {
        statusContainer.appendChild(UIBuilder.createElement('p', {
          className: 'text-sm',
          textContent: 'Team: ' + getTeamName(appState.gameData.currentTeam)
        }));
      }
      
      leftSection.appendChild(statusContainer);
    }

    headerContent.appendChild(leftSection);

    // Right section: Admin button
    const rightSection = UIBuilder.createElement('div', {
      className: 'flex items-center'
    });

    if (appState.page.startsWith('siteAdmin')) {
      rightSection.appendChild(UIBuilder.createBadge({
        text: 'Site Admin',
        className: 'bg-purple-800 text-white py-1 px-3 rounded-lg text-sm'
      }));
    } else {
      const hostButton = UIBuilder.createButton({
        text: 'Host Menu',
        variant: 'secondary',
        className: 'bg-white bg-opacity-20 hover:bg-opacity-30 text-white',
        icon: 'shield',
        onClick: handleHostButtonClick
      });
      rightSection.appendChild(hostButton);
    }

    headerContent.appendChild(rightSection);
    header.appendChild(headerContent);
    elements.root.appendChild(header);

    // Main content container
    const main = UIBuilder.createElement('main', { className: 'p-4' });
    
    let content;
    if (appState.loading) {
      content = PageRenderer.renderLoadingScreen();
    } else if (appState.error) {
      content = PageRenderer.renderErrorScreen();
    } else {
      switch (appState.page) {
        case 'landing': 
          content = PageRenderer.renderLandingPage(); 
          break;
        case 'gameView': 
          content = PageRenderer.renderGameView(); 
          break;
        case 'hostPanel': 
          content = renderHostPanel(); 
          break;
        case 'scanQR': 
          content = renderQRScanner(); 
          break;
        case 'results': 
          content = renderResultsPage(); 
          break;
        case 'qrAssignment': 
          content = renderQRAssignmentPage(); 
          break;
        case 'playerRegistration': 
          content = renderPlayerRegistrationPage(); 
          break;
        case 'firstTime': 
          content = PageRenderer.renderFirstTimePage(); 
          break;
        case 'joinGame': 
          content = PageRenderer.renderJoinGamePage(); 
          break;
        case 'siteAdminLogin': 
          content = renderSiteAdminLogin(); 
          break;
        case 'siteAdminPanel': 
          content = renderSiteAdminPanel(); 
          break;
        default: 
          content = PageRenderer.renderLandingPage();
      }
    }
    
    main.appendChild(content);
    elements.root.appendChild(main);

    // Add footer
    const footer = UIBuilder.createElement('footer', {
      className: 'bg-gray-200 p-4 text-center text-sm text-gray-600'
    });

    const footerContent = UIBuilder.createElement('div', {
      className: 'flex justify-between items-center'
    });

    footerContent.appendChild(UIBuilder.createElement('div', {
      textContent: 'QR Conquest © 2025'
    }));

    const adminLink = UIBuilder.createElement('a', {
      className: 'text-gray-500 hover:text-gray-700 text-xs',
      href: '#',
      textContent: 'Site Administration',
      onClick: (e) => { 
        e.preventDefault(); 
        navigateTo('siteAdminLogin'); 
      }
    });
    footerContent.appendChild(adminLink);

    footer.appendChild(footerContent);
    elements.root.appendChild(footer);

    // Initialize Lucide icons if available
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  } finally {
    window.renderingInProgress = false;
  }
}

// =============================================================================
// HOST BUTTON FUNCTIONALITY
// =============================================================================

function handleHostButtonClick() {
  const authState = getAuthState();
  if (authState.isHost) {
    navigateTo('hostPanel');
  } else {
    showHostScanPrompt();
  }
}

function showHostScanPrompt() {
  const modal = UIBuilder.createModal({
    title: 'Host Authentication',
    onClose: () => document.body.removeChild(modal)
  });

  const content = UIBuilder.createElement('div');
  content.appendChild(UIBuilder.createElement('p', {
    className: 'mb-4 text-gray-600',
    textContent: 'Scan your host QR code to access the game management features.'
  }));

  content.appendChild(UIBuilder.createButton({
    text: 'Scan Host QR Code',
    className: 'w-full mb-4',
    icon: 'qr-code',
    onClick: () => {
      document.body.removeChild(modal);
      navigateTo('scanQR');
    }
  }));

  content.appendChild(UIBuilder.createButton({
    text: 'Cancel',
    variant: 'secondary',
    className: 'w-full',
    onClick: () => document.body.removeChild(modal)
  }));

  // Find the modal content div and append our content
  const modalContent = modal.querySelector('.bg-white');
  modalContent.appendChild(content);

  document.body.appendChild(modal);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// =============================================================================
// PWA INSTALLATION AND OFFLINE SUPPORT
// =============================================================================

let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallButton();
});

function showInstallButton() {
  if (!deferredPrompt || appState.page !== 'landing') return;

  const container = document.querySelector('.flex.flex-col.space-y-4');
  if (!container || document.getElementById('pwa-install-btn')) return;

  const installButton = UIBuilder.createButton({
    text: 'Install QR Conquest',
    variant: 'purple',
    className: 'w-full',
    icon: 'download',
    onClick: showInstallPrompt
  });
  installButton.id = 'pwa-install-btn';

  container.prepend(installButton);
  if (window.lucide) window.lucide.createIcons();
}

function showInstallPrompt() {
  if (!deferredPrompt) return;

  deferredPrompt.prompt();
  deferredPrompt.userChoice.then((choiceResult) => {
    if (choiceResult.outcome === 'accepted') {
      console.log('User accepted the install prompt');
      showNotification('QR Conquest has been installed! For the best experience, please restart the app.', 'success');
    } else {
      console.log('User dismissed the install prompt');
    }

    deferredPrompt = null;
    const installButton = document.getElementById('pwa-install-btn');
    if (installButton) installButton.remove();
  });
}

// Online/offline status handling
function setupOnlineStatusMonitoring() {
  window.addEventListener('online', function () {
    console.log('App is now online');
    showNotification('You are back online', 'success');
    updateOnlineStatus(true);

    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready
        .then(registration => registration.sync.register('sync-captures'))
        .catch(err => console.error('Background sync registration failed:', err));
    }
  });

  window.addEventListener('offline', function () {
    console.log('App is now offline');
    showNotification('You are offline. Some features may be limited.', 'warning');
    updateOnlineStatus(false);
  });

  updateOnlineStatus(navigator.onLine);
}

function updateOnlineStatus(isOnline) {
  let statusIndicator = document.getElementById('online-status-indicator');

  if (!statusIndicator) {
    statusIndicator = UIBuilder.createElement('div', {
      id: 'online-status-indicator',
      className: 'fixed bottom-2 right-2 z-50 px-3 py-1 rounded-full text-xs font-medium flex items-center'
    });

    const statusDot = UIBuilder.createElement('span', {
      id: 'status-dot',
      className: 'w-2 h-2 rounded-full mr-1'
    });
    statusIndicator.appendChild(statusDot);

    const statusText = UIBuilder.createElement('span', {
      id: 'status-text'
    });
    statusIndicator.appendChild(statusText);

    document.body.appendChild(statusIndicator);
  }

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

document.addEventListener('DOMContentLoaded', setupOnlineStatusMonitoring);

// =============================================================================
// GLOBAL INTERFACE FUNCTIONS
// =============================================================================

window.navigateTo = navigateTo;
window.renderApp = renderApp;
window.updateMapMarkers = updateMapMarkers;