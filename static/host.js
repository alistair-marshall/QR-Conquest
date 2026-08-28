// Convert a Date to the value format used by <input type="datetime-local">.
// datetime-local expects local time, so we can't use toISOString() (UTC) directly.
function toDatetimeLocalValue(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

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

    // Question Bank Section - host-level, reusable across games
    const questionBankSection = UIBuilder.createElement('div', {
      className: 'bg-white rounded-lg shadow-md p-6 mb-6'
    });

    const questionBankTitle = UIBuilder.createElement('h3', {
      className: 'text-xl font-semibold mb-2',
      textContent: 'Question Bank'
    });
    questionBankSection.appendChild(questionBankTitle);

    questionBankSection.appendChild(UIBuilder.createElement('p', {
      className: 'text-gray-600 mb-4 text-sm',
      textContent: 'Manage the questions used for quiz capture. Questions are shared across all of your games.'
    }));

    const manageQuestionsBtn = UIBuilder.createButton('Manage Question Bank', function() {
      navigateTo('questionBank');
    }, 'w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors text-lg font-medium flex items-center justify-center', 'help-circle');
    questionBankSection.appendChild(manageQuestionsBtn);

    container.appendChild(questionBankSection);

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

  // The game's id is a random UUID that nobody needs to read or repeat, so
  // this card names the game the way the host named it
  const gameNameCard = UIBuilder.createElement('div', { className: 'bg-gray-50 p-3 rounded-lg' });
  const gameNameLabel = UIBuilder.createElement('div', {
    className: 'text-sm text-gray-600 font-medium',
    textContent: 'Game'
  });
  gameNameCard.appendChild(gameNameLabel);
  const gameNameValue = UIBuilder.createElement('div', {
    className: 'text-lg font-bold text-purple-600',
    textContent: appState.gameData.name
  });
  gameNameCard.appendChild(gameNameValue);
  gameInfoGrid.appendChild(gameNameCard);

  const statusCard = UIBuilder.createElement('div', { className: 'bg-gray-50 p-3 rounded-lg' });
  const statusLabel = UIBuilder.createElement('div', {
    className: 'text-sm text-gray-600 font-medium',
    textContent: 'Status'
  });
  statusCard.appendChild(statusLabel);
  const statusValue = UIBuilder.createElement('div', {
    className: 'text-lg font-bold capitalize' + (
      appState.gameData.status === 'active' ? ' text-green-600' :
      appState.gameData.status === 'setup' ? ' text-orange-600' :
      appState.gameData.status === 'bonus' ? ' text-yellow-600' : ' text-gray-600'
    ),
    textContent: appState.gameData.status === 'bonus' ? 'Bonus round' : appState.gameData.status
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

  // Join Method
  const joinMethodLabels = {
    team_qr: 'Team QR only',
    choose_team: 'Player choice',
    fewest_players: 'Fewest players',
    lowest_points: 'Lowest score'
  };
  const joinMethodCard = UIBuilder.createElement('div', { className: 'bg-gray-50 p-3 rounded-lg text-center' });
  const joinMethodCardLabel = UIBuilder.createElement('div', {
    className: 'text-sm text-gray-600 font-medium',
    textContent: 'Join Method'
  });
  joinMethodCard.appendChild(joinMethodCardLabel);
  const joinMethodCardValue = UIBuilder.createElement('div', {
    className: 'text-lg font-bold text-teal-600',
    textContent: joinMethodLabels[settings.join_method] || joinMethodLabels.team_qr
  });
  joinMethodCard.appendChild(joinMethodCardValue);
  settingsGrid.appendChild(joinMethodCard);

  // Quiz Capture
  const quizCard = UIBuilder.createElement('div', { className: 'bg-gray-50 p-3 rounded-lg text-center' });
  const quizCardLabel = UIBuilder.createElement('div', {
    className: 'text-sm text-gray-600 font-medium',
    textContent: 'Quiz Capture'
  });
  quizCard.appendChild(quizCardLabel);
  const quizCardValue = UIBuilder.createElement('div', {
    className: settings.quiz_enabled ? 'text-lg font-bold text-indigo-600' : 'text-lg font-bold text-gray-500',
    textContent: settings.quiz_enabled ? `On (max shield ${settings.max_shield || 5})` : 'Off'
  });
  quizCard.appendChild(quizCardValue);
  settingsGrid.appendChild(quizCard);

  // Bonus Round
  const bonusCard = UIBuilder.createElement('div', { className: 'bg-gray-50 p-3 rounded-lg text-center' });
  const bonusCardLabel = UIBuilder.createElement('div', {
    className: 'text-sm text-gray-600 font-medium',
    textContent: 'Bonus Round'
  });
  bonusCard.appendChild(bonusCardLabel);
  let bonusText = 'Off';
  if (settings.bonus_round_enabled || settings.bonus_start_time) {
    bonusText = settings.bonus_points_per_base
      ? `On (${settings.bonus_points_per_base} pts/base)`
      : 'On (auto points)';
  }
  const bonusCardValue = UIBuilder.createElement('div', {
    className: (settings.bonus_round_enabled || settings.bonus_start_time)
      ? 'text-lg font-bold text-yellow-600' : 'text-lg font-bold text-gray-500',
    textContent: bonusText
  });
  bonusCard.appendChild(bonusCardValue);
  settingsGrid.appendChild(bonusCard);

  settingsSection.appendChild(settingsGrid);

  // Settings actions (only show for games in setup or active state)
  if (appState.gameData.status === 'setup' || appState.gameData.status === 'active') {
    const settingsActions = UIBuilder.createElement('div', {
      className: 'mt-4 pt-3 border-t flex flex-wrap gap-2'
    });

    const editSettingsBtn = UIBuilder.createButton('Edit Settings', function() {
      renderGameSettingsModal();
    }, 'bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm', 'settings');
    settingsActions.appendChild(editSettingsBtn);

    const questionBankBtn = UIBuilder.createButton('Manage Question Bank', function() {
      navigateTo('questionBank');
    }, 'bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors text-sm', 'help-circle');
    settingsActions.appendChild(questionBankBtn);

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

      // Action buttons container
      const teamActionsContainer = UIBuilder.createElement('div', {
        className: 'flex items-center space-x-2'
      });

      // Edit button
      const editButton = UIBuilder.createButton('Edit', function() {
        renderTeamEditModal(team);
      }, 'bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors flex items-center', 'edit-2');
      teamActionsContainer.appendChild(editButton);

      // Delete button - only for empty teams, so no scores or players are lost
      if (!(team.playerCount || 0)) {
        const deleteTeamButton = UIBuilder.createButton('Delete', function() {
          renderTeamDeleteModal(team);
        }, 'bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition-colors flex items-center', 'trash-2');
        teamActionsContainer.appendChild(deleteTeamButton);
      }

      teamHeader.appendChild(teamActionsContainer);

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

  const baseSectionHeader = UIBuilder.createElement('div', {
    className: 'flex flex-wrap justify-between items-center gap-2 mb-4'
  });

  const baseTitle = UIBuilder.createElement('h3', {
    className: 'text-xl font-semibold',
    textContent: 'Base Management'
  });
  baseSectionHeader.appendChild(baseTitle);

  // Map/list filters (only for hosts)
  const toggleGroup = UIBuilder.createElement('div', {
    className: 'flex items-center space-x-3'
  });

  // Show deleted bases toggle
  const showDeletedToggle = UIBuilder.createElement('label', {
    className: 'flex items-center text-sm cursor-pointer'
  });

  const toggleCheckbox = UIBuilder.createElement('input', {
    type: 'checkbox',
    id: 'show-deleted-bases',
    className: 'mr-2'
  });
  // Set as a property: UIBuilder uses setAttribute, and a present checked
  // attribute renders the box ticked even when the value is "false"
  toggleCheckbox.checked = localStorage.getItem('showDeletedBases') === 'true';

  toggleCheckbox.addEventListener('change', function() {
    localStorage.setItem('showDeletedBases', this.checked);
    renderApp(); // Re-render to show/hide deleted bases
  });

  const toggleText = UIBuilder.createElement('span', {
    textContent: 'Show deleted'
  });

  showDeletedToggle.appendChild(toggleCheckbox);
  showDeletedToggle.appendChild(toggleText);
  toggleGroup.appendChild(showDeletedToggle);

  // Show player pins toggle - a big group all standing together can crowd the
  // bases, so the host can take the players off the map without losing them
  const showPlayersToggle = UIBuilder.createElement('label', {
    className: 'flex items-center text-sm cursor-pointer'
  });

  const playersCheckbox = UIBuilder.createElement('input', {
    type: 'checkbox',
    id: 'show-player-positions',
    className: 'mr-2'
  });
  playersCheckbox.checked = showPlayerPositions();

  playersCheckbox.addEventListener('change', function() {
    localStorage.setItem('showPlayerPositions', this.checked);

    // Only the pins change, so redraw them in place rather than re-rendering
    // the whole panel (which would tear the map down and rebuild it)
    if (this.checked) {
      startPlayerPositionPolling();
    } else {
      stopPlayerPositionPolling();
    }
    updatePlayerPositionMarkers();
  });

  const playersToggleText = UIBuilder.createElement('span', {
    textContent: 'Show players'
  });

  showPlayersToggle.appendChild(playersCheckbox);
  showPlayersToggle.appendChild(playersToggleText);
  toggleGroup.appendChild(showPlayersToggle);

  baseSectionHeader.appendChild(toggleGroup);
  baseSection.appendChild(baseSectionHeader);

  if (appState.gameData.bases && appState.gameData.bases.length > 0) {
    // Filter bases based on toggle setting
    const showDeleted = localStorage.getItem('showDeletedBases') === 'true';
    const basesToShow = appState.gameData.bases.filter(base => !base.deleted_at || showDeleted);

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

        const quizEnabled = !!(appState.gameData.settings && appState.gameData.settings.quiz_enabled);

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
            textContent: quizEnabled ? 'Neutral' : 'Uncaptured'
          });
          ownerContainer.appendChild(uncaptured);
        }

        if (quizEnabled && !base.deleted_at) {
          const shieldBadge = UIBuilder.createElement('span', {
            className: 'ml-2 text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full',
            textContent: `🛡 ${base.shield || 0}`
          });
          ownerContainer.appendChild(shieldBadge);
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
    // Show prompt to add bases when there are none
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
    const bonusEnabled = !!(appState.gameData.settings && appState.gameData.settings.bonus_round_enabled);

    // Bonus round: end normal scoring and send players out to collect bases
    if (bonusEnabled) {
      const bonusButton = UIBuilder.createButton('Start Bonus Round', function() {
        if (confirm('Start the bonus round? Bases will stop scoring points and players will be sent out to collect the base QR codes for bonus points.')) {
          // Call the API function from core.js
          startBonusRound();
        }
      }, 'w-full bg-yellow-500 text-white py-3 px-4 rounded-lg hover:bg-yellow-600 transition-colors text-lg font-medium flex items-center justify-center', 'flag');
      controlButtons.appendChild(bonusButton);
    }

    // Game is running - show End Game button
    const endConfirmText = bonusEnabled
      ? 'Are you sure you want to end the game now? This will skip the bonus round and release all QR codes for reuse.'
      : 'Are you sure you want to end the game? This will end the current game and release all QR codes for reuse.';
    const endButton = UIBuilder.createButton('End Game', function() {
      // Confirm before ending
      if (confirm(endConfirmText)) {
        // Call the API function from core.js
        endGame();
      }
    }, 'w-full bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 transition-colors text-lg font-medium flex items-center justify-center', 'stop-circle');
    controlButtons.appendChild(endButton);

  } else if (appState.gameData.status === 'bonus') {
    // Bonus round in progress - host checks collected bases back in
    const bonusInfo = UIBuilder.createElement('div', {
      className: 'bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-4'
    });
    bonusInfo.appendChild(UIBuilder.createElement('p', {
      className: 'font-semibold text-yellow-800 mb-1',
      textContent: '🏁 Bonus round in progress'
    }));
    const perBase = appState.gameData.settings?.bonus_points_per_base;
    bonusInfo.appendChild(UIBuilder.createElement('p', {
      className: 'text-sm text-yellow-800',
      textContent: `Players are collecting bases${perBase ? ` for ${perBase} points each` : ''}. ` +
        `Scan each base QR code as it is brought back to you to check it in and award the points. ` +
        `Bases that were never collected properly can be scanned in too - they come off the map without scoring.`
    }));
    controlSection.appendChild(bonusInfo);

    // Collection checklist so the host can see what is still out there
    const bases = (appState.gameData.bases || []).filter(base => !base.deleted_at);
    if (bases.length > 0) {
      const checklist = UIBuilder.createElement('div', {
        className: 'border border-gray-200 rounded-lg divide-y mb-4'
      });

      bases.forEach(function(base) {
        const row = UIBuilder.createElement('div', {
          className: 'flex justify-between items-center px-3 py-2 text-sm'
        });

        row.appendChild(UIBuilder.createElement('span', {
          className: 'font-medium text-gray-800',
          textContent: base.name
        }));

        let statusBadge;
        if (base.returnedAt) {
          const team = appState.gameData.teams.find(t => t.id === base.collectedBy);
          statusBadge = UIBuilder.createElement('span', {
            className: 'text-xs font-semibold bg-green-100 text-green-700 px-2 py-1 rounded-full',
            textContent: `✓ Returned${team ? ' - ' + team.name : ' - no points'}`
          });
        } else if (base.collectedBy) {
          const team = appState.gameData.teams.find(t => t.id === base.collectedBy);
          statusBadge = UIBuilder.createElement('span', {
            className: 'text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-1 rounded-full',
            textContent: `Collected${team ? ' - ' + team.name : ''}`
          });
        } else {
          statusBadge = UIBuilder.createElement('span', {
            className: 'text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-1 rounded-full',
            textContent: 'Out there'
          });
        }
        row.appendChild(statusBadge);

        checklist.appendChild(row);
      });

      controlSection.appendChild(checklist);
    }

    const checkInButton = UIBuilder.createButton('Scan Base to Check In', function() {
      navigateTo('scanQR');
    }, 'w-full bg-yellow-500 text-white py-3 px-4 rounded-lg hover:bg-yellow-600 transition-colors text-lg font-medium flex items-center justify-center', 'qr-code');
    controlButtons.appendChild(checkInButton);

    const endButton = UIBuilder.createButton('End Game', function() {
      const unreturned = (appState.gameData.bases || [])
        .filter(base => !base.deleted_at && base.collectedBy && !base.returnedAt).length;
      const warning = unreturned > 0
        ? `Are you sure you want to end the game? ${unreturned} collected base${unreturned === 1 ? ' has' : 's have'} not been checked in and will score no bonus points. All QR codes will be released for reuse.`
        : 'Are you sure you want to end the game? This will finish the bonus round and release all QR codes for reuse.';
      if (confirm(warning)) {
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
    const games = await fetchHostGames();

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
      autoStartInput.value = toDatetimeLocalValue(startTime);
    }

    // Set minimum to current time
    const now = new Date();
    if (!isEditing) {
      now.setMinutes(now.getMinutes() + 5); // Default to 5 minutes from now for creation
    }
    autoStartInput.min = toDatetimeLocalValue(now);

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
    min: '5',
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

  // Player join method
  const joinMethodGroup = UIBuilder.createElement('div');
  const joinMethodLabel = UIBuilder.createElement('label', {
    className: 'block text-sm font-medium text-gray-700 mb-1',
    textContent: 'Player Join Method'
  });
  joinMethodGroup.appendChild(joinMethodLabel);

  const joinMethodSelect = UIBuilder.createElement('select', {
    className: 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-purple-500',
    id: 'join-method-select'
  });

  const joinMethodOptions = [
    { value: 'team_qr', label: 'Team QR code only' },
    { value: 'choose_team', label: 'Players choose their own team' },
    { value: 'fewest_players', label: 'Auto-assign to team with fewest players' },
    { value: 'lowest_points', label: 'Auto-assign to team with lowest score' }
  ];

  const currentJoinMethod = currentSettings.join_method || 'team_qr';
  joinMethodOptions.forEach(option => {
    const optionElement = UIBuilder.createElement('option', {
      value: option.value,
      textContent: option.label
    });
    if (option.value === currentJoinMethod) {
      optionElement.selected = true;
    }
    joinMethodSelect.appendChild(optionElement);
  });

  joinMethodGroup.appendChild(joinMethodSelect);

  const joinMethodHelp = UIBuilder.createElement('p', {
    className: 'text-xs text-gray-500 mt-1',
    textContent: 'How new players join when they scan a base QR code'
  });
  joinMethodGroup.appendChild(joinMethodHelp);

  settingsGrid.appendChild(joinMethodGroup);

  settingsSection.appendChild(settingsGrid);
  form.appendChild(settingsSection);

  // Quiz Capture Section
  const quizSection = UIBuilder.createElement('div');
  quizSection.appendChild(UIBuilder.createElement('h4', {
    className: 'text-lg font-medium mb-3 text-gray-800',
    textContent: 'Quiz Capture'
  }));

  const quizEnabledGroup = UIBuilder.createElement('div', { className: 'mb-4' });
  const quizEnabledLabel = UIBuilder.createElement('label', { className: 'flex items-center gap-2 font-medium text-gray-700 cursor-pointer' });
  const quizEnabledCheckbox = UIBuilder.createElement('input', { type: 'checkbox', id: 'quiz-enabled-checkbox' });
  quizEnabledCheckbox.checked = !!currentSettings.quiz_enabled;
  quizEnabledLabel.appendChild(quizEnabledCheckbox);
  quizEnabledLabel.appendChild(document.createTextNode('Enable quiz-based capture'));
  quizEnabledGroup.appendChild(quizEnabledLabel);
  quizEnabledGroup.appendChild(UIBuilder.createElement('p', {
    className: 'text-xs text-gray-500 mt-1',
    textContent: 'Players answer questions to reduce, capture and reinforce bases, instead of instant GPS capture.'
  }));
  quizSection.appendChild(quizEnabledGroup);

  const quizFieldsContainer = UIBuilder.createElement('div', {
    id: 'quiz-fields-container',
    className: 'space-y-4',
    style: { display: currentSettings.quiz_enabled ? 'block' : 'none' }
  });

  const categoriesGroup = UIBuilder.createElement('div');
  categoriesGroup.appendChild(UIBuilder.createElement('label', {
    className: 'block text-sm font-medium text-gray-700 mb-1',
    textContent: 'Active Categories'
  }));
  const categoriesList = UIBuilder.createElement('div', {
    id: 'quiz-categories-list',
    className: 'flex flex-wrap gap-2'
  });
  categoriesList.appendChild(UIBuilder.createElement('p', {
    className: 'text-sm text-gray-500 italic',
    textContent: 'Loading categories...'
  }));
  categoriesGroup.appendChild(categoriesList);
  categoriesGroup.appendChild(UIBuilder.createElement('p', {
    className: 'text-xs text-gray-500 mt-1',
    textContent: 'Only questions in the selected categories are used for this game.'
  }));
  quizFieldsContainer.appendChild(categoriesGroup);

  const quizNumbersGrid = UIBuilder.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' });

  const maxShieldGroup = UIBuilder.createElement('div');
  maxShieldGroup.appendChild(UIBuilder.createElement('label', {
    className: 'block text-sm font-medium text-gray-700 mb-1',
    textContent: 'Max Shield'
  }));
  const maxShieldInput = UIBuilder.createElement('input', {
    type: 'number',
    min: '1',
    max: '20',
    value: currentSettings.max_shield || 5,
    className: 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-purple-500',
    id: 'max-shield-input'
  });
  maxShieldGroup.appendChild(maxShieldInput);
  maxShieldGroup.appendChild(UIBuilder.createElement('p', {
    className: 'text-xs text-gray-500 mt-1',
    textContent: 'Maximum shield a base can be reinforced to (1-20)'
  }));
  quizNumbersGrid.appendChild(maxShieldGroup);

  const cooldownGroup = UIBuilder.createElement('div');
  cooldownGroup.appendChild(UIBuilder.createElement('label', {
    className: 'block text-sm font-medium text-gray-700 mb-1',
    textContent: 'Cooldown (seconds)'
  }));
  const cooldownInput = UIBuilder.createElement('input', {
    type: 'number',
    min: '5',
    max: '3600',
    value: currentSettings.cooldown_seconds || 30,
    className: 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-purple-500',
    id: 'cooldown-seconds-input'
  });
  cooldownGroup.appendChild(cooldownInput);
  cooldownGroup.appendChild(UIBuilder.createElement('p', {
    className: 'text-xs text-gray-500 mt-1',
    textContent: 'How long a player is locked out game-wide after a wrong answer'
  }));
  quizNumbersGrid.appendChild(cooldownGroup);

  quizFieldsContainer.appendChild(quizNumbersGrid);

  const manageQuestionsBtn = UIBuilder.createButton('Manage Question Bank', function() {
    navigateTo('questionBank');
  }, 'text-sm bg-indigo-100 text-indigo-700 py-2 px-3 rounded-lg hover:bg-indigo-200 transition-colors', 'help-circle');
  manageQuestionsBtn.type = 'button';
  quizFieldsContainer.appendChild(manageQuestionsBtn);

  quizSection.appendChild(quizFieldsContainer);
  form.appendChild(quizSection);

  quizEnabledCheckbox.addEventListener('change', function() {
    quizFieldsContainer.style.display = this.checked ? 'block' : 'none';
  });

  // Bonus Round Section
  const bonusSection = UIBuilder.createElement('div');
  bonusSection.appendChild(UIBuilder.createElement('h4', {
    className: 'text-lg font-medium mb-3 text-gray-800',
    textContent: 'Bonus Round'
  }));

  // Once the bonus round has started its points are locked in, so the
  // fields become read-only information
  const bonusLocked = !!currentSettings.bonus_start_time;

  const bonusEnabledGroup = UIBuilder.createElement('div', { className: 'mb-4' });
  const bonusEnabledLabel = UIBuilder.createElement('label', { className: 'flex items-center gap-2 font-medium text-gray-700 cursor-pointer' });
  const bonusEnabledCheckbox = UIBuilder.createElement('input', { type: 'checkbox', id: 'bonus-enabled-checkbox' });
  bonusEnabledCheckbox.checked = !!currentSettings.bonus_round_enabled;
  bonusEnabledCheckbox.disabled = bonusLocked;
  bonusEnabledLabel.appendChild(bonusEnabledCheckbox);
  bonusEnabledLabel.appendChild(document.createTextNode('Enable bonus round when the main game ends'));
  bonusEnabledGroup.appendChild(bonusEnabledLabel);
  bonusEnabledGroup.appendChild(UIBuilder.createElement('p', {
    className: 'text-xs text-gray-500 mt-1',
    textContent: 'After the main game, players collect base QR codes and return them to you for bonus points.'
  }));
  bonusSection.appendChild(bonusEnabledGroup);

  const bonusFieldsContainer = UIBuilder.createElement('div', {
    id: 'bonus-fields-container',
    style: { display: currentSettings.bonus_round_enabled ? 'block' : 'none' }
  });

  const bonusPointsGroup = UIBuilder.createElement('div');
  bonusPointsGroup.appendChild(UIBuilder.createElement('label', {
    className: 'block text-sm font-medium text-gray-700 mb-1',
    textContent: 'Points per Collected Base'
  }));
  const bonusPointsInput = UIBuilder.createElement('input', {
    type: 'number',
    min: '1',
    max: '1000000',
    value: currentSettings.bonus_points_per_base || '',
    placeholder: 'Automatic',
    className: 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-purple-500',
    id: 'bonus-points-input'
  });
  bonusPointsInput.disabled = bonusLocked;
  bonusPointsGroup.appendChild(bonusPointsInput);
  bonusPointsGroup.appendChild(UIBuilder.createElement('p', {
    className: 'text-xs text-gray-500 mt-1',
    textContent: bonusLocked
      ? 'The bonus round has started - its points value is locked in.'
      : 'Leave blank for automatic: chosen when the bonus round starts so that the last-placed team would win by collecting every base.'
  }));
  bonusFieldsContainer.appendChild(bonusPointsGroup);

  bonusSection.appendChild(bonusFieldsContainer);
  form.appendChild(bonusSection);

  bonusEnabledCheckbox.addEventListener('change', function() {
    bonusFieldsContainer.style.display = this.checked ? 'block' : 'none';
  });

  // Populate the category picker asynchronously from the host's bank
  const quizAuthState = getAuthState();
  if (quizAuthState.hostId) {
    fetchHostCategories().then(function(categories) {
      categoriesList.innerHTML = '';
      if (!categories.length) {
        categoriesList.appendChild(UIBuilder.createElement('p', {
          className: 'text-sm text-gray-500 italic',
          textContent: 'No categories yet - add questions in the Question Bank first.'
        }));
        return;
      }
      const selected = new Set(currentSettings.active_categories || []);
      categories.forEach(function(cat) {
        const label = UIBuilder.createElement('label', {
          className: 'flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-lg text-sm cursor-pointer'
        });
        const checkbox = UIBuilder.createElement('input', {
          type: 'checkbox',
          className: 'quiz-category-checkbox',
          value: cat
        });
        checkbox.checked = selected.has(cat);
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(cat));
        categoriesList.appendChild(label);
      });
    }).catch(function() {
      categoriesList.innerHTML = '';
      categoriesList.appendChild(UIBuilder.createElement('p', {
        className: 'text-sm text-red-500',
        textContent: 'Could not load categories.'
      }));
    });
  } else {
    categoriesList.innerHTML = '';
  }

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
    if (isNaN(gameDuration) || gameDuration < 5 || gameDuration > 43200) {
      showNotification('Game duration must be between 5 and 43200 minutes', 'error');
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

  // Get join method
  const joinMethodSelect = document.getElementById('join-method-select');
  const joinMethod = joinMethodSelect ? joinMethodSelect.value : 'team_qr';

  // Get quiz capture settings
  const quizEnabledCheckbox = document.getElementById('quiz-enabled-checkbox');
  const quizEnabled = quizEnabledCheckbox ? quizEnabledCheckbox.checked : false;
  const activeCategories = Array.from(document.querySelectorAll('.quiz-category-checkbox:checked')).map(cb => cb.value);

  const maxShieldInput = document.getElementById('max-shield-input');
  const maxShield = maxShieldInput ? parseInt(maxShieldInput.value) : 5;

  const cooldownSecondsInput = document.getElementById('cooldown-seconds-input');
  const cooldownSeconds = cooldownSecondsInput ? parseInt(cooldownSecondsInput.value) : 30;

  if (quizEnabled) {
    if (isNaN(maxShield) || maxShield < 1 || maxShield > 20) {
      showNotification('Max shield must be between 1 and 20', 'error');
      return null;
    }
    if (isNaN(cooldownSeconds) || cooldownSeconds < 5 || cooldownSeconds > 3600) {
      showNotification('Cooldown must be between 5 and 3600 seconds', 'error');
      return null;
    }
    if (activeCategories.length === 0) {
      showNotification('Select at least one category to enable quiz capture', 'error');
      return null;
    }
  }

  // Get bonus round settings
  const bonusEnabledCheckbox = document.getElementById('bonus-enabled-checkbox');
  const bonusEnabled = bonusEnabledCheckbox ? bonusEnabledCheckbox.checked : false;

  const bonusPointsInput = document.getElementById('bonus-points-input');
  let bonusPointsPerBase = null; // null means automatic
  if (bonusPointsInput && bonusPointsInput.value.trim() !== '') {
    bonusPointsPerBase = parseInt(bonusPointsInput.value);
    if (isNaN(bonusPointsPerBase) || bonusPointsPerBase < 1 || bonusPointsPerBase > 1000000) {
      showNotification('Bonus points per base must be between 1 and 1,000,000, or blank for automatic', 'error');
      return null;
    }
  }

  const settings = {
    name: gameName,
    capture_radius_meters: captureRadius,
    points_interval_seconds: pointsInterval,
    game_duration_minutes: gameDuration,
    join_method: joinMethod,
    quiz_enabled: quizEnabled,
    active_categories: activeCategories,
    max_shield: isNaN(maxShield) ? 5 : maxShield,
    cooldown_seconds: isNaN(cooldownSeconds) ? 30 : cooldownSeconds,
    bonus_round_enabled: bonusEnabled
  };

  // The points value is locked once the bonus round has started, so only
  // send it while the field is still editable
  if (!bonusPointsInput || !bonusPointsInput.disabled) {
    settings.bonus_points_per_base = bonusPointsPerBase;
  }

  // Only include auto_start_time if the field exists and has a value
  if (autoStartTime !== null) {
    settings.auto_start_time = autoStartTime;
  }

  return settings;
}

// =============================================================================
// QUESTION BANK (host-level, reusable across games)
// =============================================================================

function renderQuestionBankPage() {
  const container = UIBuilder.createElement('div', { className: 'max-w-3xl mx-auto px-4 pb-4' });

  const authState = getAuthState();
  if (!authState.isHost) {
    container.appendChild(UIBuilder.createElement('p', {
      className: 'text-center text-gray-600 py-8',
      textContent: 'Host authentication required to manage the question bank.'
    }));
    return container;
  }

  const header = UIBuilder.createElement('div', { className: 'flex items-center justify-between mb-6' });
  header.appendChild(UIBuilder.createElement('h2', {
    className: 'text-2xl font-bold',
    textContent: 'Question Bank'
  }));
  const backBtn = UIBuilder.createButton('Back', function() {
    navigateTo('hostPanel');
  }, 'bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors text-sm', 'arrow-left');
  header.appendChild(backBtn);
  container.appendChild(header);

  const actionsRow = UIBuilder.createElement('div', { className: 'flex flex-wrap gap-2 mb-4' });
  const addBtn = UIBuilder.createButton('Add Question', function() {
    renderQuestionFormModal(null);
  }, 'bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors text-sm', 'plus');
  actionsRow.appendChild(addBtn);

  const bulkImportBtn = UIBuilder.createButton('Bulk Import', function() {
    renderBulkImportModal();
  }, 'bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors text-sm', 'upload');
  actionsRow.appendChild(bulkImportBtn);
  container.appendChild(actionsRow);

  const listContainer = UIBuilder.createElement('div', {
    id: 'question-bank-list',
    className: 'space-y-3'
  });
  listContainer.appendChild(UIBuilder.createLoadingDisplay('Loading questions...'));
  container.appendChild(listContainer);

  setTimeout(() => loadQuestionBankList(), 0);

  return container;
}

async function loadQuestionBankList() {
  const listContainer = document.getElementById('question-bank-list');
  if (!listContainer) return;

  try {
    const questions = await fetchQuestions();
    listContainer.innerHTML = '';

    if (!questions.length) {
      listContainer.appendChild(UIBuilder.createEmptyState({
        icon: 'help-circle',
        title: 'No Questions Yet',
        message: 'Add a question or bulk import your existing bank to enable quiz capture.',
      }));
      return;
    }

    // Group by category
    const byCategory = {};
    questions.forEach(function(q) {
      byCategory[q.category] = byCategory[q.category] || [];
      byCategory[q.category].push(q);
    });

    Object.keys(byCategory).sort().forEach(function(category) {
      const categorySection = UIBuilder.createElement('div', { className: 'bg-white rounded-lg shadow-md p-4' });

      const categoryHeader = UIBuilder.createElement('div', { className: 'flex items-center justify-between gap-3 mb-3' });
      categoryHeader.appendChild(UIBuilder.createElement('h3', {
        className: 'text-lg font-semibold',
        textContent: `${category} (${byCategory[category].length})`
      }));

      const deleteCategoryBtn = UIBuilder.createButton('Delete All', async function() {
        const count = byCategory[category].length;
        if (!confirm(`Permanently delete all ${count} question(s) in "${category}"? This cannot be undone.`)) return;
        try {
          const result = await bulkDeleteQuestions(byCategory[category].map(q => q.id));
          if (result.in_use) {
            showNotification(`Deleted ${result.deleted} question(s); ${result.in_use} skipped because a running game is using this category`, 'warning');
          } else {
            showNotification(`Deleted ${result.deleted} question(s)`, 'success');
          }
          loadQuestionBankList();
        } catch (err) {
          showNotification(err.message || 'Unable to delete questions', 'error');
        }
      }, 'bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 transition-colors flex-shrink-0', 'trash-2');
      categoryHeader.appendChild(deleteCategoryBtn);
      categorySection.appendChild(categoryHeader);

      const qList = UIBuilder.createElement('div', { className: 'space-y-2' });
      byCategory[category].forEach(function(q) {
        qList.appendChild(buildQuestionCard(q));
      });
      categorySection.appendChild(qList);
      listContainer.appendChild(categorySection);
    });
  } catch (err) {
    listContainer.innerHTML = '';
    listContainer.appendChild(UIBuilder.createElement('p', {
      className: 'text-red-600 text-center py-4',
      textContent: err.message || 'Unable to load questions.'
    }));
  }
}

function buildQuestionCard(question) {
  const card = UIBuilder.createElement('div', {
    className: question.active
      ? 'border border-gray-200 rounded-lg p-3 bg-gray-50'
      : 'border border-gray-200 rounded-lg p-3 bg-gray-100 opacity-60'
  });

  const row = UIBuilder.createElement('div', { className: 'flex items-start justify-between gap-3' });

  const textCol = UIBuilder.createElement('div', { className: 'flex-1' });
  const typeLabel = question.type === 'mc' ? 'Multiple choice' : 'True/False';
  textCol.appendChild(UIBuilder.createElement('div', {
    className: 'font-medium text-gray-900',
    textContent: question.text
  }));

  const correctOption = (question.options || []).find(o => o.id === question.correct_option_id);
  textCol.appendChild(UIBuilder.createElement('div', {
    className: 'text-xs text-gray-500 mt-1',
    textContent: `${typeLabel} · Correct: ${correctOption ? correctOption.text : '—'}${question.active ? '' : ' · disabled'}`
  }));

  if (question.explanation) {
    textCol.appendChild(UIBuilder.createElement('div', {
      className: 'text-xs text-gray-400 italic mt-1',
      textContent: question.explanation
    }));
  }
  row.appendChild(textCol);

  const actionsCol = UIBuilder.createElement('div', { className: 'flex items-center gap-2 flex-shrink-0' });
  const editBtn = UIBuilder.createButton('Edit', function() {
    renderQuestionFormModal(question);
  }, 'bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 transition-colors', 'edit-2');
  actionsCol.appendChild(editBtn);

  const toggleBtn = UIBuilder.createButton(question.active ? 'Disable' : 'Enable', async function() {
    try {
      await updateQuestion(question.id, { active: !question.active });
      showNotification(question.active ? 'Question disabled' : 'Question enabled', 'success');
      loadQuestionBankList();
    } catch (err) {
      showNotification(err.message || 'Unable to update question', 'error');
    }
  }, question.active
    ? 'bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600 transition-colors'
    : 'bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors',
  question.active ? 'eye-off' : 'eye');
  actionsCol.appendChild(toggleBtn);

  const deleteBtn = UIBuilder.createButton('Delete', async function() {
    if (!confirm('Permanently delete this question? This cannot be undone.')) return;
    try {
      await deleteQuestion(question.id);
      showNotification('Question deleted', 'success');
      loadQuestionBankList();
    } catch (err) {
      showNotification(err.message || 'Unable to delete question', 'error');
    }
  }, 'bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 transition-colors', 'trash-2');
  actionsCol.appendChild(deleteBtn);

  row.appendChild(actionsCol);
  card.appendChild(row);
  return card;
}

function renderQuestionFormModal(existingQuestion) {
  const isEditing = !!existingQuestion;
  const form = UIBuilder.createElement('form', { className: 'space-y-4' });

  // Type selector
  const typeGroup = UIBuilder.createElement('div');
  typeGroup.appendChild(UIBuilder.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1', textContent: 'Type' }));
  const typeSelect = UIBuilder.createElement('select', {
    className: 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-purple-500',
    id: 'question-type-select'
  });
  ['mc', 'tf'].forEach(function(t) {
    const opt = UIBuilder.createElement('option', { value: t, textContent: t === 'mc' ? 'Multiple choice' : 'True/False' });
    if (existingQuestion && existingQuestion.type === t) opt.selected = true;
    typeSelect.appendChild(opt);
  });
  typeGroup.appendChild(typeSelect);
  form.appendChild(typeGroup);

  // Text
  const textGroup = UIBuilder.createElement('div');
  textGroup.appendChild(UIBuilder.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1', textContent: 'Question' }));
  const textInput = UIBuilder.createElement('textarea', {
    className: 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-purple-500',
    id: 'question-text-input',
    rows: '2'
  });
  textInput.value = existingQuestion ? existingQuestion.text : '';
  textGroup.appendChild(textInput);
  form.appendChild(textGroup);

  // Category
  const categoryGroup = UIBuilder.createElement('div');
  categoryGroup.appendChild(UIBuilder.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1', textContent: 'Category' }));
  const categoryInput = UIBuilder.createElement('input', {
    type: 'text',
    className: 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-purple-500',
    id: 'question-category-input',
    placeholder: 'e.g. Emergency Aid'
  });
  categoryInput.value = existingQuestion ? existingQuestion.category : '';
  categoryGroup.appendChild(categoryInput);
  form.appendChild(categoryGroup);

  // MC options container (built/rebuilt based on type)
  const optionsContainer = UIBuilder.createElement('div', { id: 'question-options-container', className: 'space-y-2' });
  form.appendChild(optionsContainer);

  function buildOptionsForType(type) {
    optionsContainer.innerHTML = '';

    if (type === 'tf') {
      optionsContainer.appendChild(UIBuilder.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1', textContent: 'Correct Answer' }));
      const tfSelect = UIBuilder.createElement('select', {
        className: 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-purple-500',
        id: 'question-tf-correct'
      });
      ['true', 'false'].forEach(function(v) {
        const opt = UIBuilder.createElement('option', { value: v, textContent: v === 'true' ? 'True' : 'False' });
        if (existingQuestion && existingQuestion.type === 'tf' && existingQuestion.correct_option_id === v) {
          opt.selected = true;
        }
        tfSelect.appendChild(opt);
      });
      optionsContainer.appendChild(tfSelect);
      return;
    }

    // Multiple choice: a list of option text inputs with a radio for correct
    optionsContainer.appendChild(UIBuilder.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1', textContent: 'Options (select the correct one)' }));

    const rowsContainer = UIBuilder.createElement('div', { id: 'mc-option-rows', className: 'space-y-2' });
    optionsContainer.appendChild(rowsContainer);

    const existingOptions = (existingQuestion && existingQuestion.type === 'mc' && existingQuestion.options)
      ? existingQuestion.options
      : [{ id: null, text: '' }, { id: null, text: '' }];

    existingOptions.forEach(function(opt, idx) {
      addOptionRow(rowsContainer, opt.text, existingQuestion && existingQuestion.correct_option_id === opt.id);
    });

    const addOptionBtn = UIBuilder.createButton('Add Option', function() {
      addOptionRow(rowsContainer, '', false);
    }, 'text-sm bg-gray-200 text-gray-700 py-1 px-3 rounded hover:bg-gray-300 transition-colors mt-2', 'plus');
    addOptionBtn.type = 'button';
    optionsContainer.appendChild(addOptionBtn);
  }

  function addOptionRow(rowsContainer, value, checked) {
    const row = UIBuilder.createElement('div', { className: 'flex items-center gap-2' });
    const radio = UIBuilder.createElement('input', { type: 'radio', name: 'mc-correct-option', className: 'mc-correct-radio' });
    radio.checked = !!checked;
    row.appendChild(radio);

    const input = UIBuilder.createElement('input', {
      type: 'text',
      className: 'flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:border-purple-500 mc-option-text'
    });
    input.value = value || '';
    row.appendChild(input);

    const removeBtn = UIBuilder.createButton('', function() {
      if (rowsContainer.children.length > 2) {
        row.remove();
      } else {
        showNotification('Multiple-choice questions need at least two options', 'warning');
      }
    }, 'bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200 transition-colors', 'x');
    removeBtn.type = 'button';
    row.appendChild(removeBtn);

    rowsContainer.appendChild(row);
  }

  buildOptionsForType(typeSelect.value);
  typeSelect.addEventListener('change', function() {
    buildOptionsForType(this.value);
    if (window.lucide) window.lucide.createIcons();
  });

  // Explanation
  const explanationGroup = UIBuilder.createElement('div');
  explanationGroup.appendChild(UIBuilder.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1', textContent: 'Explanation (shown only on a wrong answer)' }));
  const explanationInput = UIBuilder.createElement('textarea', {
    className: 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-purple-500',
    id: 'question-explanation-input',
    rows: '2'
  });
  explanationInput.value = (existingQuestion && existingQuestion.explanation) || '';
  explanationGroup.appendChild(explanationInput);
  form.appendChild(explanationGroup);

  const submitButton = UIBuilder.createButton(isEditing ? 'Save Question' : 'Add Question', null,
    'w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors font-medium');
  submitButton.type = 'submit';
  form.appendChild(submitButton);

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const text = textInput.value.trim();
    const category = categoryInput.value.trim();
    const type = typeSelect.value;

    if (!text) {
      showNotification('Question text is required', 'warning');
      return;
    }
    if (!category) {
      showNotification('Category is required', 'warning');
      return;
    }

    const payload = { text, type, category, explanation: explanationInput.value.trim() || null };

    if (type === 'tf') {
      const tfSelect = document.getElementById('question-tf-correct');
      payload.correct = tfSelect.value === 'true';
    } else {
      const optionInputs = Array.from(document.querySelectorAll('.mc-option-text'));
      const radios = Array.from(document.querySelectorAll('.mc-correct-radio'));
      const options = optionInputs.map(inp => inp.value.trim());

      if (options.some(o => !o)) {
        showNotification('Options cannot be blank', 'warning');
        return;
      }
      if (options.length < 2) {
        showNotification('Multiple-choice questions need at least two options', 'warning');
        return;
      }

      const correctIndex = radios.findIndex(r => r.checked);
      if (correctIndex === -1) {
        showNotification('Select the correct option', 'warning');
        return;
      }

      payload.options = options;
      payload.correct = correctIndex;
    }

    try {
      if (isEditing) {
        await updateQuestion(existingQuestion.id, payload);
        showNotification('Question updated', 'success');
      } else {
        await createQuestion(payload);
        showNotification('Question added', 'success');
      }
      modal.close();
      loadQuestionBankList();
    } catch (err) {
      showNotification(err.message || 'Unable to save question', 'error');
    }
  });

  const modal = UIBuilder.createModal({
    title: isEditing ? 'Edit Question' : 'Add Question',
    content: form,
    size: 'lg',
    actions: [{
      text: 'Cancel',
      onClick: () => modal.close(),
      className: 'bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors'
    }]
  });

  document.body.appendChild(modal);
  if (window.lucide) window.lucide.createIcons();
}

function renderBulkImportModal() {
  const container = UIBuilder.createElement('div', { className: 'space-y-4' });

  container.appendChild(UIBuilder.createElement('p', {
    className: 'text-sm text-gray-600',
    textContent: 'Paste a JSON array of questions, or CSV with header: text,type,options,correct,category,explanation (options pipe-separated for mc, e.g. "Paris|London|Berlin").'
  }));

  const formatSelect = UIBuilder.createElement('select', {
    className: 'px-3 py-2 border rounded-lg',
    id: 'bulk-import-format'
  });
  ['json', 'csv'].forEach(function(f) {
    formatSelect.appendChild(UIBuilder.createElement('option', { value: f, textContent: f.toUpperCase() }));
  });
  container.appendChild(formatSelect);

  const textarea = UIBuilder.createElement('textarea', {
    id: 'bulk-import-textarea',
    className: 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-purple-500 font-mono text-xs',
    rows: '10',
    placeholder: '[{"text":"2+2?","type":"mc","options":["3","4","5"],"correct":"4","category":"Maths"}]'
  });
  container.appendChild(textarea);

  const resultsContainer = UIBuilder.createElement('div', { id: 'bulk-import-results', className: 'text-sm' });
  container.appendChild(resultsContainer);

  const importBtn = UIBuilder.createButton('Import', async function() {
    const raw = textarea.value.trim();
    if (!raw) {
      showNotification('Paste some questions first', 'warning');
      return;
    }

    let payload;
    if (formatSelect.value === 'csv') {
      payload = { csv: raw };
    } else {
      try {
        payload = { questions: JSON.parse(raw) };
      } catch (err) {
        showNotification('Invalid JSON: ' + err.message, 'error');
        return;
      }
    }

    try {
      const result = await bulkImportQuestions(payload);
      resultsContainer.innerHTML = '';
      resultsContainer.appendChild(UIBuilder.createElement('p', {
        className: 'text-green-700 font-medium',
        textContent: `Imported ${result.imported} question(s).`
      }));
      if (result.errors && result.errors.length) {
        const errorList = UIBuilder.createElement('ul', { className: 'list-disc list-inside text-red-600 mt-2' });
        result.errors.forEach(function(e) {
          errorList.appendChild(UIBuilder.createElement('li', { textContent: `Row ${e.row}: ${e.error}` }));
        });
        resultsContainer.appendChild(errorList);
      }
      if (result.imported > 0) {
        loadQuestionBankList();
      }
    } catch (err) {
      showNotification(err.message || 'Import failed', 'error');
    }
  }, 'w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium');
  importBtn.type = 'button';
  container.appendChild(importBtn);

  const modal = UIBuilder.createModal({
    title: 'Bulk Import Questions',
    content: container,
    size: 'lg',
    actions: [{
      text: 'Close',
      onClick: () => modal.close(),
      className: 'bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors'
    }]
  });

  document.body.appendChild(modal);
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
  const form = buildBaseLocationForm({
    isEditing: false,
    initialName: defaultBaseName,
    onSubmit: function(e) {
      e.preventDefault();

      const lat = parseFloat(document.getElementById('latitude').value);
      const lng = parseFloat(document.getElementById('longitude').value);

      if (isNaN(lat) || isNaN(lng)) {
        showNotification('Please set the location for this base first.', 'error');
        return;
      }

      // Get accuracy for validation (only relevant for GPS coordinates)
      const locationSource = document.getElementById('location-source').value;
      const accuracy = parseFloat(document.getElementById('accuracy').value);
      if (locationSource === 'gps' && accuracy > 20) {
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
    textContent: 'This will remove the base from the game. Its QR code can be reused for a new base or team, and can still be scanned in during the bonus round.'
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

  // Set min/max for custom time (datetime-local expects local time, not UTC)
  if (appState.gameData.settings?.start_time) {
    customTimeInput.min = toDatetimeLocalValue(new Date(appState.gameData.settings.start_time * 1000));
  }
  customTimeInput.max = toDatetimeLocalValue(new Date());

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
    textContent: 'A QR code scan is required to complete the restoration'
  });
  const info2 = UIBuilder.createElement('li', {
    textContent: 'The original QR code can be scanned again, or use a new one'
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
    submitButtonText = isEditing ? 'Update Base' : 'Create Base',
    initialName = isEditing && currentBase ? currentBase.name : ''
  } = options;

  const mapContainerId = isEditing ? 'edit-base-location-map' : 'base-location-map';

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
    value: initialName,
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
    id: mapContainerId,
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
    value: isEditing && currentBase ? currentBase.lat : ''
  });

  const lngInput = UIBuilder.createElement('input', {
    type: 'hidden',
    id: 'longitude',
    name: 'longitude',
    value: isEditing && currentBase ? currentBase.lng : ''
  });

  const accuracyInput = UIBuilder.createElement('input', {
    type: 'hidden',
    id: 'accuracy',
    name: 'accuracy'
  });

  // Records whether the coordinates came from GPS or manual placement, so
  // submit handlers can decide whether the GPS accuracy warning applies
  const locationSourceInput = UIBuilder.createElement('input', {
    type: 'hidden',
    id: 'location-source',
    name: 'location-source',
    value: 'none'
  });

  locationGroup.appendChild(latInput);
  locationGroup.appendChild(lngInput);
  locationGroup.appendChild(accuracyInput);
  locationGroup.appendChild(locationSourceInput);

  form.appendChild(locationGroup);

  // Submit button
  const submitButton = UIBuilder.createButton(submitButtonText, null, 'w-full bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded mt-6');
  submitButton.type = 'submit';
  form.appendChild(submitButton);

  // Handle form submission
  if (onSubmit) {
    form.addEventListener('submit', onSubmit);
  }

  // Location source state: 'none', 'gps', 'manual'
  let currentLocationSource = 'none';

  // Map instance and markers
  let baseLocationMap = null;
  let gpsMarker = null;
  let manualMarker = null;
  let accuracyCircle = null;

  function setLocationSource(source) {
    currentLocationSource = source;
    locationSourceInput.value = source;
  }

  // Create the Leaflet map (once) without placing any markers
  function ensureMapInitialized(lat, lng) {
    if (baseLocationMap) {
      return;
    }

    baseLocationMap = L.map(mapContainerId).setView([lat, lng], 18);

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
      latInput.value = clickLat;
      lngInput.value = clickLng;
      setLocationSource('manual');
      updateLocationDisplay();
    });
  }

  // Use current GPS location from continuous tracking
  function useCurrentGPSLocation() {
    if (appState.gps.currentPosition && appState.gps.accuracy) {
      // Use the continuously tracked position
      applyGPSLocation(
        appState.gps.currentPosition.latitude,
        appState.gps.currentPosition.longitude,
        appState.gps.accuracy,
        `Using current GPS location (±${appState.gps.accuracy.toFixed(1)}m)`
      );
    } else {
      // Fall back to fresh GPS request if continuous tracking not available
      if (window.showNotification) {
        window.showNotification('Getting fresh GPS location...', 'info');
      }

      navigator.geolocation.getCurrentPosition(
        function(position) {
          applyGPSLocation(
            position.coords.latitude,
            position.coords.longitude,
            position.coords.accuracy,
            `GPS location acquired (±${position.coords.accuracy.toFixed(1)}m)`
          );
        },
        function(error) {
          let errorMessage = 'Unable to get GPS location: ';
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMessage += 'Location access denied';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage += 'Location unavailable';
              break;
            case error.TIMEOUT:
              errorMessage += 'Location timeout';
              break;
            default:
              errorMessage += 'Unknown error';
              break;
          }

          if (window.showNotification) {
            window.showNotification(errorMessage, 'error');
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    }
  }

  function applyGPSLocation(lat, lng, accuracy, message) {
    // Update form fields
    latInput.value = lat;
    lngInput.value = lng;
    accuracyInput.value = accuracy;

    // Initialize or update map
    initBaseLocationMap(lat, lng);

    setLocationSource('gps');
    updateLocationDisplay();

    if (window.showNotification) {
      window.showNotification(message, 'success');
    }
  }

  // Reset to current GPS button handler
  function resetToCurrentGPS() {
    if (appState.gps.currentPosition) {
      const gpsLat = appState.gps.currentPosition.latitude;
      const gpsLng = appState.gps.currentPosition.longitude;

      // Reset manual marker to GPS position
      if (manualMarker) {
        manualMarker.setLatLng([gpsLat, gpsLng]);
      }

      // Update coordinates
      latInput.value = gpsLat;
      lngInput.value = gpsLng;
      accuracyInput.value = appState.gps.accuracy;

      // Switch to GPS source
      setLocationSource('gps');
      updateLocationDisplay();

      if (window.showNotification) {
        window.showNotification('Location reset to current GPS position', 'info');
      }
    }
  }

  // Centre the map on a GPS position and show GPS marker plus accuracy circle
  function initBaseLocationMap(lat, lng) {
    ensureMapInitialized(lat, lng);

    // Center map on the provided coordinates
    baseLocationMap.setView([lat, lng], 18);

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

    // Update accuracy circle if we have accuracy data
    if (appState.gps.accuracy || accuracyInput.value) {
      const accuracy = appState.gps.accuracy || parseFloat(accuracyInput.value);

      if (accuracyCircle) {
        baseLocationMap.removeLayer(accuracyCircle);
      }

      accuracyCircle = L.circle([lat, lng], {
        radius: accuracy,
        color: accuracy <= 10 ? '#22c55e' : accuracy <= 20 ? '#eab308' : '#ef4444',
        fillColor: accuracy <= 10 ? '#22c55e' : accuracy <= 20 ? '#eab308' : '#ef4444',
        fillOpacity: 0.1,
        weight: 1
      }).addTo(baseLocationMap);
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
      latInput.value = newPos.lat;
      lngInput.value = newPos.lng;

      // Switch to manual mode
      setLocationSource('manual');
      updateLocationDisplay();
    });
  }

  function updateLocationDisplay() {
    const currentLat = parseFloat(latInput.value);
    const currentLng = parseFloat(lngInput.value);
    const accuracy = parseFloat(accuracyInput.value);

    if (isNaN(currentLat) || isNaN(currentLng)) {
      return;
    }

    // Show/hide elements based on state
    const hasGpsData = appState.gps.currentPosition;

    if (hasGpsData) {
      resetToGpsBtn.style.display = currentLocationSource === 'manual' ? 'block' : 'none';

      // Show instructions when GPS accuracy is poor
      if (currentLocationSource === 'gps' && accuracy > 15) {
        mapInstructions.style.display = 'block';
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

  // Initialize the map once the form is in the DOM
  setTimeout(() => {
    if (isEditing && currentBase) {
      // Show the base's current location with a draggable marker
      ensureMapInitialized(currentBase.lat, currentBase.lng);
      createManualMarker(currentBase.lat, currentBase.lng);
      setLocationSource('manual');
      updateLocationDisplay();
    } else {
      updateGPSStatusDisplay();

      // Auto-populate with current GPS if available
      if (appState.gps.currentPosition && appState.gps.status === 'ready') {
        useCurrentGPSLocation();
      }
    }
  }, 100);

  return form;
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
      textContent: color.label
    });
    // Set as a property: UIBuilder uses setAttribute, and a present selected
    // attribute marks the option selected even when the value is "false"
    option.selected = color.value === team.color;
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

// Function to confirm deleting a team
function renderTeamDeleteModal(team) {
  const formContent = UIBuilder.createElement('div', { className: 'space-y-4' });

  const warningDiv = UIBuilder.createElement('div', {
    className: 'bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg'
  });

  const warningTitle = UIBuilder.createElement('p', {
    className: 'font-semibold mb-1',
    textContent: `Delete team "${team.name}"?`
  });
  warningDiv.appendChild(warningTitle);

  const warningText = UIBuilder.createElement('p', {
    className: 'text-sm',
    textContent: team.qrCode ?
      'The team has no players, so no scores are lost. It disappears from the scoreboard and its QR code can be reused for a new team or base.' :
      'The team has no players, so no scores are lost. It disappears from the scoreboard.'
  });
  warningDiv.appendChild(warningText);

  formContent.appendChild(warningDiv);

  const modal = UIBuilder.createModal({
    title: 'Delete Team',
    content: formContent,
    actions: [
      {
        text: 'Cancel',
        onClick: () => modal.close(),
        className: 'bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors'
      },
      {
        text: 'Delete Team',
        onClick: async () => {
          try {
            await deleteTeam(team.id);
            modal.close();
          } catch (error) {
            // Error handling is done in deleteTeam function
          }
        },
        className: 'bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors'
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
  const pendingJoinGameId = sessionStorage.getItem('pendingJoinGameId');
  const joinMethod = (appState.gameData.settings && appState.gameData.settings.join_method) || 'team_qr';

  // Determine how this player is joining:
  // 'team' - scanned a team QR code (always allowed)
  // 'choose' - scanned a base and the game lets players pick a team
  // 'auto' - scanned a base and the game auto-assigns a team
  let mode = null;
  if (teamId) {
    mode = 'team';
  } else if (pendingJoinGameId && joinMethod === 'choose_team') {
    mode = 'choose';
  } else if (pendingJoinGameId && (joinMethod === 'fewest_players' || joinMethod === 'lowest_points')) {
    mode = 'auto';
  }

  if (!mode) {
    // No pending team or join request, show error
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

  // Title
  const title = UIBuilder.createElement('h2', {
    className: 'text-2xl font-bold mb-6 text-center',
    textContent: mode === 'team' ? 'Join Team' : 'Join the Game'
  });
  container.appendChild(title);

  if (mode === 'team') {
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

    const teamInfo = UIBuilder.createElement('div', {
      className: `${teamColor} text-white px-6 py-4 rounded-lg text-center mb-6`,
      textContent: `You are joining: ${teamName}`
    });
    container.appendChild(teamInfo);
  } else if (mode === 'auto') {
    const autoInfo = UIBuilder.createElement('div', {
      className: 'bg-purple-100 border border-purple-400 text-purple-700 px-6 py-4 rounded-lg text-center mb-6',
      textContent: joinMethod === 'fewest_players'
        ? 'You will be assigned to the team with the fewest players.'
        : 'You will be assigned to the team with the lowest score.'
    });
    container.appendChild(autoInfo);
  }

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

  // Team picker for games where players choose their own team
  let selectedTeamId = null;
  if (mode === 'choose') {
    const teamGroup = UIBuilder.createElement('div');

    const teamLabel = UIBuilder.createElement('label', {
      className: 'block text-gray-700 text-sm font-bold mb-2',
      textContent: 'Choose Your Team'
    });
    teamGroup.appendChild(teamLabel);

    const teamList = UIBuilder.createElement('div', { className: 'space-y-2' });
    const teamButtons = [];

    (appState.gameData.teams || []).forEach(team => {
      const teamButton = UIBuilder.createElement('button', {
        type: 'button',
        className: `${team.color} text-white w-full px-4 py-3 rounded-lg flex justify-between items-center opacity-70 transition-all`
      });

      const teamNameSpan = UIBuilder.createElement('span', {
        className: 'font-bold',
        textContent: team.name
      });
      teamButton.appendChild(teamNameSpan);

      const playerCountSpan = UIBuilder.createElement('span', {
        className: 'text-sm',
        textContent: `${team.playerCount || 0} player${(team.playerCount || 0) === 1 ? '' : 's'}`
      });
      teamButton.appendChild(playerCountSpan);

      teamButton.addEventListener('click', function() {
        selectedTeamId = team.id;
        teamButtons.forEach(btn => {
          btn.classList.add('opacity-70');
          btn.classList.remove('ring-4', 'ring-purple-400');
        });
        teamButton.classList.remove('opacity-70');
        teamButton.classList.add('ring-4', 'ring-purple-400');
      });

      teamButtons.push(teamButton);
      teamList.appendChild(teamButton);
    });

    teamGroup.appendChild(teamList);
    form.appendChild(teamGroup);
  }

  // Submit button
  const submitButton = UIBuilder.createButton(mode === 'team' ? 'Join Team' : 'Join Game', null, 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full');
  submitButton.type = 'submit';
  form.appendChild(submitButton);

  // Handle form submission
  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const playerName = nameInput.value.trim();
    if (!playerName) {
      showNotification('Please enter your name', 'warning');
      return;
    }

    if (mode === 'team') {
      joinTeam(teamId, playerName);
      sessionStorage.removeItem('pendingTeamId');
      return;
    }

    if (mode === 'choose' && !selectedTeamId) {
      showNotification('Please choose a team', 'warning');
      return;
    }

    try {
      if (mode === 'choose') {
        await joinTeam(selectedTeamId, playerName);
      } else {
        await joinGameAuto(pendingJoinGameId, playerName);
      }

      // If they got here by scanning a base, try to capture it now
      await attemptPendingCapture();
    } catch (err) {
      // joinTeam / joinGameAuto already notify the user
      console.error('Error joining game:', err);
    }
  });

  container.appendChild(form);

  // Cancel button
  const cancelButton = UIBuilder.createButton('Cancel', function() {
    sessionStorage.removeItem('pendingTeamId');
    sessionStorage.removeItem('pendingJoinGameId');
    sessionStorage.removeItem('pendingCaptureBaseId');
    navigateTo('landing');
  }, 'mt-4 bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded w-full');
  container.appendChild(cancelButton);

  return container;
}
