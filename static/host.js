// Host Panel - UI components only, API calls handled by core.js
function renderHostPanel() {
  const container = UIBuilder.createElement('div');

  // If game is not loaded, show form to create or list existing games
  if (!appState.gameData.id) {
    container.className = 'max-w-2xl mx-auto px-4';

    const title = UIBuilder.createElement('h2', {
      className: 'text-2xl font-bold mb-6 text-center',
      textContent: 'Host Panel'
    });
    container.appendChild(title);

    // Create Game Section
    const createSection = UIBuilder.createElement('div', {
      className: 'bg-white rounded-lg shadow-md p-6 mb-6'
    });

    const createTitle = UIBuilder.createElement('h3', {
      className: 'text-xl font-semibold mb-4',
      textContent: 'Create New Game'
    });
    createSection.appendChild(createTitle);

    // Game Name
    const nameGroup = UIBuilder.createElement('div', { className: 'mb-4' });

    const nameLabel = UIBuilder.createElement('label', {
      className: 'block text-gray-700 mb-2 font-medium',
      textContent: 'Game Name'
    });
    nameGroup.appendChild(nameLabel);

    const nameInput = UIBuilder.createElement('input', {
      type: 'text',
      value: 'QR Conquest',
      className: 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-purple-500',
      id: 'game-name-input'
    });
    nameGroup.appendChild(nameInput);

    createSection.appendChild(nameGroup);

    // Game Settings Section
    const settingsGroup = UIBuilder.createElement('div', { className: 'mb-6' });
    
    const settingsTitle = UIBuilder.createElement('h4', {
      className: 'text-lg font-medium mb-3 text-gray-800',
      textContent: 'Game Settings'
    });
    settingsGroup.appendChild(settingsTitle);

    // Settings Grid
    const settingsGrid = UIBuilder.createElement('div', {
      className: 'grid grid-cols-1 md:grid-cols-2 gap-4 mb-4'
    });

    // Capture Radius
    const radiusGroup = UIBuilder.createElement('div');
    const radiusLabel = UIBuilder.createElement('label', {
      className: 'block text-sm font-medium text-gray-700 mb-1',
      textContent: 'Capture Radius'
    });
    radiusGroup.appendChild(radiusLabel);

    const radiusContainer = UIBuilder.createElement('div', { className: 'flex items-center space-x-2' });
    
    const radiusInput = UIBuilder.createElement('input', {
      type: 'number',
      min: '5',
      max: '500',
      value: '15',
      className: 'flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:border-purple-500',
      id: 'capture-radius-input'
    });
    radiusContainer.appendChild(radiusInput);

    const radiusUnit = UIBuilder.createElement('span', {
      className: 'text-sm text-gray-600',
      textContent: 'metres'
    });
    radiusContainer.appendChild(radiusUnit);

    radiusGroup.appendChild(radiusContainer);

    const radiusHelp = UIBuilder.createElement('p', {
      className: 'text-xs text-gray-500 mt-1',
      textContent: 'How close players must be to capture bases (5-500m)'
    });
    radiusGroup.appendChild(radiusHelp);

    settingsGrid.appendChild(radiusGroup);

    // Points Interval
    const intervalGroup = UIBuilder.createElement('div');
    const intervalLabel = UIBuilder.createElement('label', {
      className: 'block text-sm font-medium text-gray-700 mb-1',
      textContent: 'Points Interval'
    });
    intervalGroup.appendChild(intervalLabel);

    const intervalContainer = UIBuilder.createElement('div', { className: 'space-y-2' });
    
    const intervalSelect = UIBuilder.createElement('select', {
      className: 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-purple-500',
      id: 'points-interval-select'
    });

    const intervalOptions = [
      { value: 5, label: 'Fast (5 seconds)' },
      { value: 15, label: 'Normal (15 seconds)', selected: true },
      { value: 30, label: 'Steady (30 seconds)' },
      { value: 60, label: 'Strategic (1 minute)' },
      { value: 300, label: 'Long (5 minutes)' },
      { value: 'custom', label: 'Custom...' }
    ];

    intervalOptions.forEach(option => {
      const optionElement = UIBuilder.createElement('option', {
        value: option.value,
        textContent: option.label,
        selected: option.selected || false
      });
      intervalSelect.appendChild(optionElement);
    });

    intervalContainer.appendChild(intervalSelect);

    // Custom interval input (initially hidden)
    const customIntervalContainer = UIBuilder.createElement('div', {
      className: 'flex items-center space-x-2',
      style: { display: 'none' },
      id: 'custom-interval-container'
    });

    const customIntervalInput = UIBuilder.createElement('input', {
      type: 'number',
      min: '5',
      max: '3600',
      placeholder: '15',
      className: 'flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:border-purple-500',
      id: 'custom-interval-input'
    });
    customIntervalContainer.appendChild(customIntervalInput);

    const intervalUnitSpan = UIBuilder.createElement('span', {
      className: 'text-sm text-gray-600',
      textContent: 'seconds'
    });
    customIntervalContainer.appendChild(intervalUnitSpan);

    intervalContainer.appendChild(customIntervalContainer);

    intervalGroup.appendChild(intervalContainer);

    const intervalHelp = UIBuilder.createElement('p', {
      className: 'text-xs text-gray-500 mt-1',
      textContent: 'How often teams earn points for holding bases'
    });
    intervalGroup.appendChild(intervalHelp);

    settingsGrid.appendChild(intervalGroup);

    settingsGroup.appendChild(settingsGrid);

    // Advanced Settings (collapsible)
    const advancedToggle = UIBuilder.createElement('button', {
      type: 'button',
      className: 'flex items-center text-sm text-purple-600 hover:text-purple-800 transition-colors mb-3',
      id: 'advanced-settings-toggle'
    });

    const toggleIcon = UIBuilder.createElement('i', {
      'data-lucide': 'chevron-right',
      className: 'w-4 h-4 mr-1 transition-transform',
      id: 'toggle-icon'
    });
    advancedToggle.appendChild(toggleIcon);

    const toggleText = UIBuilder.createElement('span', {
      textContent: 'Advanced Settings (Auto-start, Duration)'
    });
    advancedToggle.appendChild(toggleText);

    settingsGroup.appendChild(advancedToggle);

    // Advanced settings container (initially hidden)
    const advancedContainer = UIBuilder.createElement('div', {
      className: 'grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4',
      style: { display: 'none' },
      id: 'advanced-settings-container'
    });

    // Auto-start time
    const autoStartGroup = UIBuilder.createElement('div');
    const autoStartLabel = UIBuilder.createElement('label', {
      className: 'block text-sm font-medium text-gray-700 mb-1',
      textContent: 'Auto-start Time (optional)'
    });
    autoStartGroup.appendChild(autoStartLabel);

    const autoStartInput = UIBuilder.createElement('input', {
      type: 'datetime-local',
      className: 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-purple-500',
      id: 'auto-start-input'
    });
    
    // Set minimum to current time
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5); // Default to 5 minutes from now
    autoStartInput.min = now.toISOString().slice(0, 16);
    
    autoStartGroup.appendChild(autoStartInput);

    const autoStartHelp = UIBuilder.createElement('p', {
      className: 'text-xs text-gray-500 mt-1',
      textContent: 'Game will start automatically at this time'
    });
    autoStartGroup.appendChild(autoStartHelp);

    advancedContainer.appendChild(autoStartGroup);

    // Game duration
    const durationGroup = UIBuilder.createElement('div');
    const durationLabel = UIBuilder.createElement('label', {
      className: 'block text-sm font-medium text-gray-700 mb-1',
      textContent: 'Game Duration (optional)'
    });
    durationGroup.appendChild(durationLabel);

    const durationContainer = UIBuilder.createElement('div', { className: 'space-y-2' });

    const durationSelect = UIBuilder.createElement('select', {
      className: 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-purple-500',
      id: 'duration-select'
    });

    const durationOptions = [
      { value: '', label: 'Manual end only' },
      { value: 30, label: '30 minutes' },
      { value: 60, label: '1 hour' },
      { value: 120, label: '2 hours' },
      { value: 240, label: '4 hours' },
      { value: 480, label: '8 hours' },
      { value: 1440, label: '1 day' },
      { value: 4320, label: '3 days' },
      { value: 'custom', label: 'Custom...' }
    ];

    durationOptions.forEach(option => {
      const optionElement = UIBuilder.createElement('option', {
        value: option.value,
        textContent: option.label
      });
      durationSelect.appendChild(optionElement);
    });

    durationContainer.appendChild(durationSelect);

    // Custom duration input (initially hidden)
    const customDurationContainer = UIBuilder.createElement('div', {
      className: 'flex items-center space-x-2',
      style: { display: 'none' },
      id: 'custom-duration-container'
    });

    const customDurationInput = UIBuilder.createElement('input', {
      type: 'number',
      min: '1',
      max: '43200',
      placeholder: '60',
      className: 'flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:border-purple-500',
      id: 'custom-duration-input'
    });
    customDurationContainer.appendChild(customDurationInput);

    const durationUnitSpan = UIBuilder.createElement('span', {
      className: 'text-sm text-gray-600',
      textContent: 'minutes'
    });
    customDurationContainer.appendChild(durationUnitSpan);

    durationContainer.appendChild(customDurationContainer);

    durationGroup.appendChild(durationContainer);

    const durationHelp = UIBuilder.createElement('p', {
      className: 'text-xs text-gray-500 mt-1',
      textContent: 'Game will end automatically after this time'
    });
    durationGroup.appendChild(durationHelp);

    advancedContainer.appendChild(durationGroup);

    settingsGroup.appendChild(advancedContainer);
    createSection.appendChild(settingsGroup);

    // Event Handlers for Dynamic UI
    // Handle custom interval selection
    intervalSelect.addEventListener('change', function() {
      const customContainer = document.getElementById('custom-interval-container');
      if (this.value === 'custom') {
        customContainer.style.display = 'flex';
        document.getElementById('custom-interval-input').focus();
      } else {
        customContainer.style.display = 'none';
      }
    });

    // Handle custom duration selection
    durationSelect.addEventListener('change', function() {
      const customContainer = document.getElementById('custom-duration-container');
      if (this.value === 'custom') {
        customContainer.style.display = 'flex';
        document.getElementById('custom-duration-input').focus();
      } else {
        customContainer.style.display = 'none';
      }
    });

    // Handle advanced settings toggle
    advancedToggle.addEventListener('click', function() {
      const container = document.getElementById('advanced-settings-container');
      const icon = document.getElementById('toggle-icon');
      
      if (container.style.display === 'none') {
        container.style.display = 'grid';
        icon.style.transform = 'rotate(90deg)';
      } else {
        container.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
      }
    });

    // Note about teams
    const teamsNoteGroup = UIBuilder.createElement('div', {
      className: 'mb-4 bg-yellow-100 border border-yellow-400 text-yellow-700 p-3 rounded-lg'
    });

    const teamsNoteText = UIBuilder.createElement('p');
    const noteStrong = UIBuilder.createElement('strong', { textContent: 'Note:' });
    teamsNoteText.appendChild(noteStrong);
    teamsNoteText.appendChild(document.createTextNode(' Teams must be added by scanning QR codes after game creation. At least 2 teams will be required before starting the game.'));
    teamsNoteGroup.appendChild(teamsNoteText);

    createSection.appendChild(teamsNoteGroup);

    // Create Game Button
    const createButton = UIBuilder.createButton('Create Game', function() {
      validateGameCreation();
    }, 'w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors text-lg font-medium');
    createSection.appendChild(createButton);

    container.appendChild(createSection);

    // Existing Games Section
    const existingGamesSection = UIBuilder.createElement('div', {
      className: 'bg-white rounded-lg shadow-md p-6 mb-6'
    });

    const existingGamesTitle = UIBuilder.createElement('h3', {
      className: 'text-xl font-semibold mb-4',
      textContent: 'Your Existing Games'
    });
    existingGamesSection.appendChild(existingGamesTitle);

    // Games list container - will be populated by loadHostGames
    const gamesListContainer = UIBuilder.createElement('div', {
      id: 'host-games-list',
      className: 'space-y-3'
    });
    existingGamesSection.appendChild(gamesListContainer);

    container.appendChild(existingGamesSection);

    // Load host games after rendering
    setTimeout(() => loadHostGames(), 100);

    // Back to Home link
    const backContainer = UIBuilder.createElement('div', { className: 'text-center mt-6' });

    const backButton = UIBuilder.createButton('Back to Home', function() {
      navigateTo('landing');
    }, 'text-gray-600 hover:text-gray-800 transition-colors py-2');
    backContainer.appendChild(backButton);

    container.appendChild(backContainer);

    return container;
  }

  // Game Management Panel (if game is loaded) - rest of function remains the same
  container.className = 'max-w-4xl mx-auto px-4 pb-4';

  const title = UIBuilder.createElement('h2', {
    className: 'text-2xl font-bold mb-6 text-center',
    textContent: 'Game Administration'
  });
  container.appendChild(title);

  const grid = UIBuilder.createElement('div', { className: 'space-y-6' });

  // Game Info Section
  const infoSection = UIBuilder.createElement('div', {
    className: 'bg-white rounded-lg shadow-md p-4'
  });

  const infoTitle = UIBuilder.createElement('h3', {
    className: 'text-xl font-semibold mb-3',
    textContent: 'Game Info'
  });
  infoSection.appendChild(infoTitle);

  const gameInfoGrid = UIBuilder.createElement('div', {
    className: 'grid grid-cols-1 sm:grid-cols-2 gap-4'
  });

  const gameIdCard = UIBuilder.createElement('div', { className: 'bg-gray-50 p-3 rounded-lg' });
  const gameIdLabel = UIBuilder.createElement('div', {
    className: 'text-sm text-gray-600 font-medium',
    textContent: 'Game ID'
  });
  gameIdCard.appendChild(gameIdLabel);
  const gameIdValue = UIBuilder.createElement('div', {
    className: 'text-lg font-bold text-purple-600',
    textContent: appState.gameData.id
  });
  gameIdCard.appendChild(gameIdValue);
  gameInfoGrid.appendChild(gameIdCard);

  const statusCard = UIBuilder.createElement('div', { className: 'bg-gray-50 p-3 rounded-lg' });
  const statusLabel = UIBuilder.createElement('div', {
    className: 'text-sm text-gray-600 font-medium',
    textContent: 'Status'
  });
  statusCard.appendChild(statusLabel);
  const statusValue = UIBuilder.createElement('div', {
    className: 'text-lg font-bold capitalize' + (
      appState.gameData.status === 'active' ? ' text-green-600' :
      appState.gameData.status === 'setup' ? ' text-orange-600' : ' text-gray-600'
    ),
    textContent: appState.gameData.status
  });
  statusCard.appendChild(statusValue);
  gameInfoGrid.appendChild(statusCard);

  infoSection.appendChild(gameInfoGrid);
  grid.appendChild(infoSection);

  // Game Settings Section
  const settingsSection = UIBuilder.createElement('div', {
    className: 'bg-white rounded-lg shadow-md p-4'
  });

  const settingsTitle = UIBuilder.createElement('h3', {
    className: 'text-xl font-semibold mb-3',
    textContent: 'Game Settings'
  });
  settingsSection.appendChild(settingsTitle);

  const settingsGrid = UIBuilder.createElement('div', {
    className: 'grid grid-cols-2 sm:grid-cols-4 gap-4'
  });

  // Helper function to format time
  function formatDuration(minutes) {
    if (!minutes) return 'Manual end';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  }

  // Helper function to format points interval
  function formatPointsInterval(seconds) {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  }

  const settings = appState.gameData.settings || {};

  // Capture Radius
  const radiusCard = UIBuilder.createElement('div', { className: 'bg-gray-50 p-3 rounded-lg text-center' });
  const radiusLabel = UIBuilder.createElement('div', {
    className: 'text-sm text-gray-600 font-medium',
    textContent: 'Capture Radius'
  });
  radiusCard.appendChild(radiusLabel);
  const radiusValue = UIBuilder.createElement('div', {
    className: 'text-lg font-bold text-blue-600',
    textContent: `${settings.capture_radius_meters || 15}m`
  });
  radiusCard.appendChild(radiusValue);
  settingsGrid.appendChild(radiusCard);

  // Points Interval  
  const intervalCard = UIBuilder.createElement('div', { className: 'bg-gray-50 p-3 rounded-lg text-center' });
  const intervalLabel = UIBuilder.createElement('div', {
    className: 'text-sm text-gray-600 font-medium',
    textContent: 'Points Interval'
  });
  intervalCard.appendChild(intervalLabel);
  const intervalValue = UIBuilder.createElement('div', {
    className: 'text-lg font-bold text-green-600',
    textContent: formatPointsInterval(settings.points_interval_seconds || 15)
  });
  intervalCard.appendChild(intervalValue);
  settingsGrid.appendChild(intervalCard);

  // Auto-start
  const autoStartCard = UIBuilder.createElement('div', { className: 'bg-gray-50 p-3 rounded-lg text-center' });
  const autoStartLabel = UIBuilder.createElement('div', {
    className: 'text-sm text-gray-600 font-medium',
    textContent: 'Auto-start'
  });
  autoStartCard.appendChild(autoStartLabel);
  let autoStartText = 'Manual';
  if (settings.auto_start_time) {
    const startTime = new Date(settings.auto_start_time * 1000);
    autoStartText = startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  }
  const autoStartValue = UIBuilder.createElement('div', {
    className: 'text-lg font-bold text-purple-600',
    textContent: autoStartText
  });
  autoStartCard.appendChild(autoStartValue);
  settingsGrid.appendChild(autoStartCard);

  // Duration
  const durationCard = UIBuilder.createElement('div', { className: 'bg-gray-50 p-3 rounded-lg text-center' });
  const durationLabel = UIBuilder.createElement('div', {
    className: 'text-sm text-gray-600 font-medium',
    textContent: 'Duration'
  });
  durationCard.appendChild(durationLabel);
  const durationValue = UIBuilder.createElement('div', {
    className: 'text-lg font-bold text-orange-600',
    textContent: formatDuration(settings.game_duration_minutes)
  });
  durationCard.appendChild(durationValue);
  settingsGrid.appendChild(durationCard);

  settingsSection.appendChild(settingsGrid);

  // Settings actions (only show for games in setup)
  if (appState.gameData.status === 'setup') {
    const settingsActions = UIBuilder.createElement('div', {
      className: 'mt-4 pt-3 border-t'
    });
    
    const editSettingsBtn = UIBuilder.createButton('Edit Settings', function() {
      renderGameSettingsModal();
    }, 'bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm', 'settings');
    
    settingsActions.appendChild(editSettingsBtn);
    settingsSection.appendChild(settingsActions);
  }

  grid.appendChild(settingsSection);
  
  // QR Code Management Section
  const qrSection = UIBuilder.createElement('div', {
    className: 'bg-white rounded-lg shadow-md p-4'
  });

  const qrTitle = UIBuilder.createElement('h3', {
    className: 'text-xl font-semibold mb-3',
    textContent: 'QR Code Management'
  });
  qrSection.appendChild(qrTitle);

  const qrDescription = UIBuilder.createElement('p', {
    className: 'text-gray-600 mb-4 text-sm',
    textContent: 'Scan QR codes to add them as teams or bases for the game.'
  });
  qrSection.appendChild(qrDescription);

  // QR Code actions container
  const qrActionsContainer = UIBuilder.createElement('div', { className: 'space-y-3' });

  const scanQRButton = UIBuilder.createButton('Scan QR Code', function() {
    navigateTo('scanQR');
  }, 'w-full bg-purple-600 text-white py-3 px-4 rounded-lg flex items-center justify-center hover:bg-purple-700 transition-colors text-lg font-medium', 'qr-code');
  qrActionsContainer.appendChild(scanQRButton);

  // Print QR Codes button
  const printQRButton = UIBuilder.createButton('Print QR Codes', function() {
    // Open QR code generator in new tab
    window.open('/code-generator/', '_blank');
  }, 'w-full bg-green-600 text-white py-3 px-4 rounded-lg flex items-center justify-center hover:bg-green-700 transition-colors text-lg font-medium', 'printer');
  qrActionsContainer.appendChild(printQRButton);

  qrSection.appendChild(qrActionsContainer);

  // Add instruction text to emphasise the QR-first approach
  const instructionText = UIBuilder.createElement('p', {
    className: 'text-amber-600 text-sm mt-2 text-center',
    textContent: 'Note: Teams and bases can only be created by scanning QR codes first.'
  });
  qrSection.appendChild(instructionText);

  grid.appendChild(qrSection);

  // Team Management Section - Mobile Optimized
  const teamSection = UIBuilder.createElement('div', {
    className: 'bg-white rounded-lg shadow-md p-4'
  });

  const teamTitle = UIBuilder.createElement('h3', {
    className: 'text-xl font-semibold mb-4',
    textContent: 'Team Management'
  });
  teamSection.appendChild(teamTitle);

  if (appState.gameData.teams && appState.gameData.teams.length > 0) {
    const teamsContainer = UIBuilder.createElement('div', { className: 'space-y-3' });

    appState.gameData.teams.forEach(function(team) {
      const teamCard = UIBuilder.createElement('div', {
        className: 'border border-gray-200 rounded-lg p-4 bg-gray-50'
      });

      // Team header with color and name
      const teamHeader = UIBuilder.createElement('div', {
        className: 'flex items-center justify-between mb-3'
      });

      const teamNameContainer = UIBuilder.createElement('div', {
        className: 'flex items-center'
      });

      const colorDot = UIBuilder.createElement('div', {
        className: 'w-4 h-4 rounded-full ' + team.color + ' mr-3 flex-shrink-0'
      });
      teamNameContainer.appendChild(colorDot);

      const teamName = UIBuilder.createElement('h4', {
        className: 'text-lg font-semibold text-gray-900',
        textContent: team.name
      });
      teamNameContainer.appendChild(teamName);

      teamHeader.appendChild(teamNameContainer);

      // Edit button
      const editButton = UIBuilder.createButton('Edit', function() {
        renderTeamEditModal(team);
      }, 'bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors flex items-center', 'edit-2');
      teamHeader.appendChild(editButton);

      teamCard.appendChild(teamHeader);

      // Team stats
      const teamStats = UIBuilder.createElement('div', { className: 'grid grid-cols-2 gap-4' });

      const playersContainer = UIBuilder.createElement('div', {
        className: 'text-center bg-white p-3 rounded-lg'
      });
      const playersLabel = UIBuilder.createElement('div', {
        className: 'text-sm text-gray-600 font-medium',
        textContent: 'Players'
      });
      playersContainer.appendChild(playersLabel);
      const playersValue = UIBuilder.createElement('div', {
        className: 'text-2xl font-bold text-purple-600',
        textContent: team.playerCount || 0
      });
      playersContainer.appendChild(playersValue);

      const scoreContainer = UIBuilder.createElement('div', {
        className: 'text-center bg-white p-3 rounded-lg'
      });
      const scoreLabel = UIBuilder.createElement('div', {
        className: 'text-sm text-gray-600 font-medium',
        textContent: 'Score'
      });
      scoreContainer.appendChild(scoreLabel);
      const scoreValue = UIBuilder.createElement('div', {
        className: 'text-2xl font-bold text-green-600',
        textContent: team.score || 0
      });
      scoreContainer.appendChild(scoreValue);

      teamStats.appendChild(playersContainer);
      teamStats.appendChild(scoreContainer);
      teamCard.appendChild(teamStats);

      teamsContainer.appendChild(teamCard);
    });

    teamSection.appendChild(teamsContainer);
  } else {
    // Show prompt to add teams when there are none
    const emptyState = UIBuilder.createElement('div', {
      className: 'text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300'
    });

    const emptyIcon = UIBuilder.createElement('i', {
      'data-lucide': 'users',
      className: 'w-12 h-12 text-gray-400 mx-auto mb-3'
    });
    emptyState.appendChild(emptyIcon);

    const emptyTitle = UIBuilder.createElement('h4', {
      className: 'text-lg font-medium text-gray-900 mb-2',
      textContent: 'No Teams Yet'
    });
    emptyState.appendChild(emptyTitle);

    const emptyText = UIBuilder.createElement('p', {
      className: 'text-gray-600 mb-4',
      textContent: 'Scan QR codes to add teams to your game.'
    });
    emptyState.appendChild(emptyText);

    const addTeamButton = UIBuilder.createButton('Scan QR Code', function() {
      navigateTo('scanQR');
    }, 'bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors inline-flex items-center', 'qr-code');
    emptyState.appendChild(addTeamButton);

    teamSection.appendChild(emptyState);
  }

  grid.appendChild(teamSection);

  // Base Management Section - Mobile Optimized with Map
  const baseSection = UIBuilder.createElement('div', {
    className: 'bg-white rounded-lg shadow-md p-4'
  });

  const baseTitle = UIBuilder.createElement('h3', {
    className: 'text-xl font-semibold mb-4',
    textContent: 'Base Management'
  });
  baseSection.appendChild(baseTitle);

  if (appState.gameData.bases && appState.gameData.bases.length > 0) {
    // Map container
    const mapContainer = UIBuilder.createElement('div', {
      id: 'map-container',
      className: 'bg-gray-200 rounded-lg shadow-sm h-64 mb-4 relative'
    });
    baseSection.appendChild(mapContainer);

    // Bases list
    const basesContainer = UIBuilder.createElement('div', { className: 'space-y-3' });

    appState.gameData.bases.forEach(function(base) {
      const baseCard = UIBuilder.createElement('div', {
        className: 'border border-gray-200 rounded-lg p-4 bg-gray-50'
      });

      // Base header
      const baseHeader = UIBuilder.createElement('div', {
        className: 'flex items-center justify-between mb-3'
      });

      const baseName = UIBuilder.createElement('h4', {
        className: 'text-lg font-semibold text-gray-900',
        textContent: base.name
      });
      baseHeader.appendChild(baseName);

      // Owner indicator
      const ownerContainer = UIBuilder.createElement('div', {
        className: 'flex items-center text-sm'
      });

      if (base.ownedBy) {
        const owningTeam = appState.gameData.teams.find(t => t.id === base.ownedBy);
        if (owningTeam) {
          const ownerDot = UIBuilder.createElement('div', {
            className: 'w-3 h-3 rounded-full ' + owningTeam.color + ' mr-2'
          });
          ownerContainer.appendChild(ownerDot);

          const ownerName = UIBuilder.createElement('span', {
            className: 'font-medium text-gray-700',
            textContent: owningTeam.name
          });
          ownerContainer.appendChild(ownerName);
        } else {
          const unknownOwner = UIBuilder.createElement('span', {
            className: 'text-gray-500',
            textContent: 'Unknown Team'
          });
          ownerContainer.appendChild(unknownOwner);
        }
      } else {
        const uncaptured = UIBuilder.createElement('span', {
          className: 'text-gray-500 italic',
          textContent: 'Uncaptured'
        });
        ownerContainer.appendChild(uncaptured);
      }

      baseHeader.appendChild(ownerContainer);
      baseCard.appendChild(baseHeader);

      // Base coordinates (smaller, less prominent)
      const coordinates = UIBuilder.createElement('div', {
        className: 'text-xs text-gray-500 font-mono bg-white px-2 py-1 rounded',
        textContent: `${base.lat.toFixed(4)}, ${base.lng.toFixed(4)}`
      });
      baseCard.appendChild(coordinates);

      basesContainer.appendChild(baseCard);
    });

    baseSection.appendChild(basesContainer);

    // Initialize game map after section is added to DOM
    setTimeout(() => initGameMap(), 100);
  } else {
    // Show prompt to add bases when there are none
    const emptyState = UIBuilder.createElement('div', {
      className: 'text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300'
    });

    const emptyIcon = UIBuilder.createElement('i', {
      'data-lucide': 'map-pin',
      className: 'w-12 h-12 text-gray-400 mx-auto mb-3'
    });
    emptyState.appendChild(emptyIcon);

    const emptyTitle = UIBuilder.createElement('h4', {
      className: 'text-lg font-medium text-gray-900 mb-2',
      textContent: 'No Bases Yet'
    });
    emptyState.appendChild(emptyTitle);

    const emptyText = UIBuilder.createElement('p', {
      className: 'text-gray-600 mb-4',
      textContent: 'Scan QR codes to add bases to your game.'
    });
    emptyState.appendChild(emptyText);

    const addBaseButton = UIBuilder.createButton('Scan QR Code', function() {
      navigateTo('scanQR');
    }, 'bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors inline-flex items-center', 'qr-code');
    emptyState.appendChild(addBaseButton);

    baseSection.appendChild(emptyState);
  }

  grid.appendChild(baseSection);

  // Game Control Section - Mobile Optimized
  const controlSection = UIBuilder.createElement('div', {
    className: 'bg-white rounded-lg shadow-md p-4'
  });

  const controlTitle = UIBuilder.createElement('h3', {
    className: 'text-xl font-semibold mb-4',
    textContent: 'Game Control'
  });
  controlSection.appendChild(controlTitle);

  const controlButtons = UIBuilder.createElement('div', { className: 'space-y-3' });

  // Show different buttons based on game status
  if (appState.gameData.status === 'active') {
    // Game is running - show only End Game button
    const endButton = UIBuilder.createButton('End Game', function() {
      // Confirm before ending
      if (confirm('Are you sure you want to end the game? This will end the current game and release all QR codes for reuse.')) {
        // Call the API function from core.js
        endGame();
      }
    }, 'w-full bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 transition-colors text-lg font-medium flex items-center justify-center', 'stop-circle');
    controlButtons.appendChild(endButton);

  } else if (appState.gameData.status === 'setup') {
    // Game is in setup - show only Start Game button
    const hasEnoughTeams = appState.gameData.teams && appState.gameData.teams.length >= 2;

    const startButton = UIBuilder.createButton(
      hasEnoughTeams ? 'Start Game' : 'Need 2+ Teams to Start',
      function() {
        // Double check team count before starting
        if (appState.gameData.teams && appState.gameData.teams.length >= 2) {
          // Call the API function from core.js
          startGame();
        } else {
          showNotification('Cannot start game. Please add at least 2 teams by scanning QR codes.', 'error');
        }
      },
      hasEnoughTeams
        ? 'w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors text-lg font-medium flex items-center justify-center'
        : 'w-full bg-gray-400 text-white py-3 px-4 rounded-lg cursor-not-allowed text-lg font-medium flex items-center justify-center',
      'play-circle'
    );

    if (!hasEnoughTeams) {
      startButton.disabled = true;
      startButton.title = 'At least 2 teams required to start game';
    }

    controlButtons.appendChild(startButton);
  } else if (appState.gameData.status === 'ended') {
    // Game is ended - show message
    const gameEndedMsg = UIBuilder.createElement('div', {
      className: 'bg-gray-100 rounded-lg p-4 text-gray-600 mb-4 text-center'
    });

    const endedIcon = UIBuilder.createElement('i', {
      'data-lucide': 'check-circle',
      className: 'w-6 h-6 mx-auto mb-2 text-gray-500'
    });
    gameEndedMsg.appendChild(endedIcon);

    const endedText = UIBuilder.createElement('p', {
      textContent: 'This game has ended. QR codes have been released and can be reused in other games.'
    });
    gameEndedMsg.appendChild(endedText);

    controlSection.appendChild(gameEndedMsg);
  }

  const exitButton = UIBuilder.createButton('Exit Host Panel', function() {
    navigateTo('landing');
  }, 'w-full bg-gray-600 text-white py-3 px-4 rounded-lg hover:bg-gray-700 transition-colors text-lg font-medium flex items-center justify-center', 'log-out');
  controlButtons.appendChild(exitButton);

  controlSection.appendChild(controlButtons);
  grid.appendChild(controlSection);

  container.appendChild(grid);

  return container;
}

// New function to load and display host games
async function loadHostGames() {
  const authState = getAuthState();
  if (!authState.isHost) {
    return;
  }

  const gamesListContainer = document.getElementById('host-games-list');
  if (!gamesListContainer) {
    console.error('Games list container not found');
    return;
  }

  try {
    // Show loading state
    gamesListContainer.innerHTML = '';
    const loadingDiv = UIBuilder.createElement('div', {
      className: 'flex items-center justify-center py-6'
    });

    const loadingSpinner = UIBuilder.createElement('div', {
      className: 'animate-spin h-6 w-6 border-2 border-gray-300 rounded-full border-t-purple-600 mr-3'
    });
    loadingDiv.appendChild(loadingSpinner);

    const loadingText = UIBuilder.createElement('span', {
      className: 'text-gray-600',
      textContent: 'Loading your games...'
    });
    loadingDiv.appendChild(loadingText);

    gamesListContainer.appendChild(loadingDiv);

    // Fetch games for this host
    const games = await fetchHostGames(authState.hostId);

    // Clear loading state
    gamesListContainer.innerHTML = '';

    if (games.length === 0) {
      // Show empty state
      const emptyDiv = UIBuilder.createElement('div', {
        className: 'text-center py-6 text-gray-500'
      });

      const emptyIcon = UIBuilder.createElement('i', {
        'data-lucide': 'gamepad-2',
        className: 'w-8 h-8 mx-auto mb-2 text-gray-400'
      });
      emptyDiv.appendChild(emptyIcon);

      const emptyText = UIBuilder.createElement('p', {
        textContent: 'You haven\'t created any games yet. Create your first game above!'
      });
      emptyDiv.appendChild(emptyText);

      gamesListContainer.appendChild(emptyDiv);
    } else {
      // Show games list
      games.forEach(function(game) {
        const gameCard = UIBuilder.createElement('div', {
          className: 'border border-gray-200 rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors'
        });

        // Game header
        const gameHeader = UIBuilder.createElement('div', {
          className: 'flex items-center justify-between mb-2'
        });

        const gameInfo = UIBuilder.createElement('div');

        const gameName = UIBuilder.createElement('h4', {
          className: 'text-lg font-semibold text-gray-900',
          textContent: game.name
        });
        gameInfo.appendChild(gameName);

        const gameId = UIBuilder.createElement('p', {
          className: 'text-sm text-gray-600',
          textContent: `ID: ${game.id}`
        });
        gameInfo.appendChild(gameId);

        gameHeader.appendChild(gameInfo);

        // Status badge
        let statusClass = 'px-2 py-1 text-xs font-medium rounded-full';
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
        gameHeader.appendChild(statusBadge);

        gameCard.appendChild(gameHeader);

        // Game stats
        const gameStats = UIBuilder.createElement('div', {
          className: 'flex items-center text-sm text-gray-600 mb-3'
        });

        const teamCount = UIBuilder.createElement('span', {
          className: 'mr-4',
          textContent: `${game.team_count || 0} teams`
        });
        gameStats.appendChild(teamCount);

        // Add creation date if available
        if (game.start_time) {
          const startDate = new Date(game.start_time * 1000);
          const dateSpan = UIBuilder.createElement('span', {
            textContent: `Started: ${startDate.toLocaleDateString()}`
          });
          gameStats.appendChild(dateSpan);
        } else {
          const notStartedSpan = UIBuilder.createElement('span', {
            textContent: 'Not started yet'
          });
          gameStats.appendChild(notStartedSpan);
        }

        gameCard.appendChild(gameStats);

        // Action button
        const actionButton = UIBuilder.createElement('div');

        if (game.status === 'setup' || game.status === 'active') {
          const manageButton = UIBuilder.createButton('Continue Managing', function() {
            // Load this game and navigate to host panel
            localStorage.setItem('gameId', game.id);
            fetchGameData(game.id).then(() => {
              // The fetchGameData will trigger a re-render showing the game management interface
            });
          }, 'bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium');
          actionButton.appendChild(manageButton);
        } else if (game.status === 'ended') {
          const resultsButton = UIBuilder.createButton('View Results', function() {
            // Load this game and navigate to results
            localStorage.setItem('gameId', game.id);
            fetchGameData(game.id).then(() => {
              navigateTo('results');
            });
          }, 'bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium');
          actionButton.appendChild(resultsButton);
        }

        gameCard.appendChild(actionButton);
        gamesListContainer.appendChild(gameCard);
      });
    }

    // Initialize Lucide icons
    if (window.lucide) {
      window.lucide.createIcons();
    }

  } catch (error) {
    // Show error state
    gamesListContainer.innerHTML = '';
    const errorDiv = UIBuilder.createElement('div', {
      className: 'text-center py-6'
    });

    const errorIcon = UIBuilder.createElement('i', {
      'data-lucide': 'alert-circle',
      className: 'w-8 h-8 mx-auto mb-2 text-red-400'
    });
    errorDiv.appendChild(errorIcon);

    const errorText = UIBuilder.createElement('p', {
      className: 'text-red-600',
      textContent: 'Failed to load your games. Please try refreshing the page.'
    });
    errorDiv.appendChild(errorText);

    gamesListContainer.appendChild(errorDiv);

    // Initialize Lucide icons for error state
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }
}

function renderGameSettingsModal() {
  // Create modal backdrop
  const modalBackdrop = UIBuilder.createElement('div', {
    className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
    id: 'game-settings-modal'
  });
  document.body.appendChild(modalBackdrop);

  // Create modal container
  const modalContainer = UIBuilder.createElement('div', {
    className: 'bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto'
  });
  modalBackdrop.appendChild(modalContainer);

  // Modal title
  const modalTitle = UIBuilder.createElement('h3', {
    className: 'text-xl font-bold mb-4',
    textContent: 'Edit Game Settings'
  });
  modalContainer.appendChild(modalTitle);

  // Get current settings
  const settings = appState.gameData.settings || {};

  // Create form
  const form = UIBuilder.createElement('form', { className: 'space-y-6' });

  // Basic Settings
  const basicSection = UIBuilder.createElement('div');
  const basicTitle = UIBuilder.createElement('h4', {
    className: 'text-lg font-medium mb-3 text-gray-800',
    textContent: 'Basic Settings'
  });
  basicSection.appendChild(basicTitle);

  const basicGrid = UIBuilder.createElement('div', {
    className: 'grid grid-cols-1 md:grid-cols-2 gap-4'
  });

  // Capture Radius
  const radiusGroup = UIBuilder.createElement('div');
  const radiusLabel = UIBuilder.createElement('label', {
    className: 'block text-sm font-medium text-gray-700 mb-1',
    textContent: 'Capture Radius'
  });
  radiusGroup.appendChild(radiusLabel);

  const radiusContainer = UIBuilder.createElement('div', { className: 'flex items-center space-x-2' });
  
  const radiusInput = UIBuilder.createElement('input', {
    type: 'number',
    min: '5',
    max: '500',
    value: settings.capture_radius_meters || 15,
    className: 'flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:border-purple-500',
    id: 'edit-capture-radius'
  });
  radiusContainer.appendChild(radiusInput);

  const radiusUnit = UIBuilder.createElement('span', {
    className: 'text-sm text-gray-600',
    textContent: 'metres'
  });
  radiusContainer.appendChild(radiusUnit);

  radiusGroup.appendChild(radiusContainer);
  basicGrid.appendChild(radiusGroup);

  // Points Interval
  const intervalGroup = UIBuilder.createElement('div');
  const intervalLabel = UIBuilder.createElement('label', {
    className: 'block text-sm font-medium text-gray-700 mb-1',
    textContent: 'Points Interval'
  });
  intervalGroup.appendChild(intervalLabel);

  const intervalContainer = UIBuilder.createElement('div', { className: 'flex items-center space-x-2' });
  
  const intervalInput = UIBuilder.createElement('input', {
    type: 'number',
    min: '5',
    max: '3600',
    value: settings.points_interval_seconds || 15,
    className: 'flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:border-purple-500',
    id: 'edit-points-interval'
  });
  intervalContainer.appendChild(intervalInput);

  const intervalUnit = UIBuilder.createElement('span', {
    className: 'text-sm text-gray-600',
    textContent: 'seconds'
  });
  intervalContainer.appendChild(intervalUnit);

  intervalGroup.appendChild(intervalContainer);
  basicGrid.appendChild(intervalGroup);

  basicSection.appendChild(basicGrid);
  form.appendChild(basicSection);

  // Advanced Settings
  const advancedSection = UIBuilder.createElement('div');
  const advancedTitle = UIBuilder.createElement('h4', {
    className: 'text-lg font-medium mb-3 text-gray-800',
    textContent: 'Timing Settings'
  });
  advancedSection.appendChild(advancedTitle);

  const advancedGrid = UIBuilder.createElement('div', {
    className: 'grid grid-cols-1 md:grid-cols-2 gap-4'
  });

  // Auto-start time
  const autoStartGroup = UIBuilder.createElement('div');
  const autoStartLabel = UIBuilder.createElement('label', {
    className: 'block text-sm font-medium text-gray-700 mb-1',
    textContent: 'Auto-start Time'
  });
  autoStartGroup.appendChild(autoStartLabel);

  const autoStartInput = UIBuilder.createElement('input', {
    type: 'datetime-local',
    className: 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-purple-500',
    id: 'edit-auto-start'
  });

  // Set current value if exists
  if (settings.auto_start_time) {
    const startTime = new Date(settings.auto_start_time * 1000);
    autoStartInput.value = startTime.toISOString().slice(0, 16);
  }

  // Set minimum to current time
  const now = new Date();
  autoStartInput.min = now.toISOString().slice(0, 16);

  autoStartGroup.appendChild(autoStartInput);

  const clearAutoStartBtn = UIBuilder.createButton('Clear', function() {
    document.getElementById('edit-auto-start').value = '';
  }, 'mt-2 text-sm bg-gray-500 text-white py-1 px-3 rounded hover:bg-gray-600 transition-colors');
  autoStartGroup.appendChild(clearAutoStartBtn);

  advancedGrid.appendChild(autoStartGroup);

  // Game duration
  const durationGroup = UIBuilder.createElement('div');
  const durationLabel = UIBuilder.createElement('label', {
    className: 'block text-sm font-medium text-gray-700 mb-1',
    textContent: 'Game Duration'
  });
  durationGroup.appendChild(durationLabel);

  const durationContainer = UIBuilder.createElement('div', { className: 'flex items-center space-x-2' });

  const durationInput = UIBuilder.createElement('input', {
    type: 'number',
    min: '1',
    max: '43200',
    placeholder: 'Manual end',
    className: 'flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:border-purple-500',
    id: 'edit-duration'
  });

  if (settings.game_duration_minutes) {
    durationInput.value = settings.game_duration_minutes;
  }

  durationContainer.appendChild(durationInput);

  const durationUnit = UIBuilder.createElement('span', {
    className: 'text-sm text-gray-600',
    textContent: 'minutes'
  });
  durationContainer.appendChild(durationUnit);

  durationGroup.appendChild(durationContainer);

  const clearDurationBtn = UIBuilder.createButton('Clear', function() {
    document.getElementById('edit-duration').value = '';
  }, 'mt-2 text-sm bg-gray-500 text-white py-1 px-3 rounded hover:bg-gray-600 transition-colors');
  durationGroup.appendChild(clearDurationBtn);

  advancedGrid.appendChild(durationGroup);

  advancedSection.appendChild(advancedGrid);
  form.appendChild(advancedSection);

  // Validation warning
  const validationWarning = UIBuilder.createElement('div', {
    className: 'bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded-lg text-sm',
    id: 'validation-warning',
    style: { display: 'none' }
  });
  form.appendChild(validationWarning);

  // Action buttons
  const buttonGroup = UIBuilder.createElement('div', { className: 'flex gap-4 pt-4 border-t' });

  const cancelButton = UIBuilder.createButton('Cancel', function() {
    document.body.removeChild(modalBackdrop);
  }, 'flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors');
  buttonGroup.appendChild(cancelButton);

  const saveButton = UIBuilder.createButton('Save Settings', null, 'flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors');
  saveButton.type = 'submit';
  buttonGroup.appendChild(saveButton);

  form.appendChild(buttonGroup);

  // Real-time validation
  function validateSettings() {
    const radius = parseInt(document.getElementById('edit-capture-radius').value);
    const interval = parseInt(document.getElementById('edit-points-interval').value);
    const duration = document.getElementById('edit-duration').value ? parseInt(document.getElementById('edit-duration').value) : null;
    
    const warning = document.getElementById('validation-warning');
    
    // Check duration vs interval ratio
    if (duration && interval) {
      const durationSeconds = duration * 60;
      const minDurationSeconds = interval * 10;
      
      if (durationSeconds < minDurationSeconds) {
        const minDurationMinutes = Math.ceil(minDurationSeconds / 60);
        warning.textContent = `⚠️ Game duration should be at least ${minDurationMinutes} minutes for ${interval}s interval (10x ratio recommended)`;
        warning.style.display = 'block';
        return false;
      }
    }
    
    warning.style.display = 'none';
    return true;
  }

  // Add validation listeners
  document.getElementById('edit-points-interval').addEventListener('input', validateSettings);
  document.getElementById('edit-duration').addEventListener('input', validateSettings);

  // Handle form submission
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const radius = parseInt(document.getElementById('edit-capture-radius').value);
    const interval = parseInt(document.getElementById('edit-points-interval').value);
    const autoStartInput = document.getElementById('edit-auto-start');
    const durationInput = document.getElementById('edit-duration');
    
    // Validate inputs
    if (isNaN(radius) || radius < 5 || radius > 500) {
      showNotification('Capture radius must be between 5 and 500 metres', 'error');
      return;
    }
    
    if (isNaN(interval) || interval < 5 || interval > 3600) {
      showNotification('Points interval must be between 5 and 3600 seconds', 'error');
      return;
    }
    
    let autoStartTime = null;
    if (autoStartInput.value) {
      autoStartTime = Math.floor(new Date(autoStartInput.value).getTime() / 1000);
      if (autoStartTime <= Math.floor(Date.now() / 1000)) {
        showNotification('Auto-start time must be in the future', 'error');
        return;
      }
    }
    
    let duration = null;
    if (durationInput.value) {
      duration = parseInt(durationInput.value);
      if (isNaN(duration) || duration < 1 || duration > 43200) {
        showNotification('Game duration must be between 1 and 43200 minutes', 'error');
        return;
      }
    }
    
    // Final validation check
    if (!validateSettings()) {
      showNotification('Please fix validation warnings before saving', 'error');
      return;
    }
    
    try {
      // Call API to update settings
      const authState = getAuthState();
      const response = await fetch(`${API_BASE_URL}/games/${appState.gameData.id}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          host_id: authState.hostId,
          capture_radius_meters: radius,
          points_interval_seconds: interval,
          auto_start_time: autoStartTime,
          game_duration_minutes: duration
        })
      });

      await handleApiResponse(response, 'Failed to update game settings');
      
      // Close modal
      document.body.removeChild(modalBackdrop);
      
      // Refresh game data
      await fetchGameData(appState.gameData.id);
      
      showNotification('Game settings updated successfully!', 'success');
      
    } catch (error) {
      console.error('Error updating settings:', error);
      showNotification(error.message || 'Failed to update settings', 'error');
    }
  });

  modalContainer.appendChild(form);

  // Initial validation
  setTimeout(validateSettings, 100);

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

// QR Assignment Page
function renderQRAssignmentPage() {
  const container = UIBuilder.createElement('div', { className: 'max-w-md mx-auto py-8' });

  const qrId = sessionStorage.getItem('pendingQRCode');
  if (!qrId) {
    // No pending QR, show error and instruction
    const errorDiv = UIBuilder.createElement('div', {
      className: 'bg-amber-100 border border-amber-400 text-amber-700 px-4 py-3 rounded mb-4',
      textContent: 'No QR code found to assign. You must scan a QR code first.'
    });
    container.appendChild(errorDiv);

    const instructionDiv = UIBuilder.createElement('div', {
      className: 'bg-purple-100 border border-purple-400 text-purple-700 px-4 py-3 rounded mb-6'
    });

    const instructionTitle = UIBuilder.createElement('p');
    const titleStrong = UIBuilder.createElement('strong', { textContent: 'How to add teams or bases:' });
    instructionTitle.appendChild(titleStrong);
    instructionDiv.appendChild(instructionTitle);

    const instructionList = UIBuilder.createElement('ol', { className: 'list-decimal pl-5 mt-2' });

    const steps = [
      'Return to the host panel',
      'Click "Scan QR Code"',
      'Scan a QR code to assign it',
      'Follow the instructions to create a team or base'
    ];

    steps.forEach(stepText => {
      const listItem = UIBuilder.createElement('li', { textContent: stepText });
      instructionList.appendChild(listItem);
    });

    instructionDiv.appendChild(instructionList);
    container.appendChild(instructionDiv);

    const backButton = UIBuilder.createButton('Back to Host Panel', function() {
      navigateTo('hostPanel');
    }, 'mt-4 bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded w-full transition-colors');
    container.appendChild(backButton);

    return container;
  }

  // Title
  const title = UIBuilder.createElement('h2', {
    className: 'text-2xl font-bold mb-6 text-center',
    textContent: 'Assign QR Code'
  });
  container.appendChild(title);

  // QR Code info
  const qrInfo = UIBuilder.createElement('div', {
    className: 'bg-purple-100 border border-purple-400 text-purple-700 px-4 py-3 rounded mb-6',
    id: 'qr-display',
    textContent: `QR Code ID: ${qrId}`
  });
  container.appendChild(qrInfo);

  // Options
  const options = UIBuilder.createElement('div', { className: 'flex flex-col gap-4' });

  // Assign as Team button
  const teamButton = UIBuilder.createButton('Assign as Team', function() {
    // Show team creation form
    renderTeamCreationForm(qrId, container);
  }, 'bg-green-500 hover:bg-green-700 text-white font-bold py-4 px-6 rounded flex items-center justify-center transition-colors', 'users');
  options.appendChild(teamButton);

  // Assign as Base button
  const baseButton = UIBuilder.createButton('Assign as Base', function() {
    // Show base creation form
    renderBaseCreationForm(qrId, container);
  }, 'bg-purple-500 hover:bg-purple-700 text-white font-bold py-4 px-6 rounded flex items-center justify-center transition-colors', 'flag');
  options.appendChild(baseButton);

  container.appendChild(options);

  // Cancel button
  const cancelButton = UIBuilder.createButton('Cancel', function() {
    sessionStorage.removeItem('pendingQRCode');
    navigateTo('hostPanel');
  }, 'mt-6 bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded w-full transition-colors');
  container.appendChild(cancelButton);

  return container;
}

// Render team creation form (replaces the assignment options)
function renderTeamCreationForm(qrId, container) {
  // Clear the container
  container.innerHTML = '';

  // Title
  const title = UIBuilder.createElement('h2', {
    className: 'text-2xl font-bold mb-6 text-center',
    textContent: 'Create New Team'
  });
  container.appendChild(title);

  // QR Info reminder
  const qrInfo = UIBuilder.createElement('div', {
    className: 'bg-purple-100 border border-purple-400 text-purple-700 px-4 py-3 rounded mb-4',
    textContent: `Creating team from QR Code: ${qrId}`
  });
  container.appendChild(qrInfo);

  // Form
  const form = UIBuilder.createElement('form', { className: 'space-y-4' });

  // Team name
  const nameGroup = UIBuilder.createElement('div');

  const nameLabel = UIBuilder.createElement('label', {
    className: 'block text-gray-700 text-sm font-bold mb-2',
    htmlFor: 'team-name',
    textContent: 'Team Name'
  });
  nameGroup.appendChild(nameLabel);

  const nameInput = UIBuilder.createElement('input', {
    className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
    id: 'team-name',
    type: 'text',
    placeholder: 'Enter team name',
    required: true
  });
  nameGroup.appendChild(nameInput);

  form.appendChild(nameGroup);

  // Team color
  const colorGroup = UIBuilder.createElement('div');

  const colorLabel = UIBuilder.createElement('label', {
    className: 'block text-gray-700 text-sm font-bold mb-2',
    htmlFor: 'team-color',
    textContent: 'Team Color'
  });
  colorGroup.appendChild(colorLabel);

  const colorSelect = UIBuilder.createElement('select', {
    className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
    id: 'team-color'
  });

  const colors = [
    { value: 'bg-red-500', label: 'Red' },
    { value: 'bg-blue-500', label: 'Blue' },
    { value: 'bg-green-500', label: 'Green' },
    { value: 'bg-yellow-500', label: 'Yellow' },
    { value: 'bg-purple-500', label: 'Purple' },
    { value: 'bg-pink-500', label: 'Pink' },
    { value: 'bg-indigo-500', label: 'Indigo' },
    { value: 'bg-teal-500', label: 'Teal' }
  ];

  // Get already used colors
  const usedColors = [];
  if (appState.gameData.teams && appState.gameData.teams.length > 0) {
    appState.gameData.teams.forEach(team => {
      usedColors.push(team.color);
    });
  }

  // Find the first unused color
  let defaultColor = colors[0].value;
  for (const color of colors) {
    if (!usedColors.includes(color.value)) {
      defaultColor = color.value;
      break;
    }
  }

  colors.forEach(color => {
    const option = UIBuilder.createElement('option', {
      value: color.value,
      textContent: color.label
    });
    colorSelect.appendChild(option);
  });

  // Set default color selection
  colorSelect.value = defaultColor;

  // Set default team name based on initial color
  const initialColorLabel = colors.find(c => c.value === defaultColor)?.label || 'Team';
  nameInput.value = initialColorLabel + ' Team';

  // Update team name when color changes
  colorSelect.addEventListener('change', function() {
    const selectedColorLabel = colors.find(c => c.value === this.value)?.label || 'Team';
    if (nameInput.value === '' || nameInput.value.endsWith(' Team')) {
      nameInput.value = selectedColorLabel + ' Team';
    }
  });

  colorGroup.appendChild(colorSelect);
  form.appendChild(colorGroup);

  // Submit button
  const submitButton = UIBuilder.createButton('Create Team', null, 'bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded w-full transition-colors');
  submitButton.type = 'submit';
  form.appendChild(submitButton);

  // Handle form submission
  form.addEventListener('submit', function(e) {
    e.preventDefault();

    const teamName = nameInput.value.trim();
    if (!teamName) {
      showNotification('Please enter a team name', 'warning');
      return;
    }

    // Call the API function from core.js
    createTeam(qrId, teamName, colorSelect.value);
  });

  container.appendChild(form);

  // Cancel button
  const cancelButton = UIBuilder.createButton('Cancel', function() {
    sessionStorage.removeItem('pendingQRCode');
    navigateTo('hostPanel');
  }, 'mt-4 bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded w-full transition-colors');
  container.appendChild(cancelButton);
}

// Function to display a modal for editing team details
function renderTeamEditModal(team) {
  // Create modal backdrop
  const modalBackdrop = UIBuilder.createElement('div', {
    className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
  });
  document.body.appendChild(modalBackdrop);

  // Create modal container
  const modalContainer = UIBuilder.createElement('div', {
    className: 'bg-white rounded-lg shadow-xl p-6 w-full max-w-md'
  });
  modalBackdrop.appendChild(modalContainer);

  // Modal title
  const modalTitle = UIBuilder.createElement('h3', {
    className: 'text-xl font-bold mb-4',
    textContent: 'Edit Team'
  });
  modalContainer.appendChild(modalTitle);

  // Create form
  const form = UIBuilder.createElement('form', { className: 'space-y-4' });
  modalContainer.appendChild(form);

  // Team name field
  const nameGroup = UIBuilder.createElement('div');

  const nameLabel = UIBuilder.createElement('label', {
    className: 'block text-gray-700 text-sm font-bold mb-2',
    htmlFor: 'edit-team-name',
    textContent: 'Team Name'
  });
  nameGroup.appendChild(nameLabel);

  const nameInput = UIBuilder.createElement('input', {
    className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
    id: 'edit-team-name',
    type: 'text',
    value: team.name,
    required: true
  });
  nameGroup.appendChild(nameInput);

  form.appendChild(nameGroup);

  // Team color field
  const colorGroup = UIBuilder.createElement('div');

  const colorLabel = UIBuilder.createElement('label', {
    className: 'block text-gray-700 text-sm font-bold mb-2',
    htmlFor: 'edit-team-color',
    textContent: 'Team Color'
  });
  colorGroup.appendChild(colorLabel);

  const colorSelect = UIBuilder.createElement('select', {
    className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
    id: 'edit-team-color'
  });

  const colors = [
    { value: 'bg-red-500', label: 'Red' },
    { value: 'bg-blue-500', label: 'Blue' },
    { value: 'bg-green-500', label: 'Green' },
    { value: 'bg-yellow-500', label: 'Yellow' },
    { value: 'bg-purple-500', label: 'Purple' },
    { value: 'bg-pink-500', label: 'Pink' },
    { value: 'bg-indigo-500', label: 'Indigo' },
    { value: 'bg-teal-500', label: 'Teal' }
  ];

  colors.forEach(color => {
    const option = UIBuilder.createElement('option', {
      value: color.value,
      textContent: color.label,
      selected: color.value === team.color
    });
    colorSelect.appendChild(option);
  });

  colorGroup.appendChild(colorSelect);
  form.appendChild(colorGroup);

  // Action buttons
  const buttonGroup = UIBuilder.createElement('div', { className: 'flex gap-4 mt-6' });

  const cancelButton = UIBuilder.createButton('Cancel', function() {
    document.body.removeChild(modalBackdrop);
  }, 'flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600');
  buttonGroup.appendChild(cancelButton);

  const saveButton = UIBuilder.createButton('Save Changes', null, 'flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600');
  saveButton.type = 'submit';
  buttonGroup.appendChild(saveButton);

  form.appendChild(buttonGroup);

  // Handle form submission
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    // Call the API function from core.js
    updateTeam(team.id, nameInput.value, colorSelect.value);
    document.body.removeChild(modalBackdrop);
  });
}

// Render base creation form
function renderBaseCreationForm(qrId, container) {
  // Clear the container
  container.innerHTML = '';

  // Title
  const title = UIBuilder.createElement('h2', {
    className: 'text-2xl font-bold mb-6 text-center',
    textContent: 'Create New Base'
  });
  container.appendChild(title);

  // QR Info reminder
  const qrInfo = UIBuilder.createElement('div', {
    className: 'bg-purple-100 border border-purple-400 text-purple-700 px-4 py-3 rounded mb-4',
    textContent: `Creating base from QR Code: ${qrId}`
  });
  container.appendChild(qrInfo);

  // Determine default base name (Base XX)
  let nextBaseNumber = 1;

  // Check existing bases to find the next available number
  if (appState.gameData.bases && appState.gameData.bases.length > 0) {
    // Find base names that match the pattern "Base XX"
    const baseNumbers = appState.gameData.bases
      .map(base => {
        const match = base.name.match(/^Base\s+(\d+)$/i);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(num => num > 0);

    if (baseNumbers.length > 0) {
      // Find the maximum base number and add 1
      nextBaseNumber = Math.max(...baseNumbers) + 1;
    }
  }

  // Format the base number with leading zero if needed
  const defaultBaseName = `Base ${nextBaseNumber.toString().padStart(2, '0')}`;

  // Form
  const form = UIBuilder.createElement('form', { className: 'space-y-4' });

  // Base name
  const nameGroup = UIBuilder.createElement('div');

  const nameLabel = UIBuilder.createElement('label', {
    className: 'block text-gray-700 text-sm font-bold mb-2',
    htmlFor: 'base-name',
    textContent: 'Base Name'
  });
  nameGroup.appendChild(nameLabel);

  const nameInput = UIBuilder.createElement('input', {
    className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
    id: 'base-name',
    type: 'text',
    placeholder: 'Enter base name',
    value: defaultBaseName,
    required: true
  });
  nameGroup.appendChild(nameInput);

  form.appendChild(nameGroup);

  // Location section
  const locationGroup = UIBuilder.createElement('div');

  const locationLabel = UIBuilder.createElement('div', {
    className: 'block text-gray-700 text-sm font-bold mb-2',
    textContent: 'Base Location'
  });
  locationGroup.appendChild(locationLabel);

  // Map container for location preview
  const mapPreviewContainer = UIBuilder.createElement('div', {
    id: 'base-location-map',
    className: 'h-64 bg-gray-200 rounded mb-4 relative'
  });

  // Map instructions overlay
  const mapInstructions = UIBuilder.createElement('div', {
    id: 'map-instructions',
    className: 'absolute bottom-2 left-2 right-2 bg-blue-100 border border-blue-300 text-blue-700 px-3 py-2 rounded text-sm z-10',
    style: { display: 'none' }
  });
  mapInstructions.innerHTML = '<strong>Drag the marker</strong> to adjust the base location, or <strong>click on the map</strong> to place it.';
  mapPreviewContainer.appendChild(mapInstructions);

  locationGroup.appendChild(mapPreviewContainer);

  // Get location button group
  const locationButtonGroup = UIBuilder.createElement('div', { className: 'flex gap-2' });

  // Get location button
  const getLocationBtn = UIBuilder.createButton('Get GPS Location', null, 'flex-1 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded', 'navigation');

  // Reset to GPS button (initially hidden)
  const resetToGpsBtn = UIBuilder.createButton('Reset to GPS', null, 'bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded', 'rotate-ccw');
  resetToGpsBtn.id = 'reset-to-gps';
  resetToGpsBtn.style.display = 'none';

  // High accuracy toggle button
  const highAccuracyBtn = UIBuilder.createButton('', null, 'bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded', 'crosshair');
  highAccuracyBtn.id = 'high-accuracy-toggle';
  highAccuracyBtn.title = 'High Accuracy Mode: ON';

  // Add to button group
  locationButtonGroup.appendChild(getLocationBtn);
  locationButtonGroup.appendChild(resetToGpsBtn);
  locationButtonGroup.appendChild(highAccuracyBtn);
  locationGroup.appendChild(locationButtonGroup);

  // Hidden fields for location data
  const latInput = UIBuilder.createElement('input', {
    type: 'hidden',
    id: 'latitude',
    name: 'latitude'
  });

  const lngInput = UIBuilder.createElement('input', {
    type: 'hidden',
    id: 'longitude',
    name: 'longitude'
  });

  const accuracyInput = UIBuilder.createElement('input', {
    type: 'hidden',
    id: 'accuracy',
    name: 'accuracy'
  });

  const watchIdInput = UIBuilder.createElement('input', {
    type: 'hidden',
    id: 'location-watch-id'
  });

  // GPS coordinates storage
  const gpsLatInput = UIBuilder.createElement('input', {
    type: 'hidden',
    id: 'gps-latitude'
  });

  const gpsLngInput = UIBuilder.createElement('input', {
    type: 'hidden',
    id: 'gps-longitude'
  });

  // Add all hidden inputs
  locationGroup.appendChild(latInput);
  locationGroup.appendChild(lngInput);
  locationGroup.appendChild(accuracyInput);
  locationGroup.appendChild(watchIdInput);
  locationGroup.appendChild(gpsLatInput);
  locationGroup.appendChild(gpsLngInput);

  // Location source state
  let currentLocationSource = 'gps'; // 'gps' or 'manual'
  let highAccuracyMode = true;

  // Initialize high accuracy button state
  updateHighAccuracyButtonContent(highAccuracyBtn, true);

  // Map instance and markers
  let baseLocationMap = null;
  let gpsMarker = null;
  let manualMarker = null;
  let accuracyCircle = null;

  // Toggle high accuracy mode
  highAccuracyBtn.addEventListener('click', function(e) {
    e.preventDefault();
    highAccuracyMode = !highAccuracyMode;

    if (highAccuracyMode) {
      highAccuracyBtn.classList.remove('bg-amber-500', 'hover:bg-amber-700');
      highAccuracyBtn.classList.add('bg-green-500', 'hover:bg-green-700');
      highAccuracyBtn.title = 'High Accuracy Mode: ON';
    } else {
      highAccuracyBtn.classList.remove('bg-green-500', 'hover:bg-green-700');
      highAccuracyBtn.classList.add('bg-amber-500', 'hover:bg-amber-700');
      highAccuracyBtn.title = 'High Accuracy Mode: OFF';
    }

    updateHighAccuracyButtonContent(highAccuracyBtn, highAccuracyMode);

    // If we're currently watching location, restart with new settings
    const watchId = document.getElementById('location-watch-id').value;
    if (watchId) {
      navigator.geolocation.clearWatch(parseInt(watchId));
      startLocationTracking();
    }

    // Initialize Lucide icons
    if (window.lucide) window.lucide.createIcons();
  });

  // Reset to GPS button handler
  resetToGpsBtn.addEventListener('click', function(e) {
    e.preventDefault();

    const gpsLat = parseFloat(document.getElementById('gps-latitude').value);
    const gpsLng = parseFloat(document.getElementById('gps-longitude').value);

    if (!isNaN(gpsLat) && !isNaN(gpsLng)) {
      // Reset manual marker to GPS position
      if (manualMarker) {
        manualMarker.setLatLng([gpsLat, gpsLng]);
      }

      // Update coordinates
      document.getElementById('latitude').value = gpsLat;
      document.getElementById('longitude').value = gpsLng;

      // Switch to GPS source
      currentLocationSource = 'gps';
      updateLocationDisplay();
    }
  });

  // Function to initialize the map
  function initBaseLocationMap(lat, lng) {
    // Show the map container
    const mapContainer = document.getElementById('base-location-map');
    mapContainer.classList.remove('hidden');

    // Initialize map if it doesn't exist
    if (!baseLocationMap) {
      baseLocationMap = L.map('base-location-map').setView([lat, lng], 18);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(baseLocationMap);

      // Add click handler to map for placing manual marker
      baseLocationMap.on('click', function(e) {
        const clickLat = e.latlng.lat;
        const clickLng = e.latlng.lng;

        // Update manual marker position
        if (manualMarker) {
          manualMarker.setLatLng([clickLat, clickLng]);
        } else {
          createManualMarker(clickLat, clickLng);
        }

        // Update coordinates and switch to manual mode
        document.getElementById('latitude').value = clickLat;
        document.getElementById('longitude').value = clickLng;
        currentLocationSource = 'manual';
        updateLocationDisplay();
      });
    }

    // Only center/zoom if this is the first time or we don't have manual coordinates
    const hasManualCoords = !isNaN(parseFloat(document.getElementById('latitude').value)) &&
                           currentLocationSource === 'manual';

    if (!hasManualCoords) {
      baseLocationMap.setView([lat, lng], 18);
    }

    // Create or update GPS marker
    if (gpsMarker) {
      gpsMarker.setLatLng([lat, lng]);
    } else {
      gpsMarker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: 'gps-marker',
          html: '<div style="background-color: #3b82f6; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.3);"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        })
      }).addTo(baseLocationMap);

      gpsMarker.bindTooltip('GPS Location', { permanent: false });
    }

    // Create manual marker if it doesn't exist (initially at GPS location)
    if (!manualMarker) {
      createManualMarker(lat, lng);
    }

    updateLocationDisplay();
  }

  function createManualMarker(lat, lng) {
    manualMarker = L.marker([lat, lng], {
      draggable: true,
      icon: L.divIcon({
        className: 'manual-marker',
        html: '<div style="background-color: #ef4444; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 8px rgba(0,0,0,0.4); cursor: move;"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      })
    }).addTo(baseLocationMap);

    manualMarker.bindTooltip('Drag to adjust location', { permanent: false });

    // Handle marker drag
    manualMarker.on('dragend', function(e) {
      const newPos = e.target.getLatLng();

      // Update coordinates
      document.getElementById('latitude').value = newPos.lat;
      document.getElementById('longitude').value = newPos.lng;

      // Switch to manual mode
      currentLocationSource = 'manual';
      updateLocationDisplay();
    });
  }

  function updateLocationDisplay() {
    const mapInstructions = document.getElementById('map-instructions');
    const resetBtn = document.getElementById('reset-to-gps');

    const currentLat = parseFloat(document.getElementById('latitude').value);
    const currentLng = parseFloat(document.getElementById('longitude').value);
    const accuracy = parseFloat(document.getElementById('accuracy').value);

    if (isNaN(currentLat) || isNaN(currentLng)) {
      return;
    }

    // Show/hide elements based on state
    const hasGpsData = !isNaN(parseFloat(document.getElementById('gps-latitude').value));

    if (hasGpsData) {
      resetBtn.style.display = currentLocationSource === 'manual' ? 'block' : 'none';

      // Show instructions based on accuracy and current source
      if (currentLocationSource === 'gps' && accuracy > 15) {
        mapInstructions.style.display = 'block';
      } else if (currentLocationSource === 'manual') {
        mapInstructions.style.display = 'none';
      } else {
        mapInstructions.style.display = 'none';
      }
    }

    // Update marker visibility and styling
    if (gpsMarker && manualMarker) {
      if (currentLocationSource === 'gps') {
        gpsMarker.setOpacity(1);
        manualMarker.setOpacity(0.5);
      } else {
        gpsMarker.setOpacity(0.5);
        manualMarker.setOpacity(1);
      }
    }
  }

  // Function to start continuous location tracking
  function startLocationTracking() {
    if (!navigator.geolocation) {
      showNotification('Geolocation is not supported by this browser.', 'error');
      return;
    }

    // Update button state
    getLocationBtn.disabled = true;
    updateLocationButtonContent(getLocationBtn, 'loader-2', 'Getting location...', 'animate-spin');

    // Set up high accuracy options
    const options = {
      enableHighAccuracy: highAccuracyMode,
      timeout: 10000,
      maximumAge: 0
    };

    // Function to handle position updates
    function handlePositionUpdate(position) {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const accuracy = position.coords.accuracy;

      // Store GPS coordinates
      document.getElementById('gps-latitude').value = latitude;
      document.getElementById('gps-longitude').value = longitude;
      document.getElementById('accuracy').value = accuracy;

      // Only update current coordinates if we don't have a manual position yet
      const hasManualPosition = currentLocationSource === 'manual' &&
                               !isNaN(parseFloat(document.getElementById('latitude').value));

      if (!hasManualPosition) {
        // Set current coordinates to GPS initially
        document.getElementById('latitude').value = latitude;
        document.getElementById('longitude').value = longitude;
      }

      // Initialize or update map
      initBaseLocationMap(latitude, longitude);

      // Update accuracy circle
      if (accuracyCircle) {
        baseLocationMap.removeLayer(accuracyCircle);
      }

      if (accuracy && !isNaN(accuracy)) {
        accuracyCircle = L.circle([latitude, longitude], {
          radius: accuracy,
          color: accuracy <= 10 ? '#22c55e' : accuracy <= 20 ? '#eab308' : '#ef4444',
          fillColor: accuracy <= 10 ? '#22c55e' : accuracy <= 20 ? '#eab308' : '#ef4444',
          fillOpacity: 0.1,
          weight: 1
        }).addTo(baseLocationMap);
      }

      // Update button state
      getLocationBtn.disabled = false;
      updateLocationButtonContent(getLocationBtn, 'navigation', 'Update GPS Location');

      // Only suggest manual adjustment for new GPS readings without manual position
      if (!hasManualPosition && accuracy > 15) {
        // Poor accuracy - suggest manual adjustment
        currentLocationSource = 'gps'; // Start with GPS but show adjustment options
      }

      updateLocationDisplay();

      // Update icons
      if (window.lucide) window.lucide.createIcons();
    }

    // Function to handle errors
    function handlePositionError(error) {
      let errorMessage = 'Unknown error occurred while getting location.';

      switch(error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Location permission was denied.';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Location information is unavailable.';
          break;
        case error.TIMEOUT:
          errorMessage = 'Location request timed out.';
          break;
      }

      // Update button state
      getLocationBtn.disabled = false;
      updateLocationButtonContent(getLocationBtn, 'navigation', 'Try Again');

      showNotification(errorMessage, 'error');
    }

    // Clear any previous watch
    const oldWatchId = document.getElementById('location-watch-id').value;
    if (oldWatchId) {
      navigator.geolocation.clearWatch(parseInt(oldWatchId));
    }

    // Start watching position
    const watchId = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      handlePositionError,
      options
    );

    // Store watch ID
    document.getElementById('location-watch-id').value = watchId;
  }

  // Add event listener for get location button
  getLocationBtn.addEventListener('click', startLocationTracking);

  form.appendChild(locationGroup);

  // Submit button
  const submitButton = UIBuilder.createButton('Create Base', null, 'bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded w-full mt-6');
  submitButton.type = 'submit';
  form.appendChild(submitButton);

  // Handle form submission
  form.addEventListener('submit', function(e) {
    e.preventDefault();

    const lat = parseFloat(document.getElementById('latitude').value);
    const lng = parseFloat(document.getElementById('longitude').value);

    if (isNaN(lat) || isNaN(lng)) {
      showNotification('Please get the location for this base first.', 'error');
      return;
    }

    // Get accuracy for validation (only relevant for GPS coordinates)
    const accuracy = parseFloat(document.getElementById('accuracy').value);
    if (currentLocationSource === 'gps' && accuracy > 20) {
      const confirmPoor = confirm(`Warning: GPS accuracy is poor (±${accuracy.toFixed(1)}m). Consider adjusting the marker position or do you want to proceed anyway?`);
      if (!confirmPoor) {
        return;
      }
    }

    // Clear any location watch
    const watchId = document.getElementById('location-watch-id').value;
    if (watchId) {
      navigator.geolocation.clearWatch(parseInt(watchId));
    }

    // Call the API function from core.js
    createBase(qrId, nameInput.value, lat, lng);
  });

  container.appendChild(form);

  // Cancel button
  const cancelButton = UIBuilder.createButton('Cancel', function() {
    // Clear any location watch
    const watchId = document.getElementById('location-watch-id').value;
    if (watchId) {
      navigator.geolocation.clearWatch(parseInt(watchId));
    }

    sessionStorage.removeItem('pendingQRCode');
    navigateTo('hostPanel');
  }, 'mt-4 bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded w-full');
  container.appendChild(cancelButton);

  // Initialize Lucide icons
  if (window.lucide) window.lucide.createIcons();

  return container;
}

// Player Registration Page - New page for players to register when joining a team
function renderPlayerRegistrationPage() {
  const container = UIBuilder.createElement('div', { className: 'max-w-md mx-auto py-8' });

  const teamId = sessionStorage.getItem('pendingTeamId');
  if (!teamId) {
    // No pending team, show error
    const errorDiv = UIBuilder.createElement('div', {
      className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded',
      textContent: 'No team selected. Please scan a team QR code.'
    });
    container.appendChild(errorDiv);

    const backButton = UIBuilder.createButton('Back to Home', function() {
      navigateTo('landing');
    }, 'mt-4 bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded');
    container.appendChild(backButton);

    return container;
  }

  // Find team info
  let teamName = 'Unknown Team';
  let teamColor = 'bg-gray-500';

  if (appState.gameData.teams) {
    const team = appState.gameData.teams.find(t => t.id === teamId);
    if (team) {
      teamName = team.name;
      teamColor = team.color;
    }
  }

  // Title
  const title = UIBuilder.createElement('h2', {
    className: 'text-2xl font-bold mb-6 text-center',
    textContent: 'Join Team'
  });
  container.appendChild(title);

  // Team info
  const teamInfo = UIBuilder.createElement('div', {
    className: `${teamColor} text-white px-6 py-4 rounded-lg text-center mb-6`,
    textContent: `You are joining: ${teamName}`
  });
  container.appendChild(teamInfo);

  // Player name form
  const form = UIBuilder.createElement('form', { className: 'space-y-4' });

  const nameGroup = UIBuilder.createElement('div');

  const nameLabel = UIBuilder.createElement('label', {
    className: 'block text-gray-700 text-sm font-bold mb-2',
    htmlFor: 'player-name',
    textContent: 'Your Name'
  });
  nameGroup.appendChild(nameLabel);

  const nameInput = UIBuilder.createElement('input', {
    className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
    id: 'player-name',
    type: 'text',
    placeholder: 'Enter your name'
  });
  nameGroup.appendChild(nameInput);

  form.appendChild(nameGroup);

  // Submit button
  const submitButton = UIBuilder.createButton('Join Team', null, 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full');
  submitButton.type = 'submit';
  form.appendChild(submitButton);

  // Handle form submission
  form.addEventListener('submit', function(e) {
    e.preventDefault();

    // Get player name (optional)
    const playerName = nameInput.value.trim() || 'Anonymous Player';

    // Call the API function from core.js
    joinTeam(teamId);

    // Clear pending team
    sessionStorage.removeItem('pendingTeamId');
  });

  container.appendChild(form);

  // Cancel button
  const cancelButton = UIBuilder.createButton('Cancel', function() {
    sessionStorage.removeItem('pendingTeamId');
    navigateTo('landing');
  }, 'mt-4 bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded w-full');
  container.appendChild(cancelButton);

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

// Game creation validation function
function validateGameCreation() {
  const gameName = document.getElementById('game-name-input').value.trim();
  if (!gameName) {
    showNotification('Please enter a game name', 'warning');
    return;
  }

  // Get capture radius
  const captureRadius = parseInt(document.getElementById('capture-radius-input').value);
  if (isNaN(captureRadius) || captureRadius < 5 || captureRadius > 500) {
    showNotification('Capture radius must be between 5 and 500 metres', 'error');
    return;
  }

  // Get points interval
  let pointsInterval;
  const intervalSelect = document.getElementById('points-interval-select');
  if (intervalSelect.value === 'custom') {
    pointsInterval = parseInt(document.getElementById('custom-interval-input').value);
    if (isNaN(pointsInterval) || pointsInterval < 5 || pointsInterval > 3600) {
      showNotification('Points interval must be between 5 and 3600 seconds', 'error');
      return;
    }
  } else {
    pointsInterval = parseInt(intervalSelect.value);
  }

  // Get auto-start time (optional)
  let autoStartTime = null;
  const autoStartInput = document.getElementById('auto-start-input');
  if (autoStartInput.value) {
    autoStartTime = Math.floor(new Date(autoStartInput.value).getTime() / 1000);
    if (autoStartTime <= Math.floor(Date.now() / 1000)) {
      showNotification('Auto-start time must be in the future', 'error');
      return;
    }
  }

  // Get game duration (optional)
  let gameDuration = null;
  const durationSelect = document.getElementById('duration-select');
  if (durationSelect.value === 'custom') {
    gameDuration = parseInt(document.getElementById('custom-duration-input').value);
    if (isNaN(gameDuration) || gameDuration < 1 || gameDuration > 43200) {
      showNotification('Game duration must be between 1 and 43200 minutes', 'error');
      return;
    }
  } else if (durationSelect.value) {
    gameDuration = parseInt(durationSelect.value);
  }

  // Validate duration vs interval ratio
  if (gameDuration) {
    const durationSeconds = gameDuration * 60;
    const minDurationSeconds = pointsInterval * 10;
    if (durationSeconds < minDurationSeconds) {
      const minDurationMinutes = Math.ceil(minDurationSeconds / 60);
      showNotification(
        `Game duration must be at least 10x the points interval. Minimum ${minDurationMinutes} minutes for ${pointsInterval}s interval.`,
        'error'
      );
      return;
    }
  }

  // Call the API function from core.js with settings
  createGame({
    name: gameName,
    capture_radius_meters: captureRadius,
    points_interval_seconds: pointsInterval,
    auto_start_time: autoStartTime,
    game_duration_minutes: gameDuration
  });
}

function updateLocationButtonContent(button, iconName, text, extraClasses = '') {
  // Clear existing content
  button.innerHTML = '';

  const icon = UIBuilder.createElement('i', {
    'data-lucide': iconName,
    className: `inline mr-1 ${extraClasses}`
  });
  button.appendChild(icon);

  const textNode = document.createTextNode(` ${text}`);
  button.appendChild(textNode);
}

function updateHighAccuracyButtonContent(button, isOn) {
  // Clear existing content
  button.innerHTML = '';

  const icon = UIBuilder.createElement('i', {
    'data-lucide': 'crosshair',
    className: 'inline mr-1'
  });
  button.appendChild(icon);

  const text = document.createTextNode(` High Accuracy: ${isOn ? 'ON' : 'OFF'}`);
  button.appendChild(text);
}