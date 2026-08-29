// Site Admin module for managing hosts - UI components only, API calls handled by core.js

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

  // Debug console button - only when debug features are enabled on the server
  if (window.QRC_DEBUG_FEATURES) {
    const debugButton = UIBuilder.createButton('Load Debug Console', function() {
      loadErudaDebugConsole();
    }, 'w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors mt-2');

    form.appendChild(debugButton);
  }

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

    // Site settings tab
    const settingsTab = UIBuilder.createButton('Site Settings', null, 'py-2 px-1 border-b-2 font-medium text-sm');
    settingsTab.id = 'settings-tab';

    tabsList.appendChild(hostsTab);
    tabsList.appendChild(gamesTab);
    tabsList.appendChild(settingsTab);
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

        const activeClass = 'py-2 px-1 border-b-2 border-purple-500 text-purple-600 font-medium text-sm';
        const inactiveClass = 'py-2 px-1 border-b-2 border-transparent text-gray-500 hover:text-gray-700 font-medium text-sm';

        hostsTab.className = tabName === 'hosts' ? activeClass : inactiveClass;
        gamesTab.className = tabName === 'games' ? activeClass : inactiveClass;
        settingsTab.className = tabName === 'settings' ? activeClass : inactiveClass;

        if (tabName === 'settings') {
            showSettingsSection();
        } else if (tabName === 'games') {
            showGamesSection();
        } else {
            showHostsSection();
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

        // Trigger games loading if not already loaded/loading. Not after a
        // failure: loading finishes with a re-render, which rebuilds this
        // section, which would ask again - a request loop as fast as the
        // server can refuse, for as long as the tab is open. The error the
        // section is showing carries a Retry button instead.
        if (!appState.siteAdmin.gamesLoaded && !appState.siteAdmin.gamesLoading &&
            !appState.siteAdmin.gamesError) {
            loadSiteAdminGames();
        }
    }

    function showSettingsSection() {
        const contentArea = document.getElementById('admin-content-area');
        if (!contentArea) {
            console.error('Content area not found in showSettingsSection');
            return;
        }

        contentArea.innerHTML = '';
        contentArea.appendChild(buildSiteSettingsSection());

        // Not after a failure - see the note in showGamesSection
        if (!appState.siteAdmin.settingsLoaded && !appState.siteAdmin.settingsLoading &&
            !appState.siteAdmin.settingsError) {
            loadSiteAdminSettings();
        }
    }

    // Set up event listeners after functions are defined
    hostsTab.addEventListener('click', () => setActiveTab('hosts'));
    gamesTab.addEventListener('click', () => setActiveTab('games'));
    settingsTab.addEventListener('click', () => setActiveTab('settings'));

    // Use setTimeout to ensure DOM is ready before setting initial tab
    setTimeout(() => {
        setActiveTab(currentTab);
    }, 0);

    return container;
}

// Build the site settings section (currently just the abuse-reporting contact)
function buildSiteSettingsSection() {
  const container = UIBuilder.createElement('div', {
    className: 'bg-white rounded-lg shadow-md p-6 max-w-2xl'
  });

  const header = UIBuilder.createElement('div', { className: 'mb-4' });
  header.appendChild(UIBuilder.createElement('h3', {
    className: 'text-xl font-semibold text-gray-900',
    textContent: 'Abuse reporting contact'
  }));
  header.appendChild(UIBuilder.createElement('p', {
    className: 'text-gray-600 text-sm mt-1',
    textContent: 'The address players and hosts are given to report content or complain. It appears as a "Report abuse" link in the footer and under the host messages panel. Leave it empty and no reporting route is shown at all.'
  }));
  container.appendChild(header);

  if (appState.siteAdmin.settingsLoading && !appState.siteAdmin.settings) {
    container.appendChild(UIBuilder.createLoadingDisplay('Loading site settings...'));
    return container;
  }

  if (appState.siteAdmin.settingsError) {
    container.appendChild(UIBuilder.createErrorDisplay(
      appState.siteAdmin.settingsError,
      () => refreshSiteAdminSettings()
    ));
    return container;
  }

  const settings = appState.siteAdmin.settings || {};
  const override = settings.abuse_contact_email_override || '';
  const envDefault = settings.abuse_contact_email_default || '';
  const inForce = settings.abuse_contact_email || '';

  // Say plainly which address is live and where it came from, so an admin
  // does not have to guess whether the server was started with one set
  const status = UIBuilder.createElement('div', {
    className: inForce
      ? 'bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 text-sm'
      : 'bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800'
  });
  if (inForce) {
    status.appendChild(UIBuilder.createElement('div', {
      className: 'font-medium text-gray-900 break-all',
      textContent: inForce
    }));
    status.appendChild(UIBuilder.createElement('div', {
      className: 'text-gray-600 mt-1',
      textContent: override
        ? 'Set here in the admin panel.' + (envDefault ? ' Clearing it falls back to ' + envDefault + ' from the ABUSE_CONTACT_EMAIL environment variable.' : '')
        : 'From the ABUSE_CONTACT_EMAIL environment variable.'
    }));
  } else {
    status.textContent = 'No reporting address is set, so players and hosts have no way to report content. Set one below, or start the server with ABUSE_CONTACT_EMAIL.';
  }
  container.appendChild(status);

  const form = UIBuilder.createElement('form');

  const label = UIBuilder.createElement('label', {
    className: 'block text-gray-700 text-sm font-bold mb-2',
    htmlFor: 'abuse-contact-email',
    textContent: 'Contact email address'
  });
  form.appendChild(label);

  const input = UIBuilder.createElement('input', {
    type: 'email',
    id: 'abuse-contact-email',
    className: 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-purple-500',
    placeholder: envDefault || 'abuse@example.com'
  });
  // Set as a property: createElement would otherwise leave a stale attribute
  input.value = override;
  form.appendChild(input);

  form.appendChild(UIBuilder.createElement('p', {
    className: 'text-xs text-gray-500 mt-2',
    textContent: envDefault
      ? "Empty means use the environment variable's address (" + envDefault + ').'
      : 'Empty means no reporting route is shown.'
  }));

  const buttonRow = UIBuilder.createElement('div', { className: 'flex gap-3 mt-4' });

  const saveButton = UIBuilder.createButton('Save', null, 'bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors');
  saveButton.type = 'submit';
  buttonRow.appendChild(saveButton);

  if (override) {
    const clearButton = UIBuilder.createButton('Clear', function() {
      input.value = '';
      form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true }));
    }, 'bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors');
    clearButton.type = 'button';
    buttonRow.appendChild(clearButton);
  }

  form.appendChild(buttonRow);

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    saveButton.disabled = true;
    saveButton.classList.add('opacity-60');

    try {
      await saveAbuseContactEmail(input.value.trim());
      showNotification('Abuse reporting contact updated', 'success');
      // Redraw so the status line, the Clear button and the footer link all
      // reflect what is now stored
      renderApp();
    } catch (err) {
      showNotification(err.message || 'Unable to save site settings', 'error');
      saveButton.disabled = false;
      saveButton.classList.remove('opacity-60');
    }
  });

  container.appendChild(form);

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
    gameListContainer.appendChild(UIBuilder.createLoadingDisplay('Loading games...'));
  } else if (appState.siteAdmin.gamesError) {
    // Show error state
    gameListContainer.appendChild(UIBuilder.createErrorDisplay(appState.siteAdmin.gamesError, () => refreshSiteAdminGames()));
  } else if (appState.siteAdmin.games.length > 0) {
    // Show games table
    buildGamesTable(gameListContainer, appState.siteAdmin.games);
  } else {
    // Show empty state
    gameListContainer.appendChild(UIBuilder.createEmptyState({
      icon: 'gamepad-2',
      title: 'No games found',
      message: 'No games have been created by any hosts yet.'
    }));

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

    // A game's id is a random UUID and identifies nothing to a reader, so the
    // host-given name and the Host column are what name a row here
    const nameContainer = UIBuilder.createElement('div');
    const gameName = UIBuilder.createElement('div', {
      className: 'text-sm font-medium text-gray-900',
      textContent: game.name
    });
    nameContainer.appendChild(gameName);

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
        case 'bonus':
            statusClass += ' bg-amber-100 text-amber-800';
            statusText = 'Bonus round';
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

    // An ended game is deleted automatically once the retention window is up,
    // so say when rather than leaving the admin to work it out. Export it
    // first if the record is worth keeping
    const purgeNote = describePurge(game.purge_after);
    if (purgeNote) {
        statusCell.appendChild(UIBuilder.createElement('div', {
          className: 'text-xs text-gray-500 mt-1',
          textContent: purgeNote
        }));
    }

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

    // Export button - the whole record of the game in one file, taken before
    // it is deleted here or by the retention sweeper
    const exportButton = UIBuilder.createButton('Export', function() {
      exportGameAsAdmin(game);
    }, 'text-blue-600 hover:text-blue-900 transition-colors');
    exportButton.title = 'Download the full record of this game as a JSON file';
    actionsContainer.appendChild(exportButton);

    // Delete button
    const deleteButton = UIBuilder.createButton('Delete', function() {
      if (confirm(`Are you sure you want to DELETE game "${game.name}"?\n\nOnce players have joined, this is the only way a game can be removed - the host cannot do it.\n\nThis will permanently remove:\n- The game and all settings\n- All teams and players\n- All bases and capture history\n- Every message the host sent\n- All associated data\n\nExport it first if you may need the record later.\n\nThis action CANNOT be undone!`)) {
          deleteGameAsAdmin(game);
      }
    }, 'text-red-600 hover:text-red-900 transition-colors');
    deleteButton.title = 'Permanently delete game and all data';
    actionsContainer.appendChild(deleteButton);

    actionsCell.appendChild(actionsContainer);
    row.appendChild(actionsCell);

    return row;
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
    hostListContainer.appendChild(UIBuilder.createLoadingDisplay('Loading hosts...'));
  } else if (appState.siteAdmin.hostsError) {
    // Show error state
    hostListContainer.appendChild(UIBuilder.createErrorDisplay(appState.siteAdmin.hostsError, () => refreshSiteAdminHosts()));
  } else if (appState.siteAdmin.hosts.length > 0) {
    // Show hosts table
    buildHostsTable(hostListContainer, appState.siteAdmin.hosts);
  } else {
    // Show empty state
    hostListContainer.appendChild(UIBuilder.createEmptyState({
      icon: 'users',
      title: 'No hosts found',
      message: 'Get started by creating your first game host.',
      action: {
        text: 'Create First Host',
        onClick: () => renderHostCreationModal()
      }
    }));
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

    // Rotate credentials button. The QR code alone is not the whole
    // credential - the host id its device stores is too - so rotation
    // replaces both and the host has to scan the new code to get back in.
    const rotateButton = UIBuilder.createButton('Rotate', function() {
      const warning = `Rotate credentials for host "${host.name}"?\n\n` +
        'A new QR code and a new host id are issued. Any device currently ' +
        'signed in as this host is signed out and must scan the new QR code. ' +
        'Their games and question bank are kept.\n\nThis cannot be undone.';

      if (!confirm(warning)) return;

      rotateHostCredentials(host.id).then(function(newHost) {
        if (newHost) {
          // Show the new code straight away - it is the only way back in
          renderHostQRModal(newHost);
        }
      }).catch(function() {
        // rotateHostCredentials has already told the admin what went wrong
      });
    }, 'text-amber-600 hover:text-amber-900 transition-colors');
    rotateButton.title = 'Issue a new QR code and host id, revoking the old ones';
    actionsContainer.appendChild(rotateButton);

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

// Host creation modal
function renderHostCreationModal() {
  // Create form content
  const formContent = UIBuilder.createElement('form', { className: 'space-y-4' });

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
  formContent.appendChild(nameGroup);

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
  formContent.appendChild(expiryGroup);

  const modal = UIBuilder.createModal({
    title: 'Create New Host',
    content: formContent,
    actions: [
      {
        text: 'Cancel',
        onClick: () => modal.close(),
        className: 'bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors'
      },
      {
        text: 'Create Host',
        onClick: async () => {
          const name = nameInput.value.trim();
          const expiryDateStr = expiryInput.value;

          if (!name) {
            showNotification('Please enter a host name', 'warning');
            return;
          }

          let expiryDate = null;
          if (expiryDateStr) {
            expiryDate = Math.floor(new Date(expiryDateStr + 'T23:59:59').getTime() / 1000);
          }

          const hostData = { name, expiry_date: expiryDate };

          try {
            const result = await createHost(hostData);
            if (result) {
              modal.close();
              renderApp();
            }
          } catch (error) {
            // Error handling is done in createHost function
          }
        },
        className: 'bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors'
      }
    ]
  });

  document.body.appendChild(modal);

  // Focus on name input
  setTimeout(() => nameInput.focus(), 100);
}

// Host QR code modal
function renderHostQRModal(host) {
  // Simple, print-first content structure
  const qrContent = UIBuilder.createElement('div', {
    className: 'host-qr-content'
  });

  // Print header
  const header = UIBuilder.createElement('div', {
    className: 'print-header'
  });

  const title = UIBuilder.createElement('h1', {
    textContent: 'QR Conquest Host Setup Guide'
  });
  header.appendChild(title);

  // Determine status for inline display
  const now = Date.now() / 1000;
  const isExpired = host.expiry_date && host.expiry_date <= now;
  const isExpiringSoon = host.expiry_date && !isExpired && (host.expiry_date - now) < 7 * 24 * 60 * 60;

  let statusText = 'Active';
  if (isExpired) {
    statusText = 'Expired';
  } else if (isExpiringSoon) {
    statusText = 'Expiring Soon';
  }

  const hostInfo = UIBuilder.createElement('p', {
    textContent: `Host: ${host.name} [${statusText}]`
  });
  header.appendChild(hostInfo);

  const dateInfo = UIBuilder.createElement('p', {
    textContent: `Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit'})}`
  });
  header.appendChild(dateInfo);

  qrContent.appendChild(header);

  // QR code
  const qrDiv = UIBuilder.createElement('div', {
    id: `qr-host-${host.id}`,
    className: 'qr-code'
  });
  qrContent.appendChild(qrDiv);

  // Generate host secret link
  const baseUrl = window.location.protocol + '//' + window.location.host;
  const hostUrl = `${baseUrl}/?id=${host.qr_code}`;

  // Secret Link
  const linkLabel = UIBuilder.createElement('h4', {
    textContent: 'Secret Link:'
  });
  qrContent.appendChild(linkLabel);

  const linkValue = UIBuilder.createElement('p', {
    className: 'code-value',
    textContent: hostUrl
  });
  qrContent.appendChild(linkValue);

  // Instructions
  const instructionsTitle = UIBuilder.createElement('h3', {
    textContent: 'Host Setup Instructions'
  });
  qrContent.appendChild(instructionsTitle);

  const instructionsList = UIBuilder.createElement('ol', {
    className: 'instructions-list'
  });

  const instructions = [
    'Scan the QR code above with your phone camera (or visit the secret link)',
    'This authenticates you as a game host and unlocks game management features',
    'Click "Host a Game" and create your game with appropriate settings',
    'Use "Print QR Codes" to generate QR codes for teams and bases',
    'Place base QR codes at physical locations around your game area',
    'Scan each QR code to assign as team or base',
    'Check that the base locations are correct on the map',
    'Share team QR codes with players so they can join teams',
    'Start the game when you have at least 2 teams and your bases are ready'
  ];

  instructions.forEach(instruction => {
    const listItem = UIBuilder.createElement('li', {
      textContent: instruction
    });
    instructionsList.appendChild(listItem);
  });

  qrContent.appendChild(instructionsList);

  // Important notes
  const notesTitle = UIBuilder.createElement('h4', {
    textContent: 'Important Notes:'
  });
  qrContent.appendChild(notesTitle);

  const notesList = UIBuilder.createElement('ul', {
    className: 'notes-list'
  });

  const notes = [
    'Keep this QR code private - anyone who scans it can host games',
    'If it is ever shared too widely, use "Rotate" on the host list to issue a new one - the old code and the old sign-in stop working immediately',
    'For best GPS performance, install the game as a PWA when prompted',
    'Players need to be close to bases (within 15m by default) to capture them'
  ];

  notes.forEach(note => {
    const listItem = UIBuilder.createElement('li', {
      textContent: note
    });
    notesList.appendChild(listItem);
  });

  qrContent.appendChild(notesList);

  const modal = UIBuilder.createModal({
    title: `Host QR Code: ${host.name}`,
    content: qrContent,
    size: 'lg',
    actions: [
      {
        text: 'Print Setup Guide',
        onClick: () => window.print(),
        className: 'bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition-colors',
        icon: 'printer'
      },
      {
        text: 'Copy Link',
        onClick: () => {
          navigator.clipboard.writeText(hostUrl);
          showNotification('Host link copied to clipboard', 'success');
        },
        className: 'bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors',
        icon: 'link'
      },
      {
        text: 'Close',
        onClick: () => modal.close(),
        className: 'bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors'
      }
    ]
  });

  modal.classList.add('host-qr-modal');
  document.body.appendChild(modal);

  setTimeout(() => generateQRCode(qrDiv.id, hostUrl), 100);
}

// Host edit modal
function renderHostEditModal(host) {
  // Create form content
  const form = UIBuilder.createElement('form', { className: 'space-y-4' });

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

  // Reset button for removing expiry date
  if (host.expiry_date) {
    const resetButton = UIBuilder.createButton('Remove Expiry Date', function() {
      expiryInput.value = '';
    }, 'w-full text-gray-600 mt-2 text-sm hover:text-gray-800 transition-colors');
    form.appendChild(resetButton);
  }

  const modal = UIBuilder.createModal({
    title: 'Edit Host',
    content: form,
    actions: [
      {
        text: 'Cancel',
        onClick: () => modal.close(),
        className: 'bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors'
      },
      {
        text: 'Save Changes',
        onClick: async () => {
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
              modal.close();
              renderApp();
            }
          } catch (error) {
            // Error handling is done in updateHost function
          }
        },
        className: 'bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors'
      }
    ]
  });

  document.body.appendChild(modal);

  // Focus on name input
  setTimeout(() => nameInput.focus(), 100);
}