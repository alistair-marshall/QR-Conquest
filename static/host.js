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

    // Use the consolidated form for game creation
    const gameForm = buildGameSettingsForm({
      isEditing: false,
      currentSettings: {},
      gameData: {},
      onSubmit: function(e) {
        e.preventDefault();
        const settings = validateGameSettings();
        if (settings) {
          createGame(settings);
        }
      },
      submitButtonText: 'Create Game'
    });

    createSection.appendChild(gameForm);
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
    // Convert to number and handle edge cases
    const numMinutes = parseInt(minutes);

    // Check if we have a valid positive number
    if (isNaN(numMinutes) || numMinutes <= 0) {
      return 'Manual end';
    }
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

  // Settings actions (only show for games in setup or active state)
  if (appState.gameData.status === 'setup' || appState.gameData.status === 'active') {
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

  // GPS status for hosts (unobtrusive)
  const gpsStatusContainer = UIBuilder.createElement('div', {
    className: 'mb-4 flex justify-center'
  });
  gpsStatusContainer.appendChild(createGPSStatusIndicator());
  qrSection.appendChild(gpsStatusContainer);

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
      teamName.addEventListener('click', function() {
        renderTeamQRModal(team);
      });
      teamNameContainer.appendChild(teamName);

      teamHeader.appendChild(teamNameContainer);

      // Edit button
      const editButton = UIBuilder.createButton('Edit', function() {
        renderTeamEditModal(team);
      }, 'bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors flex items-center', 'edit-2');
      teamHeader.appendChild(editButton);

      teamCard.appendChild(teamHeader);

      // Team stats and player list
      const teamStats = UIBuilder.createElement('div', { className: 'grid grid-cols-1 gap-4' });

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

      // Add player names list if there are players
      if (team.players && team.players.length > 0) {
        const playersList = UIBuilder.createElement('div', {
          className: 'mt-2 text-xs text-gray-600'
        });

        const playerNames = team.players.map(player => player.name).join(', ');
        const playersText = UIBuilder.createElement('div', {
          className: 'italic',
          textContent: playerNames
        });
        playersList.appendChild(playersText);
        playersContainer.appendChild(playersList);
      } else {
        const noPlayersText = UIBuilder.createElement('div', {
          className: 'mt-2 text-xs text-gray-400 italic',
          textContent: 'No players yet'
        });
        playersContainer.appendChild(noPlayersText);
      }

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
    teamSection.appendChild(UIBuilder.createEmptyState({
      icon: 'users',
      title: 'No Teams Yet',
      message: 'Scan QR codes to add teams to your game.',
      action: {
        text: 'Scan QR Code',
        onClick: () => navigateTo('scanQR'),
        icon: 'qr-code'
      }
    }));
  }

  grid.appendChild(teamSection);

  // Base Management Section - Mobile Optimized with Map
const baseSection = UIBuilder.createElement('div', {
  className: 'bg-white rounded-lg shadow-md p-4'
});

const baseHeader = UIBuilder.createElement('div', {
  className: 'flex justify-between items-center mb-4'
});

const baseTitle = UIBuilder.createElement('h3', {
  className: 'text-xl font-semibold',
  textContent: 'Base Management'
});
baseHeader.appendChild(baseTitle);

// Show deleted bases toggle (only for hosts)
const showDeletedToggle = UIBuilder.createElement('label', {
  className: 'flex items-center text-sm cursor-pointer'
});

const toggleCheckbox = UIBuilder.createElement('input', {
  type: 'checkbox',
  id: 'show-deleted-bases',
  className: 'mr-2',
  checked: localStorage.getItem('showDeletedBases') === 'true'
});

toggleCheckbox.addEventListener('change', function() {
  localStorage.setItem('showDeletedBases', this.checked);
  renderApp(); // Re-render to show/hide deleted bases
});

const toggleText = UIBuilder.createElement('span', {
  textContent: 'Show deleted'
});

showDeletedToggle.appendChild(toggleCheckbox);
showDeletedToggle.appendChild(toggleText);
baseHeader.appendChild(showDeletedToggle);
baseSection.appendChild(baseHeader);

if (appState.gameData.bases && appState.gameData.bases.length > 0) {
  // Filter bases based on toggle setting
  const showDeleted = localStorage.getItem('showDeletedBases') === 'true';
  const basesToShow = appState.gameData.bases.filter(base => {
    if (base.deleted_at && !showDeleted) {
      return false; // Hide deleted bases if toggle is off
    }
    return true;
  });

  if (basesToShow.length > 0) {
    // Map container
    const mapContainer = UIBuilder.createElement('div', {
      id: 'map-container',
      className: 'bg-gray-200 rounded-lg shadow-sm h-64 mb-4 relative'
    });
    baseSection.appendChild(mapContainer);

    // Bases list
    const basesContainer = UIBuilder.createElement('div', { className: 'space-y-3' });

    basesToShow.forEach(function(base) {
      const baseCard = UIBuilder.createElement('div', {
        className: base.deleted_at ? 
          'border border-gray-200 rounded-lg p-4 bg-gray-100 opacity-75' : 
          'border border-gray-200 rounded-lg p-4 bg-gray-50'
      });

      // Base header
      const baseHeader = UIBuilder.createElement('div', {
        className: 'flex items-center justify-between mb-3'
      });

      const baseNameContainer = UIBuilder.createElement('div', {
        className: 'flex items-center'
      });

      const baseName = UIBuilder.createElement('h4', {
        className: base.deleted_at ? 
          'text-lg font-semibold text-gray-500 line-through' : 
          'text-lg font-semibold text-gray-900',
        textContent: base.name
      });
      baseNameContainer.appendChild(baseName);

      // Deleted badge
      if (base.deleted_at) {
        const deletedBadge = UIBuilder.createElement('span', {
          className: 'ml-2 text-xs bg-red-100 text-red-600 px-2 py-1 rounded',
          textContent: 'DELETED'
        });
        baseNameContainer.appendChild(deletedBadge);
      }

      baseHeader.appendChild(baseNameContainer);

      // Action buttons container
      const actionsContainer = UIBuilder.createElement('div', {
        className: 'flex items-center space-x-2'
      });

      if (base.deleted_at) {
        // Restore button for deleted bases
        const restoreButton = UIBuilder.createButton('Restore', function() {
          renderBaseRestoreModal(base);
        }, 'bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600 transition-colors');
        actionsContainer.appendChild(restoreButton);
      } else {
        // Edit and Delete buttons for active bases
        const editButton = UIBuilder.createButton('Edit', function() {
          renderBaseEditModal(base);
        }, 'bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 transition-colors', 'edit-2');
        actionsContainer.appendChild(editButton);

        const deleteButton = UIBuilder.createButton('Delete', function() {
          renderBaseDeleteModal(base);
        }, 'bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 transition-colors', 'trash-2');
        actionsContainer.appendChild(deleteButton);
      }

      baseHeader.appendChild(actionsContainer);
      baseCard.appendChild(baseHeader);

      // Owner indicator (same as before)
      const ownerContainer = UIBuilder.createElement('div', {
        className: 'flex items-center text-sm'
      });

      if (base.ownedBy && !base.deleted_at) {
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
        }
      } else if (!base.deleted_at) {
        const uncaptured = UIBuilder.createElement('span', {
          className: 'text-gray-500 italic',
          textContent: 'Uncaptured'
        });
        ownerContainer.appendChild(uncaptured);
      }

      baseCard.appendChild(ownerContainer);

      // Base coordinates (smaller, less prominent)
      const coordinates = UIBuilder.createElement('div', {
        className: 'text-xs text-gray-500 font-mono bg-white px-2 py-1 rounded mt-2',
        textContent: `${base.lat.toFixed(4)}, ${base.lng.toFixed(4)}`
      });
      baseCard.appendChild(coordinates);

      basesContainer.appendChild(baseCard);
    });

    baseSection.appendChild(basesContainer);

    // Initialize game map after section is added to DOM
    setTimeout(() => initGameMap(), 100);
  } else {
    // Show message when all bases are hidden
    const hiddenMessage = UIBuilder.createElement('div', {
      className: 'text-center py-8 text-gray-500',
      textContent: 'All bases are deleted. Enable "Show deleted" to see them.'
    });
    baseSection.appendChild(hiddenMessage);
  }
  } else {
    // Show prompt to add bases when there are none (same as before)
    baseSection.appendChild(UIBuilder.createEmptyState({
      icon: 'map-pin',
      title: 'No Bases Yet',
      message: 'Scan QR codes to add bases to your game.',
      action: {
        text: 'Scan QR Code',
        onClick: () => navigateTo('scanQR'),
        icon: 'qr-code'
      }
    }));
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
    navigateTo('gameView');
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
    gamesListContainer.appendChild(UIBuilder.createLoadingDisplay('Loading your games...'));

    // Fetch games for this host
    const games = await fetchHostGames(authState.hostId);

    // Clear loading state
    gamesListContainer.innerHTML = '';

    if (games.length === 0) {
      // Show empty state
      const emptyState = UIBuilder.createEmptyState({
        icon: 'gamepad-2',
        title: 'No games created yet',
        message: 'You haven\'t created any games yet. Create your first game above!',
        action: null // No action needed as the create form is above
      });
      gamesListContainer.appendChild(emptyState);
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

  } catch (error) {
    // Show error state
    gamesListContainer.innerHTML = '';
    gamesListContainer.appendChild(UIBuilder.createErrorDisplay(
      'Failed to load your games. Please try refreshing the page.',
      () => loadHostGames()
    ));
  }
}

function buildGameSettingsForm(options = {}) {
  const {
    isEditing = false,
    currentSettings = {},
    gameData = {},
    onSubmit = null,
    submitButtonText = isEditing ? 'Save Settings' : 'Create Game'
  } = options;

  const form = UIBuilder.createElement('form', { className: 'space-y-6' });

  // Game Name Section
  const nameSection = UIBuilder.createElement('div');
  const nameTitle = UIBuilder.createElement('h4', {
    className: 'text-lg font-medium mb-3 text-gray-800',
    textContent: 'Game Details'
  });
  nameSection.appendChild(nameTitle);

  const nameGroup = UIBuilder.createElement('div', { className: 'mb-4' });
  const nameLabel = UIBuilder.createElement('label', {
    className: 'block text-gray-700 mb-2 font-medium',
    textContent: 'Game Name'
  });
  nameGroup.appendChild(nameLabel);

  const nameInput = UIBuilder.createElement('input', {
    type: 'text',
    value: isEditing ? (gameData.name || 'QR Conquest') : 'QR Conquest',
    className: 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-purple-500',
    id: 'game-name-input',
    required: true
  });
  nameGroup.appendChild(nameInput);
  nameSection.appendChild(nameGroup);
  form.appendChild(nameSection);

  // Game Settings Section
  const settingsSection = UIBuilder.createElement('div');
  const settingsTitle = UIBuilder.createElement('h4', {
    className: 'text-lg font-medium mb-3 text-gray-800',
    textContent: 'Game Settings'
  });
  settingsSection.appendChild(settingsTitle);

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
    value: currentSettings.capture_radius_meters || 15,
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

  // Set current value for editing
  const currentInterval = currentSettings.points_interval_seconds || 15;
  let foundStandardInterval = false;

  intervalOptions.forEach(option => {
    const optionElement = UIBuilder.createElement('option', {
      value: option.value,
      textContent: option.label
    });

    if (option.value === currentInterval) {
      optionElement.selected = true;
      foundStandardInterval = true;
    }

    intervalSelect.appendChild(optionElement);
  });

  // If current value isn't in standard options, select custom
  if (!foundStandardInterval && isEditing) {
    intervalSelect.value = 'custom';
  }

  intervalContainer.appendChild(intervalSelect);

  // Custom interval input
  const customIntervalContainer = UIBuilder.createElement('div', {
    className: 'flex items-center space-x-2',
    style: { display: (!foundStandardInterval && isEditing) ? 'flex' : 'none' },
    id: 'custom-interval-container'
  });

  const customIntervalInput = UIBuilder.createElement('input', {
    type: 'number',
    min: '5',
    max: '3600',
    value: (!foundStandardInterval && isEditing) ? currentInterval : '',
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

  // Auto-start time (only show for setup games)
  if (gameData.status !== 'active') {
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

    // Set current value for editing
    if (isEditing && currentSettings.auto_start_time) {
      const startTime = new Date(currentSettings.auto_start_time * 1000);
      autoStartInput.value = startTime.toISOString().slice(0, 16);
    }

    // Set minimum to current time
    const now = new Date();
    if (!isEditing) {
      now.setMinutes(now.getMinutes() + 5); // Default to 5 minutes from now for creation
    }
    autoStartInput.min = now.toISOString().slice(0, 16);

    autoStartGroup.appendChild(autoStartInput);

    const autoStartHelp = UIBuilder.createElement('p', {
      className: 'text-xs text-gray-500 mt-1',
      textContent: 'Game will start automatically at this time'
    });
    autoStartGroup.appendChild(autoStartHelp);

    settingsGrid.appendChild(autoStartGroup);
  }

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

  // Set current value for editing
  const currentDuration = currentSettings.game_duration_minutes;
  let foundStandardDuration = false;

  durationOptions.forEach(option => {
    const optionElement = UIBuilder.createElement('option', {
      value: option.value,
      textContent: option.label
    });

    if (option.value === currentDuration || (option.value === '' && !currentDuration)) {
      optionElement.selected = true;
      foundStandardDuration = true;
    }

    durationSelect.appendChild(optionElement);
  });

  // If current value isn't in standard options, select custom
  if (!foundStandardDuration && isEditing && currentDuration) {
    durationSelect.value = 'custom';
  }

  durationContainer.appendChild(durationSelect);

  // Custom duration input
  const customDurationContainer = UIBuilder.createElement('div', {
    className: 'flex items-center space-x-2',
    style: { display: (!foundStandardDuration && isEditing && currentDuration) ? 'flex' : 'none' },
    id: 'custom-duration-container'
  });

  const customDurationInput = UIBuilder.createElement('input', {
    type: 'number',
    min: '1',
    max: '43200',
    value: (!foundStandardDuration && isEditing && currentDuration) ? currentDuration : '',
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

  settingsGrid.appendChild(durationGroup);

  settingsSection.appendChild(settingsGrid);
  form.appendChild(settingsSection);

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

  // Add special note for creation mode
  if (!isEditing) {
    const teamsNoteGroup = UIBuilder.createElement('div', {
      className: 'mb-4 bg-yellow-100 border border-yellow-400 text-yellow-700 p-3 rounded-lg'
    });

    const teamsNoteText = UIBuilder.createElement('p');
    const noteStrong = UIBuilder.createElement('strong', { textContent: 'Note:' });
    teamsNoteText.appendChild(noteStrong);
    teamsNoteText.appendChild(document.createTextNode(' Teams must be added by scanning QR codes after game creation. At least 2 teams will be required before starting the game.'));
    teamsNoteGroup.appendChild(teamsNoteText);

    form.appendChild(teamsNoteGroup);
  }

  // Validation warning
  const validationWarning = UIBuilder.createElement('div', {
    className: 'bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded-lg text-sm',
    id: 'validation-warning',
    style: { display: 'none' }
  });
  form.appendChild(validationWarning);

  // Submit button
  const submitButton = UIBuilder.createButton(submitButtonText, null, 'w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors text-lg font-medium');
  submitButton.type = 'submit';
  form.appendChild(submitButton);

  // Real-time validation
  function validateSettings() {
    const radiusInput = document.getElementById('capture-radius-input');
    const intervalSelect = document.getElementById('points-interval-select');
    const customIntervalInput = document.getElementById('custom-interval-input');
    const durationSelect = document.getElementById('duration-select');
    const customDurationInput = document.getElementById('custom-duration-input');
    const warning = document.getElementById('validation-warning');

    // Safety checks
    if (!radiusInput || !intervalSelect || !durationSelect || !warning) {
      console.warn('Validation elements not ready yet');
      return true;
    }

    const radius = parseInt(radiusInput.value);

    // Get points interval
    let interval;
    if (intervalSelect.value === 'custom') {
      interval = parseInt(customIntervalInput.value);
    } else {
      interval = parseInt(intervalSelect.value);
    }

    // Get duration
    let duration = null;
    if (durationSelect.value === 'custom') {
      duration = parseInt(customDurationInput.value);
    } else if (durationSelect.value) {
      duration = parseInt(durationSelect.value);
    }

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

    // For active games, check if new duration would immediately end the game
    if (isEditing && gameData.status === 'active' && duration && gameData.settings?.start_time) {
      const elapsedMinutes = Math.floor((Date.now() / 1000 - gameData.settings.start_time) / 60);
      if (duration <= elapsedMinutes) {
        warning.textContent = `⚠️ Cannot set duration to ${duration} minutes as ${elapsedMinutes} minutes have already elapsed. Use 'End Game' button instead.`;
        warning.style.display = 'block';
        return false;
      }
    }

    warning.style.display = 'none';
    return true;
  }

  // Add validation listeners
  setTimeout(() => {
    const intervalSelect = document.getElementById('points-interval-select');
    const customIntervalInput = document.getElementById('custom-interval-input');
    const durationSelect = document.getElementById('duration-select');
    const customDurationInput = document.getElementById('custom-duration-input');

    if (intervalSelect) {
      intervalSelect.addEventListener('change', validateSettings);
    }
    if (customIntervalInput) {
      customIntervalInput.addEventListener('input', validateSettings);
    }
    if (durationSelect) {
      durationSelect.addEventListener('change', validateSettings);
    }
    if (customDurationInput) {
      customDurationInput.addEventListener('input', validateSettings);
    }

    // Initial validation
    validateSettings();
  }, 100);

  // Handle form submission
  if (onSubmit) {
    form.addEventListener('submit', onSubmit);
  }

  return form;
}

function renderGameSettingsModal() {
  // Get current settings
  const settings = appState.gameData.settings || {};

  // Use the consolidated form for editing
  const settingsForm = buildGameSettingsForm({
    isEditing: true,
    currentSettings: settings,
    gameData: appState.gameData,
    onSubmit: async function(e) {
      e.preventDefault();

      const validatedSettings = validateGameSettings();
      if (!validatedSettings) {
        return; // Validation failed
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
            ...validatedSettings
          })
        });

        await handleApiResponse(response, 'Failed to update game settings');

        // Close modal
        modal.close();

        // Refresh game data
        await fetchGameData(appState.gameData.id);

        showNotification('Game settings updated successfully!', 'success');

      } catch (error) {
        console.error('Error updating settings:', error);
        showNotification(error.message || 'Failed to update settings', 'error');
      }
    },
    submitButtonText: 'Save Settings'
  });

  const modal = UIBuilder.createModal({
    title: 'Edit Game Settings',
    content: settingsForm,
    size: 'xl',
    actions: [
      {
        text: 'Cancel',
        onClick: () => modal.close(),
        className: 'bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors'
      }
      // Note: Submit button is already part of the form, so we don't duplicate it here
    ]
  });

  document.body.appendChild(modal);
}

// Shared validation function for game settings
function validateGameSettings() {
  const gameName = document.getElementById('game-name-input').value.trim();
  if (!gameName) {
    showNotification('Please enter a game name', 'warning');
    return null;
  }

  // Get capture radius
  const captureRadius = parseInt(document.getElementById('capture-radius-input').value);
  if (isNaN(captureRadius) || captureRadius < 5 || captureRadius > 500) {
    showNotification('Capture radius must be between 5 and 500 metres', 'error');
    return null;
  }

  // Get points interval
  let pointsInterval;
  const intervalSelect = document.getElementById('points-interval-select');
  if (intervalSelect.value === 'custom') {
    pointsInterval = parseInt(document.getElementById('custom-interval-input').value);
    if (isNaN(pointsInterval) || pointsInterval < 5 || pointsInterval > 3600) {
      showNotification('Points interval must be between 5 and 3600 seconds', 'error');
      return null;
    }
  } else {
    pointsInterval = parseInt(intervalSelect.value);
  }

  // Get auto-start time (optional)
  let autoStartTime = null;
  const autoStartInput = document.getElementById('auto-start-input');
  if (autoStartInput && autoStartInput.value) {
    autoStartTime = Math.floor(new Date(autoStartInput.value).getTime() / 1000);
    if (autoStartTime <= Math.floor(Date.now() / 1000)) {
      showNotification('Auto-start time must be in the future', 'error');
      return null;
    }
  }

  // Get game duration (optional)
  let gameDuration = null;
  const durationSelect = document.getElementById('duration-select');
  if (durationSelect.value === 'custom') {
    gameDuration = parseInt(document.getElementById('custom-duration-input').value);
    if (isNaN(gameDuration) || gameDuration < 1 || gameDuration > 43200) {
      showNotification('Game duration must be between 1 and 43200 minutes', 'error');
      return null;
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
      return null;
    }

    if (appState.gameData.status === 'active' && appState.gameData.settings?.start_time) {
      const elapsedMinutes = Math.floor((Date.now() / 1000 - appState.gameData.settings.start_time) / 60);
      if (gameDuration <= elapsedMinutes) {
        showNotification(
          `Cannot set duration to ${gameDuration} minutes as ${elapsedMinutes} minutes have already elapsed. Use 'End Game' button to end the game immediately.`,
          'error'
        );
        return null;
      }
    }
  }

  const settings = {
    name: gameName,
    capture_radius_meters: captureRadius,
    points_interval_seconds: pointsInterval,
    game_duration_minutes: gameDuration
  };

  // Only include auto_start_time if the field exists and has a value
  if (autoStartTime !== null) {
    settings.auto_start_time = autoStartTime;
  }

  return settings;
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

  const gpsStatusContainer = UIBuilder.createElement('div', {
    className: 'mb-4 flex justify-center'
  });
  gpsStatusContainer.appendChild(createGPSStatusIndicator());
  container.appendChild(gpsStatusContainer);

  setTimeout(() => {
    updateGPSStatusDisplay();
  }, 100);

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
    { value: 'bg-orange-500', label: 'Orange' },
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

  // GPS status
  const gpsStatusContainer = UIBuilder.createElement('div', {
    className: 'mb-4 flex justify-center'
  });
  gpsStatusContainer.appendChild(createGPSStatusIndicator());
  container.appendChild(gpsStatusContainer);

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
  // Replace the form creation section with:
const form = buildBaseLocationForm({
  isEditing: false,
  onSubmit: function(e) {
    e.preventDefault();

    const lat = parseFloat(document.getElementById('latitude').value);
    const lng = parseFloat(document.getElementById('longitude').value);

    if (isNaN(lat) || isNaN(lng)) {
      showNotification('Please set the location for this base first.', 'error');
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

    // Call the API function from core.js
    const baseName = document.getElementById('base-name').value;
    createBase(qrId, baseName, lat, lng);
  },
  submitButtonText: 'Create Base'
});

container.appendChild(form);

  // Cancel button
  const cancelButton = UIBuilder.createButton('Cancel', function() {
    sessionStorage.removeItem('pendingQRCode');
    navigateTo('hostPanel');
  }, 'mt-4 bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded w-full');
  container.appendChild(cancelButton);

  // Initialize with current GPS if available
  setTimeout(() => {
    updateGPSStatusDisplay();

    // Auto-populate with current GPS if available
    if (appState.gps.currentPosition && appState.gps.status === 'ready') {
      useCurrentGPSLocation();
    }
  }, 100);

  return container;
}

// Function to display a modal for editing base details
function renderBaseEditModal(base) {
  // Use the consolidated form for editing
  const baseForm = buildBaseLocationForm({
    isEditing: true,
    currentBase: base,
    onSubmit: async function(e) {
      e.preventDefault();

      const name = document.getElementById('base-name').value.trim();
      const lat = parseFloat(document.getElementById('latitude').value);
      const lng = parseFloat(document.getElementById('longitude').value);

      if (!name) {
        showNotification('Please enter a base name', 'warning');
        return;
      }

      if (isNaN(lat) || isNaN(lng)) {
        showNotification('Please set a valid location for this base', 'error');
        return;
      }

      try {
        await updateBase(base.id, name, lat, lng);
        modal.close();
        showNotification(`Base "${name}" updated successfully!`, 'success');
      } catch (error) {
        // Error handling is done in updateBase function
      }
    },
    submitButtonText: 'Update Base'
  });

  const modal = UIBuilder.createModal({
    title: `Edit Base: ${base.name}`,
    content: baseForm,
    size: 'xl',
    actions: [
      {
        text: 'Cancel',
        onClick: () => modal.close(),
        className: 'bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors'
      }
      // Note: Submit button is already part of the form
    ]
  });

  document.body.appendChild(modal);
}

// Function to display a modal for deleting a base with timestamp options
function renderBaseDeleteModal(base) {
  const formContent = UIBuilder.createElement('div', { className: 'space-y-4' });

  // Warning message
  const warningDiv = UIBuilder.createElement('div', {
    className: 'bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg'
  });

  const warningTitle = UIBuilder.createElement('p', {
    className: 'font-semibold mb-1',
    textContent: `Delete base "${base.name}"?`
  });
  warningDiv.appendChild(warningTitle);

  const warningText = UIBuilder.createElement('p', {
    className: 'text-sm',
    textContent: 'This will remove the base from the game and release its QR code for reuse.'
  });
  warningDiv.appendChild(warningText);

  formContent.appendChild(warningDiv);

  // Scoring options
  const scoringTitle = UIBuilder.createElement('h4', {
    className: 'font-medium text-gray-900 mb-3',
    textContent: 'When should scoring stop for this base?'
  });
  formContent.appendChild(scoringTitle);

  const optionsContainer = UIBuilder.createElement('div', { className: 'space-y-3' });

  // Option 1: Delete from now (default)
  const nowOption = UIBuilder.createElement('label', {
    className: 'flex items-start space-x-3 cursor-pointer'
  });

  const nowRadio = UIBuilder.createElement('input', {
    type: 'radio',
    name: 'deletion-time',
    value: 'now',
    checked: true,
    className: 'mt-1'
  });
  nowOption.appendChild(nowRadio);

  const nowLabel = UIBuilder.createElement('div');
  const nowTitle = UIBuilder.createElement('div', {
    className: 'font-medium',
    textContent: 'Now (Recommended)'
  });
  const nowDesc = UIBuilder.createElement('div', {
    className: 'text-sm text-gray-600',
    textContent: 'Teams keep all points earned up to now'
  });
  nowLabel.appendChild(nowTitle);
  nowLabel.appendChild(nowDesc);
  nowOption.appendChild(nowLabel);

  optionsContainer.appendChild(nowOption);

  // Option 2: Delete from game start
  const gameStartOption = UIBuilder.createElement('label', {
    className: 'flex items-start space-x-3 cursor-pointer'
  });

  const gameStartRadio = UIBuilder.createElement('input', {
    type: 'radio',
    name: 'deletion-time',
    value: 'game_start',
    className: 'mt-1'
  });
  gameStartOption.appendChild(gameStartRadio);

  const gameStartLabel = UIBuilder.createElement('div');
  const gameStartTitle = UIBuilder.createElement('div', {
    className: 'font-medium',
    textContent: 'From game start'
  });
  const gameStartDesc = UIBuilder.createElement('div', {
    className: 'text-sm text-gray-600',
    textContent: 'Remove ALL points from this base'
  });
  gameStartLabel.appendChild(gameStartTitle);
  gameStartLabel.appendChild(gameStartDesc);
  gameStartOption.appendChild(gameStartLabel);

  optionsContainer.appendChild(gameStartOption);

  // Option 3: Custom time
  const customOption = UIBuilder.createElement('label', {
    className: 'flex items-start space-x-3 cursor-pointer'
  });

  const customRadio = UIBuilder.createElement('input', {
    type: 'radio',
    name: 'deletion-time',
    value: 'custom',
    className: 'mt-1'
  });
  customOption.appendChild(customRadio);

  const customLabel = UIBuilder.createElement('div', { className: 'flex-1' });
  const customTitle = UIBuilder.createElement('div', {
    className: 'font-medium',
    textContent: 'From specific time'
  });
  const customDesc = UIBuilder.createElement('div', {
    className: 'text-sm text-gray-600 mb-2',
    textContent: 'Remove points earned after this time'
  });

  const customTimeInput = UIBuilder.createElement('input', {
    type: 'datetime-local',
    id: 'custom-deletion-time',
    className: 'w-full px-3 py-2 border rounded-lg text-sm',
    disabled: true
  });

  // Set min/max for custom time
  if (appState.gameData.settings?.start_time) {
    const startTime = new Date(appState.gameData.settings.start_time * 1000);
    customTimeInput.min = startTime.toISOString().slice(0, 16);
  }
  const now = new Date();
  customTimeInput.max = now.toISOString().slice(0, 16);

  customLabel.appendChild(customTitle);
  customLabel.appendChild(customDesc);
  customLabel.appendChild(customTimeInput);
  customOption.appendChild(customLabel);

  optionsContainer.appendChild(customOption);

  // Enable/disable custom time input based on radio selection
  const radios = optionsContainer.querySelectorAll('input[type="radio"]');
  radios.forEach(radio => {
    radio.addEventListener('change', function() {
      customTimeInput.disabled = this.value !== 'custom';
      if (this.value === 'custom') {
        customTimeInput.focus();
      }
    });
  });

  formContent.appendChild(optionsContainer);

  const modal = UIBuilder.createModal({
    title: 'Delete Base',
    content: formContent,
    actions: [
      {
        text: 'Cancel',
        onClick: () => modal.close(),
        className: 'bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors'
      },
      {
        text: 'Delete Base',
        onClick: async () => {
          const selectedOption = formContent.querySelector('input[name="deletion-time"]:checked').value;

          let deletedAt;
          if (selectedOption === 'now') {
            deletedAt = Math.floor(Date.now() / 1000);
          } else if (selectedOption === 'game_start') {
            deletedAt = 0;
          } else if (selectedOption === 'custom') {
            const customTime = customTimeInput.value;
            if (!customTime) {
              showNotification('Please select a custom deletion time', 'warning');
              return;
            }
            deletedAt = Math.floor(new Date(customTime).getTime() / 1000);
          }

          try {
            await deleteBase(base.id, deletedAt);
            modal.close();
          } catch (error) {
            // Error handling is done in deleteBase function
          }
        },
        className: 'bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors'
      }
    ]
  });

  document.body.appendChild(modal);
}

// Function to display a modal for restoring a deleted base
function renderBaseRestoreModal(base) {
  const contentDiv = UIBuilder.createElement('div', { className: 'space-y-4' });

  // Information message
  const infoDiv = UIBuilder.createElement('div', {
    className: 'bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg'
  });

  const infoTitle = UIBuilder.createElement('p', {
    className: 'font-semibold mb-2',
    textContent: `Restore base "${base.name}"?`
  });
  infoDiv.appendChild(infoTitle);

  const infoList = UIBuilder.createElement('ul', {
    className: 'text-sm space-y-1 list-disc list-inside'
  });

  const info1 = UIBuilder.createElement('li', {
    textContent: 'A fresh QR code scan is required to complete the restoration'
  });
  const info2 = UIBuilder.createElement('li', {
    textContent: 'The original QR code was released'
  });
  const info3 = UIBuilder.createElement('li', {
    textContent: 'All previous captures and points will be restored'
  });

  infoList.appendChild(info1);
  infoList.appendChild(info2);
  infoList.appendChild(info3);
  infoDiv.appendChild(infoList);

  contentDiv.appendChild(infoDiv);

  // Instructions
  const instructionsP = UIBuilder.createElement('p', {
    className: 'text-gray-600',
    textContent: 'Click "Scan QR Code" below to begin the restoration process.'
  });
  contentDiv.appendChild(instructionsP);

  const modal = UIBuilder.createModal({
    title: 'Restore Deleted Base',
    content: contentDiv,
    actions: [
      {
        text: 'Cancel',
        onClick: () => modal.close(),
        className: 'bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors'
      },
      {
        text: 'Scan QR Code',
        onClick: () => {
          // Set restoration mode
          sessionStorage.setItem('restoringBaseId', base.id);
          modal.close();
          navigateTo('scanQR');
        },
        className: 'bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors',
        icon: 'qr-code'
      }
    ]
  });

  document.body.appendChild(modal);
}

// Reusable form builder for base location (create/edit)
function buildBaseLocationForm(options = {}) {
  const {
    isEditing = false,
    currentBase = null,
    onSubmit = null,
    submitButtonText = isEditing ? 'Update Base' : 'Create Base'
  } = options;

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
    value: isEditing ? currentBase.name : '',
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
    id: isEditing ? 'edit-base-location-map' : 'base-location-map',
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

  // Location control buttons
  const locationButtonGroup = UIBuilder.createElement('div', { className: 'flex gap-2' });

  // Use Current GPS button
  const useCurrentGpsBtn = UIBuilder.createButton('Use Current GPS', function() {
    useCurrentGPSLocation();
  }, 'flex-1 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded', 'navigation');

  // Reset to GPS button (initially hidden)
  const resetToGpsBtn = UIBuilder.createButton('Reset to GPS', function() {
    resetToCurrentGPS();
  }, 'bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded', 'rotate-ccw');
  resetToGpsBtn.id = 'reset-to-gps';
  resetToGpsBtn.style.display = 'none';

  locationButtonGroup.appendChild(useCurrentGpsBtn);
  locationButtonGroup.appendChild(resetToGpsBtn);
  locationGroup.appendChild(locationButtonGroup);

  // Hidden fields for location data
  const latInput = UIBuilder.createElement('input', {
    type: 'hidden',
    id: 'latitude',
    name: 'latitude',
    value: isEditing ? currentBase.lat : ''
  });

  const lngInput = UIBuilder.createElement('input', {
    type: 'hidden',
    id: 'longitude',
    name: 'longitude',
    value: isEditing ? currentBase.lng : ''
  });

  const accuracyInput = UIBuilder.createElement('input', {
    type: 'hidden',
    id: 'accuracy',
    name: 'accuracy'
  });

  locationGroup.appendChild(latInput);
  locationGroup.appendChild(lngInput);
  locationGroup.appendChild(accuracyInput);

  form.appendChild(locationGroup);

  // Submit button
  const submitButton = UIBuilder.createButton(submitButtonText, null, 'w-full bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded mt-6');
  submitButton.type = 'submit';
  form.appendChild(submitButton);

  // Handle form submission
  if (onSubmit) {
    form.addEventListener('submit', onSubmit);
  }

  // Initialize map functionality (reuse existing logic from renderBaseCreationForm)
  setTimeout(() => {
    initBaseLocationFormMap(isEditing, currentBase);
  }, 100);

  return form;
}

// Helper function to initialize map for base location form
function initBaseLocationFormMap(isEditing, currentBase) {
  // Reuse the existing GPS and map logic from renderBaseCreationForm
  // but adapt it for the reusable form
  
  // Set initial coordinates if editing
  if (isEditing && currentBase) {
    document.getElementById('latitude').value = currentBase.lat;
    document.getElementById('longitude').value = currentBase.lng;
    
    // Initialize map with existing coordinates
    if (typeof initBaseLocationMap === 'function') {
      initBaseLocationMap(currentBase.lat, currentBase.lng);
    }
  } else {
    // For new bases, try to use current GPS
    updateGPSStatusDisplay();
    
    if (appState.gps.currentPosition && appState.gps.status === 'ready') {
      useCurrentGPSLocation();
    }
  }
}

// Function to display a modal for editing team details
function renderTeamEditModal(team) {
  // Create form content
  const formContent = UIBuilder.createElement('form', { className: 'space-y-4' });

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
  formContent.appendChild(nameGroup);

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
    { value: 'bg-orange-500', label: 'Orange' },
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
  formContent.appendChild(colorGroup);

  const modal = UIBuilder.createModal({
    title: 'Edit Team',
    content: formContent,
    actions: [
      {
        text: 'Cancel',
        onClick: () => modal.close(),
        className: 'bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors'
      },
      {
        text: 'Save Changes',
        onClick: () => {
          updateTeam(team.id, nameInput.value, colorSelect.value);
          modal.close();
        },
        className: 'bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors'
      }
    ]
  });

  document.body.appendChild(modal);
}

// Function to display team QR code modal
function renderTeamQRModal(team) {
  // Create content container
  const qrContent = UIBuilder.createElement('div', {
    className: 'text-center'
  });

  // Team info
  const teamInfo = UIBuilder.createElement('div', {
    className: 'mb-4'
  });

  const teamColorDot = UIBuilder.createElement('div', {
    className: `w-8 h-8 rounded-full ${team.color} mx-auto mb-2`
  });
  teamInfo.appendChild(teamColorDot);

  const teamNameDisplay = UIBuilder.createElement('p', {
    className: 'text-lg font-semibold text-gray-900',
    textContent: team.name
  });
  teamInfo.appendChild(teamNameDisplay);

  qrContent.appendChild(teamInfo);

  // QR code container
  const qrContainer = UIBuilder.createElement('div', {
    className: 'bg-gray-100 p-6 rounded-lg mb-4'
  });

  const qrDiv = UIBuilder.createElement('div', {
    id: `qr-team-${team.id}`,
    className: 'flex justify-center'
  });
  qrContainer.appendChild(qrDiv);

  qrContent.appendChild(qrContainer);

  // Generate team QR URL
  const baseUrl = window.location.protocol + '//' + window.location.host;
  const teamUrl = `${baseUrl}/?id=${team.qrCode}`;

  // URL display
  const urlInfo = UIBuilder.createElement('div', {
    className: 'mb-4'
  });

  const urlLabel = UIBuilder.createElement('p', {
    className: 'text-sm text-gray-600 mb-1',
    textContent: 'Team Join URL:'
  });
  urlInfo.appendChild(urlLabel);

  const urlValue = UIBuilder.createElement('p', {
    className: 'font-mono text-xs bg-gray-100 p-2 rounded break-all',
    textContent: teamUrl
  });
  urlInfo.appendChild(urlValue);

  qrContent.appendChild(urlInfo);

  // Instructions
  const instructions = UIBuilder.createElement('div', {
    className: 'bg-blue-50 border border-blue-200 rounded-lg p-4 text-left mb-4'
  });

  const instructionsTitle = UIBuilder.createElement('p', {
    className: 'font-semibold text-blue-900 mb-2',
    textContent: 'How to use this QR code:'
  });
  instructions.appendChild(instructionsTitle);

  const instructionsList = UIBuilder.createElement('ul', {
    className: 'text-sm text-blue-800 space-y-1 list-disc list-inside'
  });

  const instructionItems = [
    'Share this QR code with new players who want to join this team',
    'Players scan the code with their phone camera',
    'They will be prompted to enter their name and join the team',
    'Players can switch teams by scanning a different team QR code'
  ];

  instructionItems.forEach(item => {
    const li = UIBuilder.createElement('li', { textContent: item });
    instructionsList.appendChild(li);
  });

  instructions.appendChild(instructionsList);
  qrContent.appendChild(instructions);

  // Player count
  const playerCount = UIBuilder.createElement('p', {
    className: 'text-sm text-gray-600',
    textContent: `Current players: ${team.playerCount || 0}`
  });
  qrContent.appendChild(playerCount);

  // Create modal
  const modal = UIBuilder.createModal({
    title: `${team.name} - Team QR Code`,
    content: qrContent,
    size: 'md',
    actions: [
      {
        text: 'Copy Link',
        onClick: () => {
          navigator.clipboard.writeText(teamUrl);
          showNotification('Team join link copied to clipboard', 'success');
        },
        className: 'bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors',
        icon: 'link'
      },
      {
        text: 'Close',
        onClick: () => modal.close(),
        className: 'bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors'
      }
    ]
  });

  document.body.appendChild(modal);

  // Generate QR code after modal is added to DOM
  setTimeout(() => {
    generateQRCode(qrDiv.id, teamUrl);
  }, 100);
}


// Player Registration Page
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
    placeholder: 'Enter your name',
    required: true
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

    const playerName = nameInput.value.trim();
    if (!playerName) {
      showNotification('Please enter your name', 'warning');
      return;
    }

    joinTeam(teamId, playerName);

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
