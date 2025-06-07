// Site Admin module for managing hosts - UI components only, API calls handled by core.js

function loadQRCodeLibrary() {
  return new Promise((resolve, reject) => {
    // Check if QRCode library is already loaded
    if (window.QRCode) {
      resolve();
      return;
    }

    // Create script element to load QRCode.js
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    script.onload = () => {
      console.log('QRCode library loaded successfully');
      resolve();
    };
    script.onerror = () => {
      console.error('Failed to load QRCode library');
      reject(new Error('Failed to load QR code library'));
    };
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
  const container = document.createElement('div');
  container.className = 'max-w-md mx-auto py-8';

  // Title
  const title = document.createElement('h2');
  title.className = 'text-2xl font-bold mb-6 text-center';
  title.textContent = 'Site Administration';
  container.appendChild(title);

  // Login form
  const form = document.createElement('form');
  form.className = 'bg-white rounded-lg shadow-md p-6 mb-6';

  // Password field
  const passwordGroup = document.createElement('div');
  passwordGroup.className = 'mb-4';

  const passwordLabel = document.createElement('label');
  passwordLabel.className = 'block text-gray-700 text-sm font-bold mb-2';
  passwordLabel.htmlFor = 'site-admin-password';
  passwordLabel.textContent = 'Admin Password';
  passwordGroup.appendChild(passwordLabel);

  const passwordInput = document.createElement('input');
  passwordInput.type = 'password';
  passwordInput.id = 'site-admin-password';
  passwordInput.className = 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500';
  passwordInput.required = true;
  passwordInput.placeholder = 'Enter admin password';
  passwordGroup.appendChild(passwordInput);

  form.appendChild(passwordGroup);

  // Login button
  const loginButton = document.createElement('button');
  loginButton.type = 'submit';
  loginButton.className = 'w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors';
  loginButton.textContent = 'Login';
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
  const securityNotice = document.createElement('div');
  securityNotice.className = 'bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm mb-6';
  const noticeTitle = document.createElement('strong');
  noticeTitle.textContent = 'Security Notice:';
  securityNotice.appendChild(noticeTitle);

  const noticeText = document.createTextNode(' This is a restricted admin area. Access is logged and monitored.');
  securityNotice.appendChild(noticeText);
  container.appendChild(securityNotice);

  // Back to Home link
  const backLink = document.createElement('div');
  backLink.className = 'text-center';

  const backButton = document.createElement('button');
  backButton.className = 'text-blue-600 hover:text-blue-800 underline';
  backButton.textContent = 'Back to Home';
  backButton.addEventListener('click', function() { navigateTo('landing'); });
  backLink.appendChild(backButton);

  container.appendChild(backLink);

  // Auto-focus password input
  setTimeout(() => passwordInput.focus(), 100);

  return container;
}

// Render site admin panel with async host loading
function renderSiteAdminPanel() {
    if (!appState.siteAdmin.isAuthenticated) {
        return renderSiteAdminLogin();
    }

    const container = document.createElement('div');
    container.className = 'max-w-6xl mx-auto py-8';

    // Title and summary - build immediately
    const headerSection = document.createElement('div');
    headerSection.className = 'flex justify-between items-center mb-6';

    const titleSection = document.createElement('div');
    const title = document.createElement('h2');
    title.className = 'text-3xl font-bold text-gray-900';
    title.textContent = 'Site Administration';
    titleSection.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.className = 'text-gray-600 mt-1';
    subtitle.textContent = 'Manage hosts and games across the system';
    titleSection.appendChild(subtitle);

    headerSection.appendChild(titleSection);

    // Logout button
    const logoutButton = document.createElement('button');
    logoutButton.className = 'bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors';
    logoutButton.textContent = 'Logout';
    logoutButton.addEventListener('click', logoutSiteAdmin);
    headerSection.appendChild(logoutButton);

    container.appendChild(headerSection);

    // Stats section - placeholder initially
    const statsSection = buildStatsSection();
    container.appendChild(statsSection);

    // Add navigation tabs for Hosts and Games
    const tabsSection = document.createElement('div');
    tabsSection.className = 'mb-6';
    
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'border-b border-gray-200';
    
    const tabsList = document.createElement('nav');
    tabsList.className = 'flex space-x-8';
    
    // Hosts tab
    const hostsTab = document.createElement('button');
    hostsTab.className = 'py-2 px-1 border-b-2 font-medium text-sm';
    hostsTab.textContent = 'Host Management';
    hostsTab.id = 'hosts-tab';
    
    // Games tab
    const gamesTab = document.createElement('button');
    gamesTab.className = 'py-2 px-1 border-b-2 font-medium text-sm';
    gamesTab.textContent = 'Game Management';
    gamesTab.id = 'games-tab';
    
    // Tab state management
    const currentTab = sessionStorage.getItem('siteAdminActiveTab') || 'hosts';
    
    function setActiveTab(tabName) {
        sessionStorage.setItem('siteAdminActiveTab', tabName);
        
        if (tabName === 'hosts') {
            hostsTab.className = 'py-2 px-1 border-b-2 border-blue-500 text-blue-600 font-medium text-sm';
            gamesTab.className = 'py-2 px-1 border-b-2 border-transparent text-gray-500 hover:text-gray-700 font-medium text-sm';
            showHostsSection();
        } else {
            gamesTab.className = 'py-2 px-1 border-b-2 border-blue-500 text-blue-600 font-medium text-sm';
            hostsTab.className = 'py-2 px-1 border-b-2 border-transparent text-gray-500 hover:text-gray-700 font-medium text-sm';
            showGamesSection();
        }
    }
    
    hostsTab.addEventListener('click', () => setActiveTab('hosts'));
    gamesTab.addEventListener('click', () => setActiveTab('games'));
    
    tabsList.appendChild(hostsTab);
    tabsList.appendChild(gamesTab);
    tabsContainer.appendChild(tabsList);
    tabsSection.appendChild(tabsContainer);
    container.appendChild(tabsSection);

    // Content area for tabs
    const contentArea = document.createElement('div');
    contentArea.id = 'admin-content-area';
    container.appendChild(contentArea);
    
    // Set initial active tab
    setActiveTab(currentTab);
    
    function showHostsSection() {
        const contentArea = document.getElementById('admin-content-area');
        contentArea.innerHTML = '';
        
        const hostListContainer = buildHostListSection();
        contentArea.appendChild(hostListContainer);
    }
    
    function showGamesSection() {
        const contentArea = document.getElementById('admin-content-area');
        contentArea.innerHTML = '';
        
        const gameListContainer = buildGameListSection();
        contentArea.appendChild(gameListContainer);
        
        // Trigger games loading if not already loaded/loading
        if (!appState.siteAdmin.gamesLoaded && !appState.siteAdmin.gamesLoading) {
            loadSiteAdminGames();
        }
    }

    return container;
}

// Build game list section
function buildGameListSection() {
  const gameListContainer = document.createElement('div');
  gameListContainer.className = 'bg-white rounded-lg shadow-md p-6';

  const gameListHeader = document.createElement('div');
  gameListHeader.className = 'flex justify-between items-center mb-6';
  
  const gameListTitle = document.createElement('h3');
  gameListTitle.className = 'text-xl font-semibold text-gray-900';
  gameListTitle.textContent = 'All Games';
  gameListHeader.appendChild(gameListTitle);

  // Refresh button
  const refreshButton = document.createElement('button');
  refreshButton.className = 'bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center';
  
  const refreshIcon = document.createElement('i');
  refreshIcon.setAttribute('data-lucide', 'refresh-cw');
  refreshIcon.className = 'mr-2 h-4 w-4';
  refreshButton.appendChild(refreshIcon);
  
  const refreshText = document.createElement('span');
  refreshText.textContent = 'Refresh';
  refreshButton.appendChild(refreshText);
  
  refreshButton.addEventListener('click', function() {
    refreshSiteAdminGames();
  });
  
  gameListHeader.appendChild(refreshButton);
  gameListContainer.appendChild(gameListHeader);

  // Content based on current state
  if (appState.siteAdmin.gamesLoading) {
    // Show loading state
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'flex items-center justify-center py-12';
    
    const loadingSpinner = document.createElement('div');
    loadingSpinner.className = 'animate-spin h-8 w-8 border-4 border-gray-300 rounded-full border-t-blue-600 mr-4';
    loadingDiv.appendChild(loadingSpinner);
    
    const loadingText = document.createElement('p');
    loadingText.className = 'text-gray-600';
    loadingText.textContent = 'Loading games...';
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
    const tableContainer = document.createElement('div');
    tableContainer.className = 'overflow-x-auto';
    
    const table = document.createElement('table');
    table.className = 'min-w-full divide-y divide-gray-200';
    
    // Table header
    const thead = document.createElement('thead');
    thead.className = 'bg-gray-50';
    
    const headerRow = document.createElement('tr');
    
    const headers = ['Game Name', 'Host', 'Status', 'Teams', 'Bases', 'Players', 'Created', 'Actions'];
    headers.forEach(function(headerText) {
        const th = document.createElement('th');
        th.className = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
        th.textContent = headerText;
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Table body
    const tbody = document.createElement('tbody');
    tbody.className = 'bg-white divide-y divide-gray-200';
    
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
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50';
    
    // Game name cell
    const nameCell = document.createElement('td');
    nameCell.className = 'px-6 py-4 whitespace-nowrap';
    
    const nameContainer = document.createElement('div');
    const gameName = document.createElement('div');
    gameName.className = 'text-sm font-medium text-gray-900';
    gameName.textContent = game.name;
    nameContainer.appendChild(gameName);
    
    const gameId = document.createElement('div');
    gameId.className = 'text-sm text-gray-500';
    gameId.textContent = `ID: ${game.id}`;
    nameContainer.appendChild(gameId);
    
    nameCell.appendChild(nameContainer);
    row.appendChild(nameCell);
    
    // Host cell
    const hostCell = document.createElement('td');
    hostCell.className = 'px-6 py-4 whitespace-nowrap';
    
    const hostName = document.createElement('div');
    hostName.className = 'text-sm text-gray-900';
    hostName.textContent = game.host_name;
    hostCell.appendChild(hostName);
    
    row.appendChild(hostCell);
    
    // Status cell
    const statusCell = document.createElement('td');
    statusCell.className = 'px-6 py-4 whitespace-nowrap';
    
    const statusBadge = document.createElement('span');
    statusBadge.className = 'px-2 inline-flex text-xs leading-5 font-semibold rounded-full';
    
    switch (game.status) {
        case 'active':
            statusBadge.className += ' bg-green-100 text-green-800';
            statusBadge.textContent = 'Active';
            break;
        case 'setup':
            statusBadge.className += ' bg-yellow-100 text-yellow-800';
            statusBadge.textContent = 'Setup';
            break;
        case 'ended':
            statusBadge.className += ' bg-gray-100 text-gray-800';
            statusBadge.textContent = 'Ended';
            break;
        default:
            statusBadge.className += ' bg-blue-100 text-blue-800';
            statusBadge.textContent = game.status;
    }
    
    statusCell.appendChild(statusBadge);
    row.appendChild(statusCell);
    
    // Teams count cell
    const teamsCell = document.createElement('td');
    teamsCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-900';
    teamsCell.textContent = game.teams_count || 0;
    row.appendChild(teamsCell);
    
    // Bases count cell
    const basesCell = document.createElement('td');
    basesCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-900';
    basesCell.textContent = game.bases_count || 0;
    row.appendChild(basesCell);
    
    // Players count cell
    const playersCell = document.createElement('td');
    playersCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-900';
    playersCell.textContent = game.players_count || 0;
    row.appendChild(playersCell);
    
    // Created date cell
    const createdCell = document.createElement('td');
    createdCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500';
    
    if (game.start_time) {
        const createdDate = new Date(game.start_time * 1000);
        createdCell.textContent = createdDate.toLocaleDateString();
    } else {
        createdCell.textContent = 'Not started';
    }
    row.appendChild(createdCell);
    
    // Actions cell
    const actionsCell = document.createElement('td');
    actionsCell.className = 'px-6 py-4 whitespace-nowrap text-right text-sm font-medium';
    
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'flex space-x-2';
    
    // Complete button (only for active games)
    if (game.status === 'active') {
        const completeButton = document.createElement('button');
        completeButton.className = 'text-green-600 hover:text-green-900 transition-colors';
        completeButton.textContent = 'Complete';
        completeButton.title = 'End game and release QR codes';
        completeButton.addEventListener('click', function() {
            if (confirm(`Are you sure you want to complete game "${game.name}"?\n\nThis will end the game and release all QR codes for reuse.`)) {
                completeGameAsAdmin(game);
            }
        });
        actionsContainer.appendChild(completeButton);
    }
    
    // Delete button
    const deleteButton = document.createElement('button');
    deleteButton.className = 'text-red-600 hover:text-red-900 transition-colors';
    deleteButton.textContent = 'Delete';
    deleteButton.title = 'Permanently delete game and all data';
    deleteButton.addEventListener('click', function() {
        if (confirm(`Are you sure you want to DELETE game "${game.name}"?\n\nThis will permanently remove:\n- The game and all settings\n- All teams and players\n- All bases and capture history\n- All associated data\n\nThis action CANNOT be undone!`)) {
            deleteGameAsAdmin(game.id);
        }
    });
    actionsContainer.appendChild(deleteButton);
    
    actionsCell.appendChild(actionsContainer);
    row.appendChild(actionsCell);
    
    return row;
}

// Build empty state for no games
function buildEmptyGamesState(container) {
    const noGames = document.createElement('div');
    noGames.className = 'text-center py-12';
    
    const noGamesIcon = document.createElement('div');
    noGamesIcon.className = 'mx-auto h-12 w-12 text-gray-400 mb-4';
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'gamepad-2');
    icon.className = 'h-12 w-12';
    noGamesIcon.appendChild(icon);
    noGames.appendChild(noGamesIcon);
    
    const noGamesTitle = document.createElement('h3');
    noGamesTitle.className = 'text-lg font-medium text-gray-900 mb-2';
    noGamesTitle.textContent = 'No games found';
    noGames.appendChild(noGamesTitle);
    
    const noGamesText = document.createElement('p');
    noGamesText.className = 'text-gray-500 mb-6';
    noGamesText.textContent = 'No games have been created by any hosts yet.';
    noGames.appendChild(noGamesText);
    
    container.appendChild(noGames);
}

// Show error state for games
function buildGamesError(container, errorMessage) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'text-center py-12';
    
    const errorIcon = document.createElement('div');
    errorIcon.className = 'mx-auto h-12 w-12 text-red-400 mb-4';
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'alert-circle');
    icon.className = 'h-12 w-12';
    errorIcon.appendChild(icon);
    errorDiv.appendChild(errorIcon);
    
    const errorTitle = document.createElement('h3');
    errorTitle.className = 'text-lg font-medium text-gray-900 mb-2';
    errorTitle.textContent = 'Error Loading Games';
    errorDiv.appendChild(errorTitle);
    
    const errorText = document.createElement('p');
    errorText.className = 'text-gray-500 mb-6';
    errorText.textContent = errorMessage;
    errorDiv.appendChild(errorText);
    
    const retryButton = document.createElement('button');
    retryButton.className = 'bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors';
    retryButton.textContent = 'Retry';
    retryButton.addEventListener('click', function() {
        refreshSiteAdminGames();
    });
    errorDiv.appendChild(retryButton);
    
    container.appendChild(errorDiv);
}

// Clear host and game data when leaving admin
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

function buildStatsSection() {
  const statsSection = document.createElement('div');
  statsSection.className = 'grid grid-cols-1 md:grid-cols-3 gap-6 mb-6';
  
  if (appState.siteAdmin.hostsLoading) {
    // Show loading state
    for (let i = 0; i < 3; i++) {
      const statCard = document.createElement('div');
      statCard.className = 'bg-white rounded-lg shadow-md p-6';
      
      const statLabel = document.createElement('div');
      statLabel.className = 'text-sm font-medium text-gray-500 uppercase tracking-wide';
      statLabel.textContent = 'Loading...';
      statCard.appendChild(statLabel);
      
      const statValue = document.createElement('div');
      statValue.className = 'mt-2 text-3xl font-bold text-gray-400';
      statValue.innerHTML = '<div class="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>';
      statCard.appendChild(statValue);
      
      statsSection.appendChild(statCard);
    }
  } else if (appState.siteAdmin.hostsError) {
    // Show error state
    const errorCard = document.createElement('div');
    errorCard.className = 'col-span-3 bg-red-50 border border-red-200 rounded-lg p-4';
    const errorText = document.createElement('p');
    errorText.className = 'text-red-800';
    errorText.textContent = `Error loading stats: ${appState.siteAdmin.hostsError}`;
    errorCard.appendChild(errorText);
    statsSection.appendChild(errorCard);
  } else {
    // Show actual stats
    const hosts = appState.siteAdmin.hosts;
    const totalHosts = hosts.length;
    const activeHosts = hosts.filter(host => !host.expiry_date || host.expiry_date > Date.now() / 1000);
    const expiredHosts = hosts.filter(host => host.expiry_date && host.expiry_date <= Date.now() / 1000);
    
    const stats = [
      { label: 'Total Hosts', value: totalHosts, color: 'text-gray-900' },
      { label: 'Active Hosts', value: activeHosts.length, color: 'text-green-600' },
      { label: 'Expired Hosts', value: expiredHosts.length, color: 'text-red-600' }
    ];
    
    stats.forEach(stat => {
      const statCard = document.createElement('div');
      statCard.className = 'bg-white rounded-lg shadow-md p-6';
      
      const statLabel = document.createElement('div');
      statLabel.className = 'text-sm font-medium text-gray-500 uppercase tracking-wide';
      statLabel.textContent = stat.label;
      statCard.appendChild(statLabel);
      
      const statValue = document.createElement('div');
      statValue.className = `mt-2 text-3xl font-bold ${stat.color}`;
      statValue.textContent = stat.value;
      statCard.appendChild(statValue);
      
      statsSection.appendChild(statCard);
    });
  }
  
  return statsSection;
}

function buildHostListSection() {
  const hostListContainer = document.createElement('div');
  hostListContainer.className = 'bg-white rounded-lg shadow-md p-6';

  const hostListHeader = document.createElement('div');
  hostListHeader.className = 'flex justify-between items-center mb-6';
  
  const hostListTitle = document.createElement('h3');
  hostListTitle.className = 'text-xl font-semibold text-gray-900';
  hostListTitle.textContent = 'All Hosts';
  hostListHeader.appendChild(hostListTitle);

  // Add new host button
  const addHostButton = document.createElement('button');
  addHostButton.className = 'bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center';
  
  const addIcon = document.createElement('i');
  addIcon.setAttribute('data-lucide', 'plus');
  addIcon.className = 'mr-2 h-4 w-4';
  addHostButton.appendChild(addIcon);
  
  const addText = document.createElement('span');
  addText.textContent = 'Add New Host';
  addHostButton.appendChild(addText);
  
  addHostButton.addEventListener('click', function() {
    renderHostCreationModal();
  });
  
  hostListHeader.appendChild(addHostButton);
  hostListContainer.appendChild(hostListHeader);

  // Content based on current state
  if (appState.siteAdmin.hostsLoading) {
    // Show loading state
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'flex items-center justify-center py-12';
    
    const loadingSpinner = document.createElement('div');
    loadingSpinner.className = 'animate-spin h-8 w-8 border-4 border-gray-300 rounded-full border-t-blue-600 mr-4';
    loadingDiv.appendChild(loadingSpinner);
    
    const loadingText = document.createElement('p');
    loadingText.className = 'text-gray-600';
    loadingText.textContent = 'Loading hosts...';
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
    const tableContainer = document.createElement('div');
    tableContainer.className = 'overflow-x-auto';
    
    const table = document.createElement('table');
    table.className = 'min-w-full divide-y divide-gray-200';
    
    // Table header
    const thead = document.createElement('thead');
    thead.className = 'bg-gray-50';
    
    const headerRow = document.createElement('tr');
    
    const headers = ['Host Name', 'Secret Link', 'Status', 'Expiry Date', 'Created', 'Actions'];
    headers.forEach(function(headerText) {
        const th = document.createElement('th');
        th.className = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
        th.textContent = headerText;
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Table body
    const tbody = document.createElement('tbody');
    tbody.className = 'bg-white divide-y divide-gray-200';
    
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
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50';
    
    // Name cell
    const nameCell = document.createElement('td');
    nameCell.className = 'px-6 py-4 whitespace-nowrap';
    
    const nameContainer = document.createElement('div');
    const hostName = document.createElement('div');
    hostName.className = 'text-sm font-medium text-gray-900';
    hostName.textContent = host.name;
    nameContainer.appendChild(hostName);
    
    nameCell.appendChild(nameContainer);
    row.appendChild(nameCell);
    
    // Secret Link cell
    const linkCell = document.createElement('td');
    linkCell.className = 'px-6 py-4 whitespace-nowrap';
    
    const linkContainer = document.createElement('div');
    linkContainer.className = 'flex items-center space-x-2';
    
    // Generate the full secret link
    const baseUrl = window.location.protocol + '//' + window.location.host;
    const secretLink = `${baseUrl}/?id=${host.qr_code}`;
    
    const linkValue = document.createElement('span');
    linkValue.className = 'text-sm text-gray-600 font-mono truncate max-w-xs';
    linkValue.textContent = secretLink;
    linkValue.title = secretLink;
    linkContainer.appendChild(linkValue);
    
    const copyButton = document.createElement('button');
    copyButton.className = 'text-blue-600 hover:text-blue-800 transition-colors';
    copyButton.title = 'Copy Secret Link';
    
    const copyIcon = document.createElement('i');
    copyIcon.setAttribute('data-lucide', 'copy');
    copyIcon.className = 'h-4 w-4';
    copyButton.appendChild(copyIcon);
    
    copyButton.addEventListener('click', function() {
        navigator.clipboard.writeText(secretLink);
        showNotification('Secret link copied to clipboard', 'success');
    });
    
    linkContainer.appendChild(copyButton);
    linkCell.appendChild(linkContainer);
    row.appendChild(linkCell);
    
    // Status cell
    const statusCell = document.createElement('td');
    statusCell.className = 'px-6 py-4 whitespace-nowrap';
    
    const statusBadge = document.createElement('span');
    statusBadge.className = 'px-2 inline-flex text-xs leading-5 font-semibold rounded-full';
    
    const now = Date.now() / 1000;
    const isExpired = host.expiry_date && host.expiry_date <= now;
    const isExpiringSoon = host.expiry_date && !isExpired && (host.expiry_date - now) < 7 * 24 * 60 * 60; // 7 days
    
    if (isExpired) {
        statusBadge.className += ' bg-red-100 text-red-800';
        statusBadge.textContent = 'Expired';
    } else if (isExpiringSoon) {
        statusBadge.className += ' bg-yellow-100 text-yellow-800';
        statusBadge.textContent = 'Expiring Soon';
    } else {
        statusBadge.className += ' bg-green-100 text-green-800';
        statusBadge.textContent = 'Active';
    }
    
    statusCell.appendChild(statusBadge);
    row.appendChild(statusCell);
    
    // Expiry Date cell
    const expiryCell = document.createElement('td');
    expiryCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-900';
    
    if (host.expiry_date) {
        const expiryDate = new Date(host.expiry_date * 1000);
        expiryCell.textContent = expiryDate.toLocaleDateString();
    } else {
        expiryCell.textContent = 'Never';
        expiryCell.className += ' text-gray-500';
    }
    
    row.appendChild(expiryCell);
    
    // Created Date cell
    const createdCell = document.createElement('td');
    createdCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500';
    
    const createdDate = new Date(host.creation_date * 1000);
    createdCell.textContent = createdDate.toLocaleDateString();
    row.appendChild(createdCell);
    
    // Actions cell
    const actionsCell = document.createElement('td');
    actionsCell.className = 'px-6 py-4 whitespace-nowrap text-right text-sm font-medium';
    
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'flex space-x-2';
    
    // View QR button
    const qrButton = document.createElement('button');
    qrButton.className = 'text-purple-600 hover:text-purple-900 transition-colors';
    qrButton.textContent = 'QR';
    qrButton.title = 'View QR Code';
    qrButton.addEventListener('click', function() {
        renderHostQRModal(host);
    });
    actionsContainer.appendChild(qrButton);
    
    // Edit button
    const editButton = document.createElement('button');
    editButton.className = 'text-blue-600 hover:text-blue-900 transition-colors';
    editButton.textContent = 'Edit';
    editButton.addEventListener('click', function() {
        renderHostEditModal(host);
    });
    actionsContainer.appendChild(editButton);
    
    // Delete button
    const deleteButton = document.createElement('button');
    deleteButton.className = 'text-red-600 hover:text-red-900 transition-colors';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', function() {
        if (confirm(`Are you sure you want to delete host "${host.name}"?\n\nThis action cannot be undone.`)) {
            // Call the API function from core.js
            deleteHost(host.id).then((success) => {
                if (success) {
                    renderApp(); // Refresh the view
                }
            });
        }
    });
    actionsContainer.appendChild(deleteButton);
    
    actionsCell.appendChild(actionsContainer);
    row.appendChild(actionsCell);
    
    return row;
}

// Build empty state for no hosts
function buildEmptyHostsState(container) {
    const noHosts = document.createElement('div');
    noHosts.className = 'text-center py-12';
    
    const noHostsIcon = document.createElement('div');
    noHostsIcon.className = 'mx-auto h-12 w-12 text-gray-400 mb-4';
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'users');
    icon.className = 'h-12 w-12';
    noHostsIcon.appendChild(icon);
    noHosts.appendChild(noHostsIcon);
    
    const noHostsTitle = document.createElement('h3');
    noHostsTitle.className = 'text-lg font-medium text-gray-900 mb-2';
    noHostsTitle.textContent = 'No hosts found';
    noHosts.appendChild(noHostsTitle);
    
    const noHostsText = document.createElement('p');
    noHostsText.className = 'text-gray-500 mb-6';
    noHostsText.textContent = 'Get started by creating your first game host.';
    noHosts.appendChild(noHostsText);
    
    const createFirstButton = document.createElement('button');
    createFirstButton.className = 'bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors';
    createFirstButton.textContent = 'Create First Host';
    createFirstButton.addEventListener('click', function() {
        renderHostCreationModal();
    });
    noHosts.appendChild(createFirstButton);
    
    container.appendChild(noHosts);
}

// Show error state
function buildHostsError(container, errorMessage) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'text-center py-12';
    
    const errorIcon = document.createElement('div');
    errorIcon.className = 'mx-auto h-12 w-12 text-red-400 mb-4';
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'alert-circle');
    icon.className = 'h-12 w-12';
    errorIcon.appendChild(icon);
    errorDiv.appendChild(errorIcon);
    
    const errorTitle = document.createElement('h3');
    errorTitle.className = 'text-lg font-medium text-gray-900 mb-2';
    errorTitle.textContent = 'Error Loading Hosts';
    errorDiv.appendChild(errorTitle);
    
    const errorText = document.createElement('p');
    errorText.className = 'text-gray-500 mb-6';
    errorText.textContent = errorMessage;
    errorDiv.appendChild(errorText);
    
    const retryButton = document.createElement('button');
    retryButton.className = 'bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors';
    retryButton.textContent = 'Retry';
    retryButton.addEventListener('click', function() {
        renderApp();
    });
    errorDiv.appendChild(retryButton);
    
    container.appendChild(errorDiv);
}

// Host creation modal
function renderHostCreationModal() {
  // Create modal backdrop
  const modalBackdrop = document.createElement('div');
  modalBackdrop.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  modalBackdrop.id = 'host-creation-modal';
  document.body.appendChild(modalBackdrop);

  // Create modal container
  const modalContainer = document.createElement('div');
  modalContainer.className = 'bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4';
  modalBackdrop.appendChild(modalContainer);

  // Modal title
  const modalTitle = document.createElement('h3');
  modalTitle.className = 'text-xl font-bold mb-4';
  modalTitle.textContent = 'Create New Host';
  modalContainer.appendChild(modalTitle);

  // Create form
  const form = document.createElement('form');
  form.className = 'space-y-4';
  modalContainer.appendChild(form);

  // Host name field
  const nameGroup = document.createElement('div');
  
  const nameLabel = document.createElement('label');
  nameLabel.className = 'block text-gray-700 text-sm font-bold mb-2';
  nameLabel.htmlFor = 'new-host-name';
  nameLabel.textContent = 'Host Name';
  nameGroup.appendChild(nameLabel);
  
  const nameInput = document.createElement('input');
  nameInput.className = 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500';
  nameInput.id = 'new-host-name';
  nameInput.type = 'text';
  nameInput.placeholder = 'Enter host name';
  nameInput.required = true;
  nameGroup.appendChild(nameInput);
  
  form.appendChild(nameGroup);

  // Expiry date field
  const expiryGroup = document.createElement('div');
  
  const expiryLabel = document.createElement('label');
  expiryLabel.className = 'block text-gray-700 text-sm font-bold mb-2';
  expiryLabel.htmlFor = 'new-host-expiry';
  expiryLabel.textContent = 'Expiry Date (optional)';
  expiryGroup.appendChild(expiryLabel);
  
  const expiryInput = document.createElement('input');
  expiryInput.className = 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500';
  expiryInput.id = 'new-host-expiry';
  expiryInput.type = 'date';
  
  // Set min date to today
  const today = new Date();
  const formattedDate = today.toISOString().split('T')[0];
  expiryInput.min = formattedDate;
  
  expiryGroup.appendChild(expiryInput);
  
  const expiryNote = document.createElement('p');
  expiryNote.className = 'text-sm text-gray-500 mt-1';
  expiryNote.textContent = 'Leave blank for no expiry date';
  expiryGroup.appendChild(expiryNote);
  
  form.appendChild(expiryGroup);

  // Action buttons
  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'flex gap-4 mt-6';
  
  const cancelButton = document.createElement('button');
  cancelButton.className = 'flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors';
  cancelButton.textContent = 'Cancel';
  cancelButton.type = 'button';
  cancelButton.addEventListener('click', function() {
    document.body.removeChild(modalBackdrop);
  });
  buttonGroup.appendChild(cancelButton);
  
  const submitButton = document.createElement('button');
  submitButton.className = 'flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors';
  submitButton.textContent = 'Create Host';
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
  const modalBackdrop = document.createElement('div');
  modalBackdrop.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  modalBackdrop.id = 'host-qr-modal';
  document.body.appendChild(modalBackdrop);
  
  // Create modal container
  const modalContainer = document.createElement('div');
  modalContainer.className = 'bg-white rounded-lg shadow-xl p-6 w-full max-w-lg mx-4';
  modalBackdrop.appendChild(modalContainer);
  
  // Modal title
  const modalTitle = document.createElement('h3');
  modalTitle.className = 'text-xl font-bold mb-4 text-center';
  modalTitle.textContent = `Host QR Code: ${host.name}`;
  modalContainer.appendChild(modalTitle);
  
  // Host status indicator
  const statusContainer = document.createElement('div');
  statusContainer.className = 'flex justify-center mb-4';
  
  const statusBadge = document.createElement('span');
  statusBadge.className = 'px-3 py-1 text-sm font-medium rounded-full';
  
  const now = Date.now() / 1000;
  const isExpired = host.expiry_date && host.expiry_date <= now;
  const isExpiringSoon = host.expiry_date && !isExpired && (host.expiry_date - now) < 7 * 24 * 60 * 60;
  
  if (isExpired) {
    statusBadge.className += ' bg-red-100 text-red-800';
    statusBadge.textContent = 'Expired';
  } else if (isExpiringSoon) {
    statusBadge.className += ' bg-yellow-100 text-yellow-800';
    statusBadge.textContent = 'Expiring Soon';
  } else {
    statusBadge.className += ' bg-green-100 text-green-800';
    statusBadge.textContent = 'Active';
  }
  
  statusContainer.appendChild(statusBadge);
  modalContainer.appendChild(statusContainer);
  
  // QR code container
  const qrContainer = document.createElement('div');
  qrContainer.className = 'bg-gray-50 p-6 rounded-lg flex flex-col items-center justify-center mb-6';
  
  // QR code div (will contain the actual QR code)
  const qrDiv = document.createElement('div');
  qrDiv.id = `qr-host-${host.id}`;
  qrDiv.className = 'mb-4 bg-white p-4 rounded-lg shadow-sm flex items-center justify-center';
  qrDiv.style.minHeight = '200px';
  qrDiv.style.minWidth = '200px';
  qrContainer.appendChild(qrDiv);
  
  // Generate host secret link
  const baseUrl = window.location.protocol + '//' + window.location.host;
  const hostUrl = `${baseUrl}/?id=${host.qr_code}`;
  
  // Host QR code value display
  const qrValue = document.createElement('div');
  qrValue.className = 'text-center mb-4';
  
  const qrLabel = document.createElement('p');
  qrLabel.className = 'text-sm text-gray-600 mb-2';
  qrLabel.textContent = 'QR Code ID:';
  qrValue.appendChild(qrLabel);
  
  const qrCode = document.createElement('p');
  qrCode.className = 'text-sm font-mono bg-gray-100 px-3 py-2 rounded break-all';
  qrCode.textContent = host.qr_code;
  qrValue.appendChild(qrCode);
  
  qrContainer.appendChild(qrValue);
  
  const linkContainer = document.createElement('div');
  linkContainer.className = 'text-center mb-4';
  
  const linkLabel = document.createElement('p');
  linkLabel.className = 'text-sm text-gray-600 mb-2';
  linkLabel.textContent = 'Secret Link:';
  linkContainer.appendChild(linkLabel);
  
  const hostLink = document.createElement('p');
  hostLink.className = 'text-sm text-blue-600 bg-gray-100 px-3 py-2 rounded break-all';
  hostLink.textContent = hostUrl;
  linkContainer.appendChild(hostLink);
  
  qrContainer.appendChild(linkContainer);
  
  modalContainer.appendChild(qrContainer);
  
  // Action buttons
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'flex gap-3';
  
  // Copy ID button
  const copyIdButton = document.createElement('button');
  copyIdButton.className = 'flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors flex items-center justify-center';
  
  const copyIdIcon = document.createElement('i');
  copyIdIcon.setAttribute('data-lucide', 'copy');
  copyIdIcon.className = 'mr-2 h-4 w-4';
  copyIdButton.appendChild(copyIdIcon);
  
  const copyIdText = document.createElement('span');
  copyIdText.textContent = 'Copy ID';
  copyIdButton.appendChild(copyIdText);
  
  copyIdButton.addEventListener('click', function() {
    navigator.clipboard.writeText(host.qr_code);
    showNotification('QR code ID copied to clipboard', 'success');
  });
  buttonContainer.appendChild(copyIdButton);
  
  // Copy link button
  const copyLinkButton = document.createElement('button');
  copyLinkButton.className = 'flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center';
  
  const copyLinkIcon = document.createElement('i');
  copyLinkIcon.setAttribute('data-lucide', 'link');
  copyLinkIcon.className = 'mr-2 h-4 w-4';
  copyLinkButton.appendChild(copyLinkIcon);
  
  const copyLinkText = document.createElement('span');
  copyLinkText.textContent = 'Copy Link';
  copyLinkButton.appendChild(copyLinkText);
  
  copyLinkButton.addEventListener('click', function() {
    navigator.clipboard.writeText(hostUrl);
    showNotification('Host link copied to clipboard', 'success');
  });
  buttonContainer.appendChild(copyLinkButton);
  
  modalContainer.appendChild(buttonContainer);
  
  // Close button
  const closeButton = document.createElement('button');
  closeButton.className = 'mt-4 w-full bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors';
  closeButton.textContent = 'Close';
  closeButton.addEventListener('click', function() {
    document.body.removeChild(modalBackdrop);
  });
  modalContainer.appendChild(closeButton);
  
  // Generate QR code after modal is in DOM
  setTimeout(() => {
    generateQRCodeForHost(qrDiv.id, hostUrl);
  }, 100);

  // Initialize Lucide icons
  if (window.lucide) window.lucide.createIcons();
  
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
    const fallbackContainer = document.createElement('div');
    fallbackContainer.className = 'text-center text-gray-600 p-8';
    
    const fallbackIcon = document.createElement('i');
    fallbackIcon.setAttribute('data-lucide', 'alert-circle');
    fallbackIcon.className = 'mx-auto h-12 w-12 text-gray-400 mb-2';
    fallbackContainer.appendChild(fallbackIcon);

    const fallbackText1 = document.createElement('p');
    fallbackText1.textContent = 'QR Code generation failed';
    fallbackContainer.appendChild(fallbackText1);

    const fallbackText2 = document.createElement('p');
    fallbackText2.className = 'text-xs mt-1';
    fallbackText2.textContent = 'Use the link above instead';
    fallbackContainer.appendChild(fallbackText2);
    
    qrDiv.appendChild(fallbackContainer);
    
    // Initialize lucide icons for fallback
    if (window.lucide) window.lucide.createIcons();
  }
}

// Host edit modal
function renderHostEditModal(host) {
  // Create modal backdrop
  const modalBackdrop = document.createElement('div');
  modalBackdrop.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  modalBackdrop.id = 'host-edit-modal';
  document.body.appendChild(modalBackdrop);
  
  // Create modal container
  const modalContainer = document.createElement('div');
  modalContainer.className = 'bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4';
  modalBackdrop.appendChild(modalContainer);
  
  // Modal title
  const modalTitle = document.createElement('h3');
  modalTitle.className = 'text-xl font-bold mb-4';
  modalTitle.textContent = 'Edit Host';
  modalContainer.appendChild(modalTitle);
  
  // Create form
  const form = document.createElement('form');
  form.className = 'space-y-4';
  modalContainer.appendChild(form);
  
  // Host name field
  const nameGroup = document.createElement('div');
  
  const nameLabel = document.createElement('label');
  nameLabel.className = 'block text-gray-700 text-sm font-bold mb-2';
  nameLabel.htmlFor = 'edit-host-name';
  nameLabel.textContent = 'Host Name';
  nameGroup.appendChild(nameLabel);
  
  const nameInput = document.createElement('input');
  nameInput.className = 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500';
  nameInput.id = 'edit-host-name';
  nameInput.type = 'text';
  nameInput.value = host.name;
  nameInput.required = true;
  nameGroup.appendChild(nameInput);
  
  form.appendChild(nameGroup);
  
  // Expiry date field
  const expiryGroup = document.createElement('div');
  
  const expiryLabel = document.createElement('label');
  expiryLabel.className = 'block text-gray-700 text-sm font-bold mb-2';
  expiryLabel.htmlFor = 'edit-host-expiry';
  expiryLabel.textContent = 'Expiry Date (optional)';
  expiryGroup.appendChild(expiryLabel);
  
  const expiryInput = document.createElement('input');
  expiryInput.className = 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500';
  expiryInput.id = 'edit-host-expiry';
  expiryInput.type = 'date';
  
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
  
  const expiryNote = document.createElement('p');
  expiryNote.className = 'text-sm text-gray-500 mt-1';
  expiryNote.textContent = 'Leave blank for no expiry date';
  expiryGroup.appendChild(expiryNote);
  
  form.appendChild(expiryGroup);
  
  // Action buttons
  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'flex gap-4 mt-6';
  
  const cancelButton = document.createElement('button');
  cancelButton.className = 'flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors';
  cancelButton.textContent = 'Cancel';
  cancelButton.type = 'button';
  cancelButton.addEventListener('click', function() {
    document.body.removeChild(modalBackdrop);
  });
  buttonGroup.appendChild(cancelButton);
  
  const saveButton = document.createElement('button');
  saveButton.className = 'flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors';
  saveButton.textContent = 'Save Changes';
  saveButton.type = 'submit';
  buttonGroup.appendChild(saveButton);
  
  form.appendChild(buttonGroup);
  
  // Reset button for removing expiry date
  if (host.expiry_date) {
    const resetButton = document.createElement('button');
    resetButton.className = 'w-full text-gray-600 mt-2 text-sm hover:text-gray-800 transition-colors';
    resetButton.textContent = 'Remove Expiry Date';
    resetButton.type = 'button';
    resetButton.addEventListener('click', function() {
      expiryInput.value = '';
    });
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