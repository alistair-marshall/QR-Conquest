// Site Admin module for managing hosts - UI components only, API calls handled by core.js

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

// Site admin logout - UI handling only
function logoutSiteAdmin() {
  // Reset site admin state - core.js handles this
  appState.siteAdmin.isAuthenticated = false;
  appState.siteAdmin.token = null;
  clearSiteAdminData(); // Clear data on logout
  
  navigateTo('landing');
  showNotification('Logged out successfully', 'info');
}

// Render site admin login page
function renderSiteAdminLogin() {
  const container = UIBuilder.createElement('div', { className: 'max-w-md mx-auto py-8' });

  // Title
  const title = UIBuilder.createElement('h2', {
    className: 'text-2xl font-bold mb-6 text-center',
    textContent: 'Site Administration'
  });
  container.appendChild(title);

  // Login form
  const form = UIBuilder.createElement('form', {
    className: 'bg-white rounded-lg shadow-md p-6 mb-6'
  });

  // Password field
  const passwordGroup = UIBuilder.createElement('div', { className: 'mb-4' });

  const passwordLabel = UIBuilder.createElement('label', {
    className: 'block text-gray-700 text-sm font-bold mb-2',
    htmlFor: 'site-admin-password',
    textContent: 'Admin Password'
  });
  passwordGroup.appendChild(passwordLabel);

  const passwordInput = UIBuilder.createElement('input', {
    type: 'password',
    id: 'site-admin-password',
    className: 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-purple-500',
    required: true,
    placeholder: 'Enter admin password'
  });
  passwordGroup.appendChild(passwordInput);

  form.appendChild(passwordGroup);

  // Login button
  const loginButton = UIBuilder.createButton('Login', null, 'w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors');
  loginButton.type = 'submit';
  form.appendChild(loginButton);

  // Handle form submission
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const password = passwordInput.value.trim();
    if (!password) {
      showNotification('Please enter the admin password', 'warning');
      return;
    }

    // Call the API function from core.js
    const success = await authenticateSiteAdmin(password);
    if (success) {
      navigateTo('siteAdminPanel');
    }
  });

  container.appendChild(form);

  // Security notice
  const securityNotice = UIBuilder.createElement('div', {
    className: 'bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm mb-6'
  });
  const noticeTitle = UIBuilder.createElement('strong', { textContent: 'Security Notice:' });
  securityNotice.appendChild(noticeTitle);
  securityNotice.appendChild(document.createTextNode(' This is a restricted admin area. Access is logged and monitored.'));
  container.appendChild(securityNotice);

  // Back to Home link
  const backLink = UIBuilder.createElement('div', { className: 'text-center' });

  const backButton = UIBuilder.createButton('Back to Home', function() { 
    navigateTo('landing'); 
  }, 'text-purple-600 hover:text-purple-800 underline');
  backLink.appendChild(backButton);

  container.appendChild(backLink);

  // Auto-focus password input
  setTimeout(() => passwordInput.focus(), 100);

  return container;
}

// Render site admin panel
function renderSiteAdminPanel() {
    if (!appState.siteAdmin.isAuthenticated) {
        return renderSiteAdminLogin();
    }

    const container = UIBuilder.createElement('div', { className: 'max-w-6xl mx-auto py-8' });

    // Title and summary - build immediately
    const headerSection = UIBuilder.createElement('div', {
      className: 'flex justify-between items-center mb-6'
    });

    const titleSection = UIBuilder.createElement('div');
    const title = UIBuilder.createElement('h2', {
      className: 'text-3xl font-bold text-gray-900',
      textContent: 'Site Administration'
    });
    titleSection.appendChild(title);

    const subtitle = UIBuilder.createElement('p', {
      className: 'text-gray-600 mt-1',
      textContent: 'Manage hosts and games across the system'
    });
    titleSection.appendChild(subtitle);

    headerSection.appendChild(titleSection);

    // Logout button
    const logoutButton = UIBuilder.createButton('Logout', logoutSiteAdmin, 'bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors');
    headerSection.appendChild(logoutButton);

    container.appendChild(headerSection);

    // Add navigation tabs for Hosts and Games
    const tabsSection = UIBuilder.createElement('div', { className: 'mb-6' });
    
    const tabsContainer = UIBuilder.createElement('div', {
      className: 'border-b border-gray-200'
    });
    
    const tabsList = UIBuilder.createElement('nav', { className: 'flex space-x-8' });
    
    // Hosts tab
    const hostsTab = UIBuilder.createButton('Host Management', null, 'py-2 px-1 border-b-2 font-medium text-sm');
    hostsTab.id = 'hosts-tab';
    
    // Games tab
    const gamesTab = UIBuilder.createButton('Game Management', null, 'py-2 px-1 border-b-2 font-medium text-sm');
    gamesTab.id = 'games-tab';
    
    tabsList.appendChild(hostsTab);
    tabsList.appendChild(gamesTab);
    tabsContainer.appendChild(tabsList);
    tabsSection.appendChild(tabsContainer);
    container.appendChild(tabsSection);

    // IMPORTANT: Create content area BEFORE setting up tab functionality
    const contentArea = UIBuilder.createElement('div', { id: 'admin-content-area' });
    container.appendChild(contentArea);
    
    // Tab state management - moved after content area creation
    const currentTab = sessionStorage.getItem('siteAdminActiveTab') || 'hosts';
    
    function setActiveTab(tabName) {
        // Add safety check for content area
        const contentArea = document.getElementById('admin-content-area');
        if (!contentArea) {
            console.error('Content area not found when setting active tab');
            return;
        }
        
        sessionStorage.setItem('siteAdminActiveTab', tabName);
        
        if (tabName === 'hosts') {
            hostsTab.className = 'py-2 px-1 border-b-2 border-purple-500 text-purple-600 font-medium text-sm';
            gamesTab.className = 'py-2 px-1 border-b-2 border-transparent text-gray-500 hover:text-gray-700 font-medium text-sm';
            showHostsSection();
        } else {
            gamesTab.className = 'py-2 px-1 border-b-2 border-purple-500 text-purple-600 font-medium text-sm';
            hostsTab.className = 'py-2 px-1 border-b-2 border-transparent text-gray-500 hover:text-gray-700 font-medium text-sm';
            showGamesSection();
        }
    }
    
    function showHostsSection() {
        const contentArea = document.getElementById('admin-content-area');
        if (!contentArea) {
            console.error('Content area not found in showHostsSection');
            return;
        }
        
        contentArea.innerHTML = '';
        
        const hostListContainer = buildHostListSection();
        contentArea.appendChild(hostListContainer);
    }
    
    function showGamesSection() {
        const contentArea = document.getElementById('admin-content-area');
        if (!contentArea) {
            console.error('Content area not found in showGamesSection');
            return;
        }
        
        contentArea.innerHTML = '';
        
        const gameListContainer = buildGameListSection();
        contentArea.appendChild(gameListContainer);
        
        // Trigger games loading if not already loaded/loading
        if (!appState.siteAdmin.gamesLoaded && !appState.siteAdmin.gamesLoading) {
            loadSiteAdminGames();
        }
    }
    
    // Set up event listeners after functions are defined
    hostsTab.addEventListener('click', () => setActiveTab('hosts'));
    gamesTab.addEventListener('click', () => setActiveTab('games'));
    
    // Use setTimeout to ensure DOM is ready before setting initial tab
    setTimeout(() => {
        setActiveTab(currentTab);
    }, 0);

    return container;
}

// Build game list section
function buildGameListSection() {
  const gameListContainer = UIBuilder.createElement('div', {
    className: 'bg-white rounded-lg shadow-md p-6'
  });

  const gameListHeader = UIBuilder.createElement('div', {
    className: 'flex justify-between items-center mb-6'
  });
  
  const gameListTitle = UIBuilder.createElement('h3', {
    className: 'text-xl font-semibold text-gray-900',
    textContent: 'All Games'
  });
  gameListHeader.appendChild(gameListTitle);

  // Refresh button
  const refreshButton = UIBuilder.createButton('Refresh', function() {
    refreshSiteAdminGames();
  }, 'bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors flex items-center', 'refresh-cw');
  
  gameListHeader.appendChild(refreshButton);
  gameListContainer.appendChild(gameListHeader);

  // Content based on current state
  if (appState.siteAdmin.gamesLoading) {
    // Show loading state
    const loadingDiv = UIBuilder.createElement('div', {
      className: 'flex items-center justify-center py-12'
    });
    
    const loadingSpinner = UIBuilder.createElement('div', {
      className: 'animate-spin h-8 w-8 border-4 border-gray-300 rounded-full border-t-purple-600 mr-4'
    });
    loadingDiv.appendChild(loadingSpinner);
    
    const loadingText = UIBuilder.createElement('p', {
      className: 'text-gray-600',
      textContent: 'Loading games...'
    });
    loadingDiv.appendChild(loadingText);
    
    gameListContainer.appendChild(loadingDiv);
  } else if (appState.siteAdmin.gamesError) {
    // Show error state
    buildGamesError(gameListContainer, appState.siteAdmin.gamesError);
  } else if (appState.siteAdmin.games.length > 0) {
    // Show games table
    buildGamesTable(gameListContainer, appState.siteAdmin.games);
  } else {
    // Show empty state
    buildEmptyGamesState(gameListContainer);
  }

  return gameListContainer;
}

// Build games table
function buildGamesTable(container, games) {
    const tableContainer = UIBuilder.createElement('div', { className: 'overflow-x-auto' });
    
    const table = UIBuilder.createElement('table', {
      className: 'min-w-full divide-y divide-gray-200'
    });
    
    // Table header
    const thead = UIBuilder.createElement('thead', { className: 'bg-gray-50' });
    const headerRow = UIBuilder.createElement('tr');
    
    const headers = ['Game Name', 'Host', 'Status', 'Teams', 'Bases', 'Players', 'Created', 'Actions'];
    headers.forEach(function(headerText) {
        const th = UIBuilder.createElement('th', {
          className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider',
          textContent: headerText
        });
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Table body
    const tbody = UIBuilder.createElement('tbody', {
      className: 'bg-white divide-y divide-gray-200'
    });
    
    games.forEach(function(game) {
        const row = buildGameRow(game);
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    tableContainer.appendChild(table);
    container.appendChild(tableContainer);
}

// Build individual game row
function buildGameRow(game) {
    const row = UIBuilder.createElement('tr', { className: 'hover:bg-gray-50' });
    
    // Game name cell
    const nameCell = UIBuilder.createElement('td', {
      className: 'px-6 py-4 whitespace-nowrap'
    });
    
    const nameContainer = UIBuilder.createElement('div');
    const gameName = UIBuilder.createElement('div', {
      className: 'text-sm font-medium text-gray-900',
      textContent: game.name
    });
    nameContainer.appendChild(gameName);
    
    const gameId = UIBuilder.createElement('div', {
      className: 'text-sm text-gray-500',
      textContent: `ID: ${game.id}`
    });
    nameContainer.appendChild(gameId);
    
    nameCell.appendChild(nameContainer);
    row.appendChild(nameCell);
    
    // Host cell
    const hostCell = UIBuilder.createElement('td', {
      className: 'px-6 py-4 whitespace-nowrap'
    });
    
    const hostName = UIBuilder.createElement('div', {
      className: 'text-sm text-gray-900',
      textContent: game.host_name
    });
    hostCell.appendChild(hostName);
    
    row.appendChild(hostCell);
    
    // Status cell
    const statusCell = UIBuilder.createElement('td', {
      className: 'px-6 py-4 whitespace-nowrap'
    });
    
    let statusClass = 'px-2 inline-flex text-xs leading-5 font-semibold rounded-full';
    let statusText = game.status;
    
    switch (game.status) {
        case 'active':
            statusClass += ' bg-green-100 text-green-800';
            statusText = 'Active';
            break;
        case 'setup':
            statusClass += ' bg-yellow-100 text-yellow-800';
            statusText = 'Setup';
            break;
        case 'ended':
            statusClass += ' bg-gray-100 text-gray-800';
            statusText = 'Ended';
            break;
        default:
            statusClass += ' bg-blue-100 text-blue-800';
    }
    
    const statusBadge = UIBuilder.createElement('span', {
      className: statusClass,
      textContent: statusText
    });
    statusCell.appendChild(statusBadge);
    row.appendChild(statusCell);
    
    // Teams count cell
    const teamsCell = UIBuilder.createElement('td', {
      className: 'px-6 py-4 whitespace-nowrap text-sm text-gray-900',
      textContent: game.teams_count || 0
    });
    row.appendChild(teamsCell);
    
    // Bases count cell
    const basesCell = UIBuilder.createElement('td', {
      className: 'px-6 py-4 whitespace-nowrap text-sm text-gray-900',
      textContent: game.bases_count || 0
    });
    row.appendChild(basesCell);
    
    // Players count cell
    const playersCell = UIBuilder.createElement('td', {
      className: 'px-6 py-4 whitespace-nowrap text-sm text-gray-900',
      textContent: game.players_count || 0
    });
    row.appendChild(playersCell);
    
    // Created date cell
    const createdCell = UIBuilder.createElement('td', {
      className: 'px-6 py-4 whitespace-nowrap text-sm text-gray-500'
    });
    
    if (game.start_time) {
        const createdDate = new Date(game.start_time * 1000);
        createdCell.textContent = createdDate.toLocaleDateString();
    } else {
        createdCell.textContent = 'Not started';
    }
    row.appendChild(createdCell);
    
    // Actions cell
    const actionsCell = UIBuilder.createElement('td', {
      className: 'px-6 py-4 whitespace-nowrap text-right text-sm font-medium'
    });
    
    const actionsContainer = UIBuilder.createElement('div', {
      className: 'flex space-x-2'
    });
    
    // Complete button (only for active games)
    if (game.status === 'active') {
        const completeButton = UIBuilder.createButton('Complete', function() {
          if (confirm(`Are you sure you want to complete game "${game.name}"?\n\nThis will end the game and release all QR codes for reuse.`)) {
              completeGameAsAdmin(game);
          }
        }, 'text-green-600 hover:text-green-900 transition-colors');
        completeButton.title = 'End game and release QR codes';
        actionsContainer.appendChild(completeButton);
    }
    
    // Delete button
    const deleteButton = UIBuilder.createButton('Delete', function() {
      if (confirm(`Are you sure you want to DELETE game "${game.name}"?\n\nThis will permanently remove:\n- The game and all settings\n- All teams and players\n- All bases and capture history\n- All associated data\n\nThis action CANNOT be undone!`)) {
          deleteGameAsAdmin(game);
      }
    }, 'text-red-600 hover:text-red-900 transition-colors');
    deleteButton.title = 'Permanently delete game and all data';
    actionsContainer.appendChild(deleteButton);
    
    actionsCell.appendChild(actionsContainer);
    row.appendChild(actionsCell);
    
    return row;
}

// Build empty state for no games
function buildEmptyGamesState(container) {
    const noGames = UIBuilder.createElement('div', { className: 'text-center py-12' });
    
    const noGamesIcon = UIBuilder.createElement('div', {
      className: 'mx-auto h-12 w-12 text-gray-400 mb-4'
    });
    const icon = UIBuilder.createElement('i', {
      'data-lucide': 'gamepad-2',
      className: 'h-12 w-12'
    });
    noGamesIcon.appendChild(icon);
    noGames.appendChild(noGamesIcon);
    
    const noGamesTitle = UIBuilder.createElement('h3', {
      className: 'text-lg font-medium text-gray-900 mb-2',
      textContent: 'No games found'
    });
    noGames.appendChild(noGamesTitle);
    
    const noGamesText = UIBuilder.createElement('p', {
      className: 'text-gray-500 mb-6',
      textContent: 'No games have been created by any hosts yet.'
    });
    noGames.appendChild(noGamesText);
    
    container.appendChild(noGames);
}

// Show error state for games
function buildGamesError(container, errorMessage) {
    const errorDiv = UIBuilder.createElement('div', { className: 'text-center py-12' });
    
    const errorIcon = UIBuilder.createElement('div', {
      className: 'mx-auto h-12 w-12 text-red-400 mb-4'
    });
    const icon = UIBuilder.createElement('i', {
      'data-lucide': 'alert-circle',
      className: 'h-12 w-12'
    });
    errorIcon.appendChild(icon);
    errorDiv.appendChild(errorIcon);
    
    const errorTitle = UIBuilder.createElement('h3', {
      className: 'text-lg font-medium text-gray-900 mb-2',
      textContent: 'Error Loading Games'
    });
    errorDiv.appendChild(errorTitle);
    
    const errorText = UIBuilder.createElement('p', {
      className: 'text-gray-500 mb-6',
      textContent: errorMessage
    });
    errorDiv.appendChild(errorText);
    
    const retryButton = UIBuilder.createButton('Retry', function() {
      refreshSiteAdminGames();
    }, 'bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors');
    errorDiv.appendChild(retryButton);
    
    container.appendChild(errorDiv);
}

function buildHostListSection() {
  const hostListContainer = UIBuilder.createElement('div', {
    className: 'bg-white rounded-lg shadow-md p-6'
  });

  const hostListHeader = UIBuilder.createElement('div', {
    className: 'flex justify-between items-center mb-6'
  });
  
  const hostListTitle = UIBuilder.createElement('h3', {
    className: 'text-xl font-semibold text-gray-900',
    textContent: 'All Hosts'
  });
  hostListHeader.appendChild(hostListTitle);

  // Add new host button
  const addHostButton = UIBuilder.createButton('Add New Host', function() {
    renderHostCreationModal();
  }, 'bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center', 'plus');
  
  hostListHeader.appendChild(addHostButton);
  hostListContainer.appendChild(hostListHeader);

  // Content based on current state
  if (appState.siteAdmin.hostsLoading) {
    // Show loading state
    const loadingDiv = UIBuilder.createElement('div', {
      className: 'flex items-center justify-center py-12'
    });
    
    const loadingSpinner = UIBuilder.createElement('div', {
      className: 'animate-spin h-8 w-8 border-4 border-gray-300 rounded-full border-t-purple-600 mr-4'
    });
    loadingDiv.appendChild(loadingSpinner);
    
    const loadingText = UIBuilder.createElement('p', {
      className: 'text-gray-600',
      textContent: 'Loading hosts...'
    });
    loadingDiv.appendChild(loadingText);
    
    hostListContainer.appendChild(loadingDiv);
  } else if (appState.siteAdmin.hostsError) {
    // Show error state
    buildHostsError(hostListContainer, appState.siteAdmin.hostsError);
  } else if (appState.siteAdmin.hosts.length > 0) {
    // Show hosts table
    buildHostsTable(hostListContainer, appState.siteAdmin.hosts);
  } else {
    // Show empty state
    buildEmptyHostsState(hostListContainer);
  }

  return hostListContainer;
}

// Build hosts table
function buildHostsTable(container, hosts) {
    const tableContainer = UIBuilder.createElement('div', { className: 'overflow-x-auto' });
    
    const table = UIBuilder.createElement('table', {
      className: 'min-w-full divide-y divide-gray-200'
    });
    
    // Table header
    const thead = UIBuilder.createElement('thead', { className: 'bg-gray-50' });
    const headerRow = UIBuilder.createElement('tr');
    
    const headers = ['Host Name', 'Copy Link', 'Status', 'Expiry Date', 'Created', 'Actions'];
    headers.forEach(function(headerText) {
        const th = UIBuilder.createElement('th', {
          className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider',
          textContent: headerText
        });
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Table body
    const tbody = UIBuilder.createElement('tbody', {
      className: 'bg-white divide-y divide-gray-200'
    });
    
    hosts.forEach(function(host) {
        const row = buildHostRow(host);
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    tableContainer.appendChild(table);
    container.appendChild(tableContainer);
}

// Build individual host row
function buildHostRow(host) {
    const row = UIBuilder.createElement('tr', { className: 'hover:bg-gray-50' });
    
    // Name cell
    const nameCell = UIBuilder.createElement('td', {
      className: 'px-6 py-4 whitespace-nowrap'
    });
    
    const nameContainer = UIBuilder.createElement('div');
    const hostName = UIBuilder.createElement('div', {
      className: 'text-sm font-medium text-gray-900',
      textContent: host.name
    });
    nameContainer.appendChild(hostName);
    
    nameCell.appendChild(nameContainer);
    row.appendChild(nameCell);
    
    // Copy Link cell
    const linkCell = UIBuilder.createElement('td', {
      className: 'px-6 py-4 whitespace-nowrap'
    });

    // Generate the full secret link
    const baseUrl = window.location.protocol + '//' + window.location.host;
    const secretLink = `${baseUrl}/?id=${host.qr_code}`;

    const copyButton = UIBuilder.createButton('Copy Secret Link', function() {
      navigator.clipboard.writeText(secretLink);
      showNotification('Secret link copied to clipboard', 'success');
    }, 'bg-blue-100 text-blue-700 hover:bg-blue-200 py-1 px-3 rounded-md text-sm font-medium transition-colors flex', 'copy');
    copyButton.title = secretLink; // Show full link on hover

    linkCell.appendChild(copyButton);
    row.appendChild(linkCell);
    
    // Status cell
    const statusCell = UIBuilder.createElement('td', {
      className: 'px-6 py-4 whitespace-nowrap'
    });
    
    const now = Date.now() / 1000;
    const isExpired = host.expiry_date && host.expiry_date <= now;
    const isExpiringSoon = host.expiry_date && !isExpired && (host.expiry_date - now) < 7 * 24 * 60 * 60; // 7 days
    
    let statusClass = 'px-2 inline-flex text-xs leading-5 font-semibold rounded-full';
    let statusText;
    
    if (isExpired) {
        statusClass += ' bg-red-100 text-red-800';
        statusText = 'Expired';
    } else if (isExpiringSoon) {
        statusClass += ' bg-yellow-100 text-yellow-800';
        statusText = 'Expiring Soon';
    } else {
        statusClass += ' bg-green-100 text-green-800';
        statusText = 'Active';
    }
    
    const statusBadge = UIBuilder.createElement('span', {
      className: statusClass,
      textContent: statusText
    });
    statusCell.appendChild(statusBadge);
    row.appendChild(statusCell);
    
    // Expiry Date cell
    const expiryCell = UIBuilder.createElement('td', {
      className: 'px-6 py-4 whitespace-nowrap text-sm text-gray-900'
    });
    
    if (host.expiry_date) {
        const expiryDate = new Date(host.expiry_date * 1000);
        expiryCell.textContent = expiryDate.toLocaleDateString();
    } else {
        expiryCell.textContent = 'Never';
        expiryCell.className += ' text-gray-500';
    }
    
    row.appendChild(expiryCell);
    
    // Created Date cell
    const createdCell = UIBuilder.createElement('td', {
      className: 'px-6 py-4 whitespace-nowrap text-sm text-gray-500'
    });
    
    const createdDate = new Date(host.creation_date * 1000);
    createdCell.textContent = createdDate.toLocaleDateString();
    row.appendChild(createdCell);
    
    // Actions cell
    const actionsCell = UIBuilder.createElement('td', {
      className: 'px-6 py-4 whitespace-nowrap text-right text-sm font-medium'
    });
    
    const actionsContainer = UIBuilder.createElement('div', {
      className: 'flex space-x-2'
    });
    
    // View QR button
    const qrButton = UIBuilder.createButton('QR', function() {
      renderHostQRModal(host);
    }, 'text-purple-600 hover:text-purple-900 transition-colors');
    qrButton.title = 'View QR Code';
    actionsContainer.appendChild(qrButton);
    
    // Edit button
    const editButton = UIBuilder.createButton('Edit', function() {
      renderHostEditModal(host);
    }, 'text-blue-600 hover:text-blue-900 transition-colors');
    actionsContainer.appendChild(editButton);
    
    // Delete button
    const deleteButton = UIBuilder.createButton('Delete', function() {
      if (confirm(`Are you sure you want to delete host "${host.name}"?\n\nThis action cannot be undone.`)) {
          // Call the API function from core.js
          deleteHost(host.id).then((success) => {
              if (success) {
                  renderApp(); // Refresh the view
              }
          });
      }
    }, 'text-red-600 hover:text-red-900 transition-colors');
    actionsContainer.appendChild(deleteButton);
    
    actionsCell.appendChild(actionsContainer);
    row.appendChild(actionsCell);
    
    return row;
}

// Build empty state for no hosts
function buildEmptyHostsState(container) {
    const noHosts = UIBuilder.createElement('div', { className: 'text-center py-12' });
    
    const noHostsIcon = UIBuilder.createElement('div', {
      className: 'mx-auto h-12 w-12 text-gray-400 mb-4'
    });
    const icon = UIBuilder.createElement('i', {
      'data-lucide': 'users',
      className: 'h-12 w-12'
    });
    noHostsIcon.appendChild(icon);
    noHosts.appendChild(noHostsIcon);
    
    const noHostsTitle = UIBuilder.createElement('h3', {
      className: 'text-lg font-medium text-gray-900 mb-2',
      textContent: 'No hosts found'
    });
    noHosts.appendChild(noHostsTitle);
    
    const noHostsText = UIBuilder.createElement('p', {
      className: 'text-gray-500 mb-6',
      textContent: 'Get started by creating your first game host.'
    });
    noHosts.appendChild(noHostsText);
    
    const createFirstButton = UIBuilder.createButton('Create First Host', function() {
      renderHostCreationModal();
    }, 'bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors');
    noHosts.appendChild(createFirstButton);
    
    container.appendChild(noHosts);
}

// Show error state
function buildHostsError(container, errorMessage) {
    const errorDiv = UIBuilder.createElement('div', { className: 'text-center py-12' });
    
    const errorIcon = UIBuilder.createElement('div', {
      className: 'mx-auto h-12 w-12 text-red-400 mb-4'
    });
    const icon = UIBuilder.createElement('i', {
      'data-lucide': 'alert-circle',
      className: 'h-12 w-12'
    });
    errorIcon.appendChild(icon);
    errorDiv.appendChild(errorIcon);
    
    const errorTitle = UIBuilder.createElement('h3', {
      className: 'text-lg font-medium text-gray-900 mb-2',
      textContent: 'Error Loading Hosts'
    });
    errorDiv.appendChild(errorTitle);
    
    const errorText = UIBuilder.createElement('p', {
      className: 'text-gray-500 mb-6',
      textContent: errorMessage
    });
    errorDiv.appendChild(errorText);
    
    const retryButton = UIBuilder.createButton('Retry', function() {
      renderApp();
    }, 'bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors');
    errorDiv.appendChild(retryButton);
    
    container.appendChild(errorDiv);
}

// Host creation modal
function renderHostCreationModal() {
  // Create modal backdrop
  const modalBackdrop = UIBuilder.createElement('div', {
    className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
    id: 'host-creation-modal'
  });
  document.body.appendChild(modalBackdrop);

  // Create modal container
  const modalContainer = UIBuilder.createElement('div', {
    className: 'bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4'
  });
  modalBackdrop.appendChild(modalContainer);

  // Modal title
  const modalTitle = UIBuilder.createElement('h3', {
    className: 'text-xl font-bold mb-4',
    textContent: 'Create New Host'
  });
  modalContainer.appendChild(modalTitle);

  // Create form
  const form = UIBuilder.createElement('form', { className: 'space-y-4' });
  modalContainer.appendChild(form);

  // Host name field
  const nameGroup = UIBuilder.createElement('div');
  
  const nameLabel = UIBuilder.createElement('label', {
    className: 'block text-gray-700 text-sm font-bold mb-2',
    htmlFor: 'new-host-name',
    textContent: 'Host Name'
  });
  nameGroup.appendChild(nameLabel);
  
  const nameInput = UIBuilder.createElement('input', {
    className: 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500',
    id: 'new-host-name',
    type: 'text',
    placeholder: 'Enter host name',
    required: true
  });
  nameGroup.appendChild(nameInput);
  
  form.appendChild(nameGroup);

  // Expiry date field
  const expiryGroup = UIBuilder.createElement('div');
  
  const expiryLabel = UIBuilder.createElement('label', {
    className: 'block text-gray-700 text-sm font-bold mb-2',
    htmlFor: 'new-host-expiry',
    textContent: 'Expiry Date (optional)'
  });
  expiryGroup.appendChild(expiryLabel);
  
  const expiryInput = UIBuilder.createElement('input', {
    className: 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500',
    id: 'new-host-expiry',
    type: 'date'
  });
  
  // Set min date to today
  const today = new Date();
  const formattedDate = today.toISOString().split('T')[0];
  expiryInput.min = formattedDate;
  
  expiryGroup.appendChild(expiryInput);
  
  const expiryNote = UIBuilder.createElement('p', {
    className: 'text-sm text-gray-500 mt-1',
    textContent: 'Leave blank for no expiry date'
  });
  expiryGroup.appendChild(expiryNote);
  
  form.appendChild(expiryGroup);

  // Action buttons
  const buttonGroup = UIBuilder.createElement('div', { className: 'flex gap-4 mt-6' });
  
  const cancelButton = UIBuilder.createButton('Cancel', function() {
    document.body.removeChild(modalBackdrop);
  }, 'flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors');
  buttonGroup.appendChild(cancelButton);
  
  const submitButton = UIBuilder.createButton('Create Host', null, 'flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors');
  submitButton.type = 'submit';
  buttonGroup.appendChild(submitButton);
  
  form.appendChild(buttonGroup);

  // Handle form submission
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const name = nameInput.value.trim();
    const expiryDateStr = expiryInput.value;
    
    if (!name) {
      showNotification('Please enter a host name', 'warning');
      return;
    }
    
    let expiryDate = null;
    if (expiryDateStr) {
      // Convert date string to timestamp (seconds)
      expiryDate = Math.floor(new Date(expiryDateStr + 'T23:59:59').getTime() / 1000);
    }
    
    const hostData = {
      name,
      expiry_date: expiryDate
    };
    
    try {
      // Call the API function from core.js
      const result = await createHost(hostData);
      if (result) {
        document.body.removeChild(modalBackdrop);
        renderApp();
      }
    } catch (error) {
      // Error handling is done in createHost function
    }
  });

  // Focus on name input
  setTimeout(() => nameInput.focus(), 100);

  // Allow closing modal with Escape key
  function handleEscapeKey(e) {
    if (e.key === 'Escape') {
      document.body.removeChild(modalBackdrop);
      document.removeEventListener('keydown', handleEscapeKey);
    }
  }
  document.addEventListener('keydown', handleEscapeKey);
}

// Host QR code modal
function renderHostQRModal(host) {
  // Create modal backdrop
  const modalBackdrop = UIBuilder.createElement('div', {
    className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
    id: 'host-qr-modal'
  });
  document.body.appendChild(modalBackdrop);
  
  // Create modal container
  const modalContainer = UIBuilder.createElement('div', {
    className: 'bg-white rounded-lg shadow-xl p-6 w-full max-w-lg mx-4'
  });
  modalBackdrop.appendChild(modalContainer);
  
  // Modal title
  const modalTitle = UIBuilder.createElement('h3', {
    className: 'text-xl font-bold mb-4 text-center',
    textContent: `Host QR Code: ${host.name}`
  });
  modalContainer.appendChild(modalTitle);
  
  // Host status indicator
  const statusContainer = UIBuilder.createElement('div', {
    className: 'flex justify-center mb-4'
  });
  
  const now = Date.now() / 1000;
  const isExpired = host.expiry_date && host.expiry_date <= now;
  const isExpiringSoon = host.expiry_date && !isExpired && (host.expiry_date - now) < 7 * 24 * 60 * 60;
  
  let statusClass = 'px-3 py-1 text-sm font-medium rounded-full';
  let statusText;
  
  if (isExpired) {
    statusClass += ' bg-red-100 text-red-800';
    statusText = 'Expired';
  } else if (isExpiringSoon) {
    statusClass += ' bg-yellow-100 text-yellow-800';
    statusText = 'Expiring Soon';
  } else {
    statusClass += ' bg-green-100 text-green-800';
    statusText = 'Active';
  }
  
  const statusBadge = UIBuilder.createElement('span', {
    className: statusClass,
    textContent: statusText
  });
  statusContainer.appendChild(statusBadge);
  modalContainer.appendChild(statusContainer);
  
  // QR code container
  const qrContainer = UIBuilder.createElement('div', {
    className: 'bg-gray-50 p-6 rounded-lg flex flex-col items-center justify-center mb-6'
  });
  
  // QR code div (will contain the actual QR code)
  const qrDiv = UIBuilder.createElement('div', {
    id: `qr-host-${host.id}`,
    className: 'mb-4 bg-white p-4 rounded-lg shadow-sm flex items-center justify-center',
    style: { minHeight: '200px', minWidth: '200px' }
  });
  qrContainer.appendChild(qrDiv);
  
  // Generate host secret link
  const baseUrl = window.location.protocol + '//' + window.location.host;
  const hostUrl = `${baseUrl}/?id=${host.qr_code}`;
  
  // Host QR code value display
  const qrValue = UIBuilder.createElement('div', { className: 'text-center mb-4' });
  
  const qrLabel = UIBuilder.createElement('p', {
    className: 'text-sm text-gray-600 mb-2',
    textContent: 'QR Code ID:'
  });
  qrValue.appendChild(qrLabel);
  
  const qrCode = UIBuilder.createElement('p', {
    className: 'text-sm font-mono bg-gray-100 px-3 py-2 rounded break-all',
    textContent: host.qr_code
  });
  qrValue.appendChild(qrCode);
  
  qrContainer.appendChild(qrValue);
  
  const linkContainer = UIBuilder.createElement('div', { className: 'text-center mb-4' });
  
  const linkLabel = UIBuilder.createElement('p', {
    className: 'text-sm text-gray-600 mb-2',
    textContent: 'Secret Link:'
  });
  linkContainer.appendChild(linkLabel);
  
  const hostLink = UIBuilder.createElement('p', {
    className: 'text-sm text-blue-600 bg-gray-100 px-3 py-2 rounded break-all',
    textContent: hostUrl
  });
  linkContainer.appendChild(hostLink);
  
  qrContainer.appendChild(linkContainer);
  
  modalContainer.appendChild(qrContainer);
  
  // Action buttons
  const buttonContainer = UIBuilder.createElement('div', { className: 'flex gap-3' });
  
  // Copy ID button
  const copyIdButton = UIBuilder.createButton('Copy ID', function() {
    navigator.clipboard.writeText(host.qr_code);
    showNotification('QR code ID copied to clipboard', 'success');
  }, 'flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors flex items-center justify-center', 'copy');
  buttonContainer.appendChild(copyIdButton);
  
  // Copy link button
  const copyLinkButton = UIBuilder.createButton('Copy Link', function() {
    navigator.clipboard.writeText(hostUrl);
    showNotification('Host link copied to clipboard', 'success');
  }, 'flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center', 'link');
  buttonContainer.appendChild(copyLinkButton);
  
  modalContainer.appendChild(buttonContainer);
  
  // Close button
  const closeButton = UIBuilder.createButton('Close', function() {
    document.body.removeChild(modalBackdrop);
  }, 'mt-4 w-full bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors');
  modalContainer.appendChild(closeButton);
  
  // Generate QR code after modal is in DOM
  setTimeout(() => {
    generateQRCodeForHost(qrDiv.id, hostUrl);
  }, 100);
  
  // Allow closing modal with Escape key
  function handleEscapeKey(e) {
    if (e.key === 'Escape') {
      document.body.removeChild(modalBackdrop);
      document.removeEventListener('keydown', handleEscapeKey);
    }
  }
  document.addEventListener('keydown', handleEscapeKey);
}

// New function to generate QR codes with library loading
async function generateQRCodeForHost(elementId, url) {
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

// Host edit modal
function renderHostEditModal(host) {
  // Create modal backdrop
  const modalBackdrop = UIBuilder.createElement('div', {
    className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
    id: 'host-edit-modal'
  });
  document.body.appendChild(modalBackdrop);
  
  // Create modal container
  const modalContainer = UIBuilder.createElement('div', {
    className: 'bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4'
  });
  modalBackdrop.appendChild(modalContainer);
  
  // Modal title
  const modalTitle = UIBuilder.createElement('h3', {
    className: 'text-xl font-bold mb-4',
    textContent: 'Edit Host'
  });
  modalContainer.appendChild(modalTitle);
  
  // Create form
  const form = UIBuilder.createElement('form', { className: 'space-y-4' });
  modalContainer.appendChild(form);
  
  // Host name field
  const nameGroup = UIBuilder.createElement('div');
  
  const nameLabel = UIBuilder.createElement('label', {
    className: 'block text-gray-700 text-sm font-bold mb-2',
    htmlFor: 'edit-host-name',
    textContent: 'Host Name'
  });
  nameGroup.appendChild(nameLabel);
  
  const nameInput = UIBuilder.createElement('input', {
    className: 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-purple-500',
    id: 'edit-host-name',
    type: 'text',
    value: host.name,
    required: true
  });
  nameGroup.appendChild(nameInput);
  
  form.appendChild(nameGroup);
  
  // Expiry date field
  const expiryGroup = UIBuilder.createElement('div');
  
  const expiryLabel = UIBuilder.createElement('label', {
    className: 'block text-gray-700 text-sm font-bold mb-2',
    htmlFor: 'edit-host-expiry',
    textContent: 'Expiry Date (optional)'
  });
  expiryGroup.appendChild(expiryLabel);
  
  const expiryInput = UIBuilder.createElement('input', {
    className: 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-purple-500',
    id: 'edit-host-expiry',
    type: 'date'
  });
  
  // Set min date to today
  const today = new Date();
  const formattedDate = today.toISOString().split('T')[0];
  expiryInput.min = formattedDate;
  
  // Set current expiry date if exists
  if (host.expiry_date) {
    const expiryDate = new Date(host.expiry_date * 1000);
    expiryInput.value = expiryDate.toISOString().split('T')[0];
  }
  
  expiryGroup.appendChild(expiryInput);
  
  const expiryNote = UIBuilder.createElement('p', {
    className: 'text-sm text-gray-500 mt-1',
    textContent: 'Leave blank for no expiry date'
  });
  expiryGroup.appendChild(expiryNote);
  
  form.appendChild(expiryGroup);
  
  // Action buttons
  const buttonGroup = UIBuilder.createElement('div', { className: 'flex gap-4 mt-6' });
  
  const cancelButton = UIBuilder.createButton('Cancel', function() {
    document.body.removeChild(modalBackdrop);
  }, 'flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors');
  buttonGroup.appendChild(cancelButton);
  
  const saveButton = UIBuilder.createButton('Save Changes', null, 'flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors');
  saveButton.type = 'submit';
  buttonGroup.appendChild(saveButton);
  
  form.appendChild(buttonGroup);
  
  // Reset button for removing expiry date
  if (host.expiry_date) {
    const resetButton = UIBuilder.createButton('Remove Expiry Date', function() {
      expiryInput.value = '';
    }, 'w-full text-gray-600 mt-2 text-sm hover:text-gray-800 transition-colors');
    form.appendChild(resetButton);
  }
  
  // Handle form submission
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const name = nameInput.value.trim();
    const expiryDateStr = expiryInput.value;
    
    if (!name) {
      showNotification('Please enter a host name', 'warning');
      return;
    }
    
    let expiryDate = null;
    if (expiryDateStr) {
      // Convert date string to timestamp (seconds)
      expiryDate = Math.floor(new Date(expiryDateStr + 'T23:59:59').getTime() / 1000);
    }
    
    const hostData = {
      name,
      expiry_date: expiryDate
    };
    
    try {
      // Call the API function from core.js
      const result = await updateHost(host.id, hostData);
      if (result) {
        document.body.removeChild(modalBackdrop);
        renderApp();
      }
    } catch (error) {
      // Error handling is done in updateHost function
    }
  });

  // Focus on name input
  setTimeout(() => nameInput.focus(), 100);

  // Allow closing modal with Escape key
  function handleEscapeKey(e) {
    if (e.key === 'Escape') {
      document.body.removeChild(modalBackdrop);
      document.removeEventListener('keydown', handleEscapeKey);
    }
  }
  document.addEventListener('keydown', handleEscapeKey);
}