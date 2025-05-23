// Host Panel
function renderHostPanel() {
  const container = document.createElement('div');

  // If game is not loaded, show form to create or join
  if (!appState.gameData.id) {
    container.className = 'max-w-md mx-auto';

    const title = document.createElement('h2');
    title.className = 'text-2xl font-bold mb-6 text-center';
    title.textContent = 'Host Panel';
    container.appendChild(title);

    // State for showing create or join form
    let showCreateGame = true;

    // Function to toggle between create and join forms
    function toggleForm() {
      showCreateGame = !showCreateGame;
      renderApp();
    }

    if (showCreateGame) {
      // Create Game Form
      const createForm = document.createElement('div');
      createForm.className = 'bg-white rounded-lg shadow-md p-6 mb-6';

      const createTitle = document.createElement('h3');
      createTitle.className = 'text-xl font-semibold mb-4';
      createTitle.textContent = 'Create New Game';
      createForm.appendChild(createTitle);

      // Game Name
      const nameGroup = document.createElement('div');
      nameGroup.className = 'mb-4';

      const nameLabel = document.createElement('label');
      nameLabel.className = 'block text-gray-700 mb-2';
      nameLabel.textContent = 'Game Name';
      nameGroup.appendChild(nameLabel);

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = 'QR Conquest';
      nameInput.className = 'w-full px-3 py-2 border rounded-lg';
      nameGroup.appendChild(nameInput);

      createForm.appendChild(nameGroup);

      // Host Password
      const passwordGroup = document.createElement('div');
      passwordGroup.className = 'mb-4';

      const passwordLabel = document.createElement('label');
      passwordLabel.className = 'block text-gray-700 mb-2';
      passwordLabel.textContent = 'Host Password';
      passwordGroup.appendChild(passwordLabel);

      const passwordInput = document.createElement('input');
      passwordInput.type = 'password';
      passwordInput.className = 'w-full px-3 py-2 border rounded-lg';
      passwordGroup.appendChild(passwordInput);

      createForm.appendChild(passwordGroup);

      // Note about teams
      const teamsNoteGroup = document.createElement('div');
      teamsNoteGroup.className = 'mb-4 bg-yellow-100 border border-yellow-400 text-yellow-700 p-3 rounded-lg';
      
      const teamsNoteText = document.createElement('p');
      teamsNoteText.innerHTML = '<strong>Note:</strong> Teams must be added by scanning QR codes after game creation. At least 2 teams will be required before starting the game.';
      teamsNoteGroup.appendChild(teamsNoteText);
      
      createForm.appendChild(teamsNoteGroup);

      // Create Game Button
      const createButton = document.createElement('button');
      createButton.className = 'w-full bg-green-600 text-white py-2 px-4 rounded-lg';
      createButton.textContent = 'Create Game';
      createButton.addEventListener('click', function() {
        if (!nameInput.value || !passwordInput.value) {
          showNotification('Please fill in all required fields','warning');
          return;
        }

        createGame({
          name: nameInput.value,
          adminPassword: passwordInput.value,
          maxTeams: 0, // Default to 0 teams, they will be added via QR scanning
        });
      });
      createForm.appendChild(createButton);

      container.appendChild(createForm);

      // Join link
      const joinLink = document.createElement('div');
      joinLink.className = 'text-center';

      const joinButton = document.createElement('button');
      joinButton.className = 'text-blue-600 underline';
      joinButton.textContent = 'Join Existing Game Instead';
      joinButton.addEventListener('click', toggleForm);
      joinLink.appendChild(joinButton);

      container.appendChild(joinLink);
    } else {
      // Join Game Form
      const joinForm = document.createElement('div');
      joinForm.className = 'bg-white rounded-lg shadow-md p-6 mb-6';

      const joinTitle = document.createElement('h3');
      joinTitle.className = 'text-xl font-semibold mb-4';
      joinTitle.textContent = 'Join Existing Game';
      joinForm.appendChild(joinTitle);

      // Game ID
      const idGroup = document.createElement('div');
      idGroup.className = 'mb-4';

      const idLabel = document.createElement('label');
      idLabel.className = 'block text-gray-700 mb-2';
      idLabel.textContent = 'Game ID';
      idGroup.appendChild(idLabel);

      const idInput = document.createElement('input');
      idInput.type = 'text';
      idInput.className = 'w-full px-3 py-2 border rounded-lg';
      idGroup.appendChild(idInput);

      joinForm.appendChild(idGroup);

      // Host Password
      const passwordGroup = document.createElement('div');
      passwordGroup.className = 'mb-4';

      const passwordLabel = document.createElement('label');
      passwordLabel.className = 'block text-gray-700 mb-2';
      passwordLabel.textContent = 'Host Password';
      passwordGroup.appendChild(passwordLabel);

      const passwordInput = document.createElement('input');
      passwordInput.type = 'password';
      passwordInput.className = 'w-full px-3 py-2 border rounded-lg';
      passwordGroup.appendChild(passwordInput);

      joinForm.appendChild(passwordGroup);

      // Join Button
      const joinButton = document.createElement('button');
      joinButton.className = 'w-full bg-blue-600 text-white py-2 px-4 rounded-lg';
      joinButton.textContent = 'Join Game';
      joinButton.addEventListener('click', function() {
        if (!idInput.value || !passwordInput.value) {
          showNotification('Please enter both Game ID and Host Password','warning');
          return;
        }

        fetchGameData(idInput.value);

        // Set admin password
        appState.gameData.adminPassword = passwordInput.value;
        appState.gameData.isAdmin = true;

        // Store admin password
        localStorage.setItem('adminPassword', passwordInput.value);
      });
      joinForm.appendChild(joinButton);

      container.appendChild(joinForm);

      // Create Game link
      const createLink = document.createElement('div');
      createLink.className = 'text-center';

      const createButton = document.createElement('button');
      createButton.className = 'text-blue-600 underline';
      createButton.textContent = 'Create New Game Instead';
      createButton.addEventListener('click', toggleForm);
      createLink.appendChild(createButton);

      container.appendChild(createLink);
    }

    // Back to Home link
    const backContainer = document.createElement('div');
    backContainer.className = 'text-center mt-6';

    const backButton = document.createElement('button');
    backButton.className = 'text-gray-600';
    backButton.textContent = 'Back to Home';
    backButton.addEventListener('click', function() { navigateTo('landing'); });
    backContainer.appendChild(backButton);

    container.appendChild(backContainer);

    return container;
  }

  // Game Management Panel (if game is loaded)
  container.className = 'max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6';

  const title = document.createElement('h2');
  title.className = 'text-2xl font-bold mb-6';
  title.textContent = 'Game Administration';
  container.appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'grid gap-6';

  // Game Info Section
  const infoSection = document.createElement('div');

  const infoTitle = document.createElement('h3');
  infoTitle.className = 'text-xl font-semibold mb-3';
  infoTitle.textContent = 'Game Info';
  infoSection.appendChild(infoTitle);

  const gameId = document.createElement('p');
  gameId.innerHTML = '<strong>Game ID: </strong>' + appState.gameData.id;
  infoSection.appendChild(gameId);

  const gameStatus = document.createElement('p');
  gameStatus.innerHTML = '<strong>Status: </strong>' + appState.gameData.status;
  infoSection.appendChild(gameStatus);

  grid.appendChild(infoSection);

  // QR Code Management Section
  const qrSection = document.createElement('div');

  const qrTitle = document.createElement('h3');
  qrTitle.className = 'text-xl font-semibold mb-3';
  qrTitle.textContent = 'QR Code Management';
  qrSection.appendChild(qrTitle);

  const qrDescription = document.createElement('p');
  qrDescription.className = 'text-gray-600 mb-4';
  qrDescription.textContent = 'Scan QR codes to add them as teams or bases for the game.';
  qrSection.appendChild(qrDescription);

  const scanQRButton = document.createElement('button');
  scanQRButton.className = 'w-full bg-blue-600 text-white py-2 px-4 rounded-lg flex items-center justify-center';

  const qrIcon = document.createElement('i');
  qrIcon.setAttribute('data-lucide', 'qr-code');
  qrIcon.className = 'mr-2';
  scanQRButton.appendChild(qrIcon);

  const buttonText = document.createElement('span');
  buttonText.textContent = 'Scan QR Code';
  scanQRButton.appendChild(buttonText);

  scanQRButton.addEventListener('click', function() {
    navigateTo('scanQR');
  });

  qrSection.appendChild(scanQRButton);
  
  // Add instruction text to emphasize the QR-first approach
  const instructionText = document.createElement('p');
  instructionText.className = 'text-amber-600 text-sm mt-2';
  instructionText.textContent = 'Note: Teams and bases can only be created by scanning QR codes first.';
  qrSection.appendChild(instructionText);
  
  grid.appendChild(qrSection);

  // Team Management Section
  const teamSection = document.createElement('div');

  const teamTitle = document.createElement('h3');
  teamTitle.className = 'text-xl font-semibold mb-3';
  teamTitle.textContent = 'Team Management';
  teamSection.appendChild(teamTitle);

  const teamTableContainer = document.createElement('div');
  teamTableContainer.className = 'overflow-auto max-h-60';

  const teamTable = document.createElement('table');
  teamTable.className = 'min-w-full divide-y divide-gray-200';

  // Table header
  const thead = document.createElement('thead');
  thead.className = 'bg-gray-50';

  const headerRow = document.createElement('tr');

  const headers = ['Team', 'Players', 'Score', 'Actions'];
  headers.forEach(function(headerText) {
    const th = document.createElement('th');
    th.className = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
    th.textContent = headerText;
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  teamTable.appendChild(thead);

  // Table body
  const tbody = document.createElement('tbody');
  tbody.className = 'bg-white divide-y divide-gray-200';

  if (appState.gameData.teams && appState.gameData.teams.length > 0) {
    appState.gameData.teams.forEach(function(team) {
      const row = document.createElement('tr');

      // Team name cell
      const nameCell = document.createElement('td');
      nameCell.className = 'px-6 py-4 whitespace-nowrap';

      const nameContainer = document.createElement('div');
      nameContainer.className = 'flex items-center';

      const colorDot = document.createElement('div');
      colorDot.className = 'w-3 h-3 rounded-full ' + team.color + ' mr-2';
      nameContainer.appendChild(colorDot);

      const name = document.createElement('span');
      name.textContent = team.name;
      nameContainer.appendChild(name);

      nameCell.appendChild(nameContainer);
      row.appendChild(nameCell);

      // Players count cell
      const playersCell = document.createElement('td');
      playersCell.className = 'px-6 py-4 whitespace-nowrap';
      playersCell.textContent = team.playerCount || 0;
      row.appendChild(playersCell);

      // Score cell
      const scoreCell = document.createElement('td');
      scoreCell.className = 'px-6 py-4 whitespace-nowrap';
      scoreCell.textContent = team.score || 0;
      row.appendChild(scoreCell);

      // Actions cell
      const actionsCell = document.createElement('td');
      actionsCell.className = 'px-6 py-4 whitespace-nowrap flex gap-2';

      // Edit button
      const editButton = document.createElement('button');
      editButton.className = 'text-blue-600 hover:text-blue-800';
      editButton.textContent = 'Edit';
      editButton.addEventListener('click', function() {
        renderTeamEditModal(team);
      });
      actionsCell.appendChild(editButton);

      row.appendChild(actionsCell);

      tbody.appendChild(row);
    });
  } else {
    // Show prompt to add teams when there are none
    const emptyRow = document.createElement('tr');
    const emptyCell = document.createElement('td');
    emptyCell.colSpan = 4;
    emptyCell.className = 'px-6 py-4 text-center text-gray-500';
    emptyCell.textContent = 'No teams available. Scan QR codes to add teams.';
    emptyRow.appendChild(emptyCell);
    tbody.appendChild(emptyRow);
  }

  teamTable.appendChild(tbody);
  teamTableContainer.appendChild(teamTable);
  teamSection.appendChild(teamTableContainer);

  grid.appendChild(teamSection);

  // Base Management Section
  const baseSection = document.createElement('div');

  const baseTitle = document.createElement('h3');
  baseTitle.className = 'text-xl font-semibold mb-3';
  baseTitle.textContent = 'Base Management';
  baseSection.appendChild(baseTitle);

  const baseTableContainer = document.createElement('div');
  baseTableContainer.className = 'overflow-auto max-h-60';

  const baseTable = document.createElement('table');
  baseTable.className = 'min-w-full divide-y divide-gray-200';

  // Table header
  const baseThead = document.createElement('thead');
  baseThead.className = 'bg-gray-50';

  const baseHeaderRow = document.createElement('tr');

  const baseHeaders = ['Base', 'Location', 'Current Owner'];
  baseHeaders.forEach(function(headerText) {
    const th = document.createElement('th');
    th.className = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
    th.textContent = headerText;
    baseHeaderRow.appendChild(th);
  });

  baseThead.appendChild(baseHeaderRow);
  baseTable.appendChild(baseThead);

  // Table body
  const baseTbody = document.createElement('tbody');
  baseTbody.className = 'bg-white divide-y divide-gray-200';

  if (appState.gameData.bases && appState.gameData.bases.length > 0) {
    appState.gameData.bases.forEach(function(base) {
      const row = document.createElement('tr');

      // Base name cell
      const nameCell = document.createElement('td');
      nameCell.className = 'px-6 py-4 whitespace-nowrap';
      nameCell.textContent = base.name;
      row.appendChild(nameCell);

      // Location cell
      const locationCell = document.createElement('td');
      locationCell.className = 'px-6 py-4 whitespace-nowrap';
      locationCell.textContent = base.lat.toFixed(6) + ', ' + base.lng.toFixed(6);
      row.appendChild(locationCell);

      // Owner cell
      const ownerCell = document.createElement('td');
      ownerCell.className = 'px-6 py-4 whitespace-nowrap';
      
      if (base.ownedBy) {
        const owningTeam = appState.gameData.teams.find(t => t.id === base.ownedBy);
        if (owningTeam) {
          const ownerContainer = document.createElement('div');
          ownerContainer.className = 'flex items-center';
          
          const colorDot = document.createElement('div');
          colorDot.className = 'w-3 h-3 rounded-full ' + owningTeam.color + ' mr-2';
          ownerContainer.appendChild(colorDot);
          
          const name = document.createElement('span');
          name.textContent = owningTeam.name;
          ownerContainer.appendChild(name);
          
          ownerCell.appendChild(ownerContainer);
        } else {
          ownerCell.textContent = 'Unknown Team';
        }
      } else {
        ownerCell.textContent = 'Uncaptured';
      }
      
      row.appendChild(ownerCell);

      baseTbody.appendChild(row);
    });
  } else {
    // Show prompt to add bases when there are none
    const emptyRow = document.createElement('tr');
    const emptyCell = document.createElement('td');
    emptyCell.colSpan = 3;
    emptyCell.className = 'px-6 py-4 text-center text-gray-500';
    emptyCell.textContent = 'No bases available. Scan QR codes to add bases.';
    emptyRow.appendChild(emptyCell);
    baseTbody.appendChild(emptyRow);
  }

  baseTable.appendChild(baseTbody);
  baseTableContainer.appendChild(baseTable);
  baseSection.appendChild(baseTableContainer);

  grid.appendChild(baseSection);

  // Game Control Section
  const controlSection = document.createElement('div');

  const controlTitle = document.createElement('h3');
  controlTitle.className = 'text-xl font-semibold mb-3';
  controlTitle.textContent = 'Game Control';
  controlSection.appendChild(controlTitle);

  const controlButtons = document.createElement('div');
  controlButtons.className = 'flex gap-4';

  // Show different buttons based on game status
  if (appState.gameData.status === 'active') {
    // Game is running - show only End Game button
    const endButton = document.createElement('button');
    endButton.className = 'flex-1 bg-red-600 text-white py-2 px-4 rounded-lg';
    endButton.textContent = 'End Game';
    endButton.addEventListener('click', function() {
      // Confirm before ending
      if (confirm('Are you sure you want to end the game? This will end the current game and release all QR codes for reuse.')) {
        endGame();
      }
    });
    controlButtons.appendChild(endButton);

  } else if (appState.gameData.status === 'setup') {
    // Game is in setup - show only Start Game button
    const startButton = document.createElement('button');
    startButton.className = 'flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg';
    
    // Disable button if fewer than 2 teams
    const hasEnoughTeams = appState.gameData.teams && appState.gameData.teams.length >= 2;
    startButton.disabled = !hasEnoughTeams;
    
    startButton.textContent = 'Start Game';
    if (!hasEnoughTeams) {
      startButton.title = 'At least 2 teams required to start game';
      startButton.className += ' opacity-50 cursor-not-allowed';
    }
    
    startButton.addEventListener('click', function() {
      // Double check team count before starting
      if (appState.gameData.teams && appState.gameData.teams.length >= 2) {
        startGame();
      } else {
        setError('Cannot start game. Please add at least 2 teams by scanning QR codes.');
      }
    });
    
    controlButtons.appendChild(startButton);
  } else if (appState.gameData.status === 'ended') {
    // Game is ended - show message
    const gameEndedMsg = document.createElement('div');
    gameEndedMsg.className = 'bg-gray-100 rounded-lg p-3 text-gray-600 mb-4';
    gameEndedMsg.textContent = 'This game has ended. QR codes have been released and can be reused in other games.';
    controlSection.appendChild(gameEndedMsg);
  }

  const exitButton = document.createElement('button');
  exitButton.className = 'flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg';
  exitButton.textContent = 'Exit Host Panel';
  exitButton.addEventListener('click', function() { navigateTo('landing'); });
  controlButtons.appendChild(exitButton);

  controlSection.appendChild(controlButtons);

  grid.appendChild(controlSection);

  container.appendChild(grid);

  return container;
}




function renderQRAssignmentPage() {
  const container = document.createElement('div');
  container.className = 'max-w-md mx-auto py-8';

  const qrId = sessionStorage.getItem('pendingQRCode');
  if (!qrId) {
    // No pending QR, show error and instruction
    const errorDiv = document.createElement('div');
    errorDiv.className = 'bg-amber-100 border border-amber-400 text-amber-700 px-4 py-3 rounded mb-4';
    errorDiv.textContent = 'No QR code found to assign. You must scan a QR code first.';
    container.appendChild(errorDiv);

    const instructionDiv = document.createElement('div');
    instructionDiv.className = 'bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-6';
    instructionDiv.innerHTML = '<p><strong>How to add teams or bases:</strong></p>' +
      '<ol class="list-decimal pl-5 mt-2">' +
      '<li>Return to the host panel</li>' +
      '<li>Click "Scan QR Code"</li>' +
      '<li>Scan a QR code to assign it</li>' +
      '<li>Follow the instructions to create a team or base</li>' +
      '</ol>';
    container.appendChild(instructionDiv);

    const backButton = document.createElement('button');
    backButton.className = 'mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full';
    backButton.textContent = 'Back to Host Panel';
    backButton.addEventListener('click', function() {
      navigateTo('hostPanel');
    });
    container.appendChild(backButton);

    return container;
  }

  // Title
  const title = document.createElement('h2');
  title.className = 'text-2xl font-bold mb-6 text-center';
  title.textContent = 'Assign QR Code';
  container.appendChild(title);

  // QR Code info
  const qrInfo = document.createElement('div');
  qrInfo.className = 'bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-6';
  qrInfo.textContent = `QR Code ID: ${qrId}`;
  qrInfo.id = 'qr-display';
  container.appendChild(qrInfo);

  // Options
  const options = document.createElement('div');
  options.className = 'flex flex-col gap-4';

  // Assign as Team button
  const teamButton = document.createElement('button');
  teamButton.className = 'bg-green-500 hover:bg-green-700 text-white font-bold py-4 px-6 rounded flex items-center justify-center';

  const teamIcon = document.createElement('i');
  teamIcon.setAttribute('data-lucide', 'users');
  teamIcon.className = 'mr-2';
  teamButton.appendChild(teamIcon);

  const teamText = document.createElement('span');
  teamText.textContent = 'Assign as Team';
  teamButton.appendChild(teamText);

  teamButton.addEventListener('click', function() {
    // Show team creation form
    renderTeamCreationForm(qrId, container);
  });
  options.appendChild(teamButton);

  // Assign as Base button
  const baseButton = document.createElement('button');
  baseButton.className = 'bg-purple-500 hover:bg-purple-700 text-white font-bold py-4 px-6 rounded flex items-center justify-center';

  const baseIcon = document.createElement('i');
  baseIcon.setAttribute('data-lucide', 'flag');
  baseIcon.className = 'mr-2';
  baseButton.appendChild(baseIcon);

  const baseText = document.createElement('span');
  baseText.textContent = 'Assign as Base';
  baseButton.appendChild(baseText);

  baseButton.addEventListener('click', function() {
    // Show base creation form
    renderBaseCreationForm(qrId, container);
  });
  options.appendChild(baseButton);

  container.appendChild(options);

  // Cancel button
  const cancelButton = document.createElement('button');
  cancelButton.className = 'mt-6 bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded w-full';
  cancelButton.textContent = 'Cancel';
  cancelButton.addEventListener('click', function() {
    sessionStorage.removeItem('pendingQRCode');
    navigateTo('hostPanel');
  });
  container.appendChild(cancelButton);

  return container;
}

// Render team creation form (replaces the assignment options)
function renderTeamCreationForm(qrId, container) {
  // Clear the container
  container.innerHTML = '';

  // Title
  const title = document.createElement('h2');
  title.className = 'text-2xl font-bold mb-6 text-center';
  title.textContent = 'Create New Team';
  container.appendChild(title);

  // QR Info reminder
  const qrInfo = document.createElement('div');
  qrInfo.className = 'bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-4';
  qrInfo.textContent = `Creating team from QR Code: ${qrId}`;
  container.appendChild(qrInfo);

  // Form
  const form = document.createElement('form');
  form.className = 'space-y-4';

  // Team name
  const nameGroup = document.createElement('div');

  const nameLabel = document.createElement('label');
  nameLabel.className = 'block text-gray-700 text-sm font-bold mb-2';
  nameLabel.htmlFor = 'team-name';
  nameLabel.textContent = 'Team Name';
  nameGroup.appendChild(nameLabel);

  const nameInput = document.createElement('input');
  nameInput.className = 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline';
  nameInput.id = 'team-name';
  nameInput.type = 'text';
  nameInput.placeholder = 'Enter team name';
  nameInput.required = true;
  nameGroup.appendChild(nameInput);

  form.appendChild(nameGroup);

  // Team color
  const colorGroup = document.createElement('div');

  const colorLabel = document.createElement('label');
  colorLabel.className = 'block text-gray-700 text-sm font-bold mb-2';
  colorLabel.htmlFor = 'team-color';
  colorLabel.textContent = 'Team Color';
  colorGroup.appendChild(colorLabel);

  const colorSelect = document.createElement('select');
  colorSelect.className = 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline';
  colorSelect.id = 'team-color';

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
    const option = document.createElement('option');
    option.value = color.value;
    option.textContent = color.label;
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
  const submitButton = document.createElement('button');
  submitButton.className = 'bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded w-full';
  submitButton.type = 'submit';
  submitButton.textContent = 'Create Team';
  form.appendChild(submitButton);

  // Handle form submission
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    createTeam(qrId, nameInput.value, colorSelect.value);
  });

  container.appendChild(form);

  // Cancel button
  const cancelButton = document.createElement('button');
  cancelButton.className = 'mt-4 bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded w-full';
  cancelButton.textContent = 'Cancel';
  cancelButton.addEventListener('click', function() {
    sessionStorage.removeItem('pendingQRCode');
    navigateTo('hostPanel');
  });
  container.appendChild(cancelButton);
}

// Function to display a modal for editing team details
function renderTeamEditModal(team) {
  // Create modal backdrop
  const modalBackdrop = document.createElement('div');
  modalBackdrop.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  document.body.appendChild(modalBackdrop);
  
  // Create modal container
  const modalContainer = document.createElement('div');
  modalContainer.className = 'bg-white rounded-lg shadow-xl p-6 w-full max-w-md';
  modalBackdrop.appendChild(modalContainer);
  
  // Modal title
  const modalTitle = document.createElement('h3');
  modalTitle.className = 'text-xl font-bold mb-4';
  modalTitle.textContent = 'Edit Team';
  modalContainer.appendChild(modalTitle);
  
  // Create form
  const form = document.createElement('form');
  form.className = 'space-y-4';
  modalContainer.appendChild(form);
  
  // Team name field
  const nameGroup = document.createElement('div');
  
  const nameLabel = document.createElement('label');
  nameLabel.className = 'block text-gray-700 text-sm font-bold mb-2';
  nameLabel.htmlFor = 'edit-team-name';
  nameLabel.textContent = 'Team Name';
  nameGroup.appendChild(nameLabel);
  
  const nameInput = document.createElement('input');
  nameInput.className = 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline';
  nameInput.id = 'edit-team-name';
  nameInput.type = 'text';
  nameInput.value = team.name;
  nameInput.required = true;
  nameGroup.appendChild(nameInput);
  
  form.appendChild(nameGroup);
  
  // Team color field
  const colorGroup = document.createElement('div');
  
  const colorLabel = document.createElement('label');
  colorLabel.className = 'block text-gray-700 text-sm font-bold mb-2';
  colorLabel.htmlFor = 'edit-team-color';
  colorLabel.textContent = 'Team Color';
  colorGroup.appendChild(colorLabel);
  
  const colorSelect = document.createElement('select');
  colorSelect.className = 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline';
  colorSelect.id = 'edit-team-color';
  
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
    const option = document.createElement('option');
    option.value = color.value;
    option.textContent = color.label;
    if (color.value === team.color) {
      option.selected = true;
    }
    colorSelect.appendChild(option);
  });
  
  colorGroup.appendChild(colorSelect);
  form.appendChild(colorGroup);
  
  // Action buttons
  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'flex gap-4 mt-6';
  
  const cancelButton = document.createElement('button');
  cancelButton.className = 'flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600';
  cancelButton.textContent = 'Cancel';
  cancelButton.type = 'button';
  cancelButton.addEventListener('click', function() {
    document.body.removeChild(modalBackdrop);
  });
  buttonGroup.appendChild(cancelButton);
  
  const saveButton = document.createElement('button');
  saveButton.className = 'flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600';
  saveButton.textContent = 'Save Changes';
  saveButton.type = 'submit';
  buttonGroup.appendChild(saveButton);
  
  form.appendChild(buttonGroup);
  
  // Handle form submission
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    updateTeam(team.id, nameInput.value, colorSelect.value);
    document.body.removeChild(modalBackdrop);
  });
}

// Render base creation form
function renderBaseCreationForm(qrId, container) {
  // Clear the container
  container.innerHTML = '';

  // Title
  const title = document.createElement('h2');
  title.className = 'text-2xl font-bold mb-6 text-center';
  title.textContent = 'Create New Base';
  container.appendChild(title);

  // QR Info reminder
  const qrInfo = document.createElement('div');
  qrInfo.className = 'bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-4';
  qrInfo.textContent = `Creating base from QR Code: ${qrId}`;
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
  const form = document.createElement('form');
  form.className = 'space-y-4';

  // Base name
  const nameGroup = document.createElement('div');

  const nameLabel = document.createElement('label');
  nameLabel.className = 'block text-gray-700 text-sm font-bold mb-2';
  nameLabel.htmlFor = 'base-name';
  nameLabel.textContent = 'Base Name';
  nameGroup.appendChild(nameLabel);

  const nameInput = document.createElement('input');
  nameInput.className = 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline';
  nameInput.id = 'base-name';
  nameInput.type = 'text';
  nameInput.placeholder = 'Enter base name';
  nameInput.value = defaultBaseName;
  nameInput.required = true;
  nameGroup.appendChild(nameInput);

  form.appendChild(nameGroup);

  // Location section
  const locationGroup = document.createElement('div');

  const locationLabel = document.createElement('div');
  locationLabel.className = 'block text-gray-700 text-sm font-bold mb-2';
  locationLabel.textContent = 'Base Location';
  locationGroup.appendChild(locationLabel);

  // Current location display
  const locationDisplay = document.createElement('div');
  locationDisplay.className = 'mb-4 p-3 bg-gray-100 rounded flex justify-between items-center';
  locationDisplay.id = 'location-display';
  
  const locationText = document.createElement('span');
  locationText.id = 'location-text';
  locationText.textContent = 'No location data yet. Click "Get Current Location" button.';
  locationDisplay.appendChild(locationText);
  
  // Add accuracy indicator
  const accuracyBadge = document.createElement('span');
  accuracyBadge.id = 'accuracy-badge';
  accuracyBadge.className = 'hidden px-2 py-1 text-xs rounded-full';
  locationDisplay.appendChild(accuracyBadge);
  
  locationGroup.appendChild(locationDisplay);

  // Map container for location preview
  const mapPreviewContainer = document.createElement('div');
  mapPreviewContainer.id = 'base-location-map';
  mapPreviewContainer.className = 'h-48 bg-gray-200 rounded mb-4 hidden';
  locationGroup.appendChild(mapPreviewContainer);

  // Get location button group
  const locationButtonGroup = document.createElement('div');
  locationButtonGroup.className = 'flex gap-2';

  // Get location button
  const getLocationBtn = document.createElement('button');
  getLocationBtn.className = 'flex-1 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded';
  getLocationBtn.type = 'button';
  getLocationBtn.innerHTML = '<i data-lucide="navigation" class="inline mr-1"></i> Get Current Location';

  // Button for high accuracy mode
  const highAccuracyBtn = document.createElement('button');
  highAccuracyBtn.className = 'bg-amber-500 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded';
  highAccuracyBtn.type = 'button';
  highAccuracyBtn.id = 'high-accuracy-toggle';
  highAccuracyBtn.innerHTML = '<i data-lucide="crosshair" class="inline mr-1"></i>';
  highAccuracyBtn.title = 'Toggle High Accuracy Mode';
  
  // Add to button group
  locationButtonGroup.appendChild(getLocationBtn);
  locationButtonGroup.appendChild(highAccuracyBtn);
  locationGroup.appendChild(locationButtonGroup);

  // Hidden fields for location data
  const latInput = document.createElement('input');
  latInput.type = 'hidden';
  latInput.id = 'latitude';
  latInput.name = 'latitude';

  const lngInput = document.createElement('input');
  lngInput.type = 'hidden';
  lngInput.id = 'longitude';
  lngInput.name = 'longitude';
  
  // New hidden field for accuracy
  const accuracyInput = document.createElement('input');
  accuracyInput.type = 'hidden';
  accuracyInput.id = 'accuracy';
  accuracyInput.name = 'accuracy';

  // Location watch ID storage
  const watchIdInput = document.createElement('input');
  watchIdInput.type = 'hidden';
  watchIdInput.id = 'location-watch-id';

  // Add all hidden inputs
  locationGroup.appendChild(latInput);
  locationGroup.appendChild(lngInput);
  locationGroup.appendChild(accuracyInput);
  locationGroup.appendChild(watchIdInput);

  // High accuracy mode state
  let highAccuracyMode = true;
  
  // Initialize high accuracy button state
  highAccuracyBtn.classList.add('bg-green-500', 'hover:bg-green-700');
  highAccuracyBtn.innerHTML = '<i data-lucide="crosshair" class="inline mr-1"></i> High Accuracy: ON';
  
  // Toggle high accuracy mode
  highAccuracyBtn.addEventListener('click', function(e) {
    e.preventDefault();
    highAccuracyMode = !highAccuracyMode;
    
    if (highAccuracyMode) {
      highAccuracyBtn.classList.remove('bg-amber-500', 'hover:bg-amber-700');
      highAccuracyBtn.classList.add('bg-green-500', 'hover:bg-green-700');
      highAccuracyBtn.innerHTML = '<i data-lucide="crosshair" class="inline mr-1"></i> High Accuracy: ON';
    } else {
      highAccuracyBtn.classList.remove('bg-green-500', 'hover:bg-green-700');
      highAccuracyBtn.classList.add('bg-amber-500', 'hover:bg-amber-700');
      highAccuracyBtn.innerHTML = '<i data-lucide="crosshair" class="inline mr-1"></i> High Accuracy: OFF';
    }
    
    // If we're currently watching location, restart with new settings
    const watchId = document.getElementById('location-watch-id').value;
    if (watchId) {
      navigator.geolocation.clearWatch(parseInt(watchId));
      startLocationTracking();
    }
    
    // Initialize Lucide icons
    if (window.lucide) window.lucide.createIcons();
  });

  // Map instance for preview
  let baseLocationMap = null;
  let locationMarker = null;
  
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
    } else {
      // Just pan to the new location
      baseLocationMap.setView([lat, lng], 18);
    }
    
    // Update or create the marker
    if (locationMarker) {
      locationMarker.setLatLng([lat, lng]);
    } else {
      locationMarker = L.marker([lat, lng]).addTo(baseLocationMap);
    }
    
    // Remove previous accuracy circle if it exists
    if (window.accuracyCircle) {
      baseLocationMap.removeLayer(window.accuracyCircle);
    }

    // Add accuracy circle if available
    const accuracy = parseFloat(document.getElementById('accuracy').value);
    if (accuracy && !isNaN(accuracy)) {
      // Add new accuracy circle
      window.accuracyCircle = L.circle([lat, lng], {
        radius: accuracy,
        color: 'blue',
        fillColor: '#3388ff',
        fillOpacity: 0.1,
        weight: 1
      }).addTo(baseLocationMap);
    }
  }
  
  // Format the accuracy display
  function updateAccuracyDisplay(accuracy) {
    const accuracyBadge = document.getElementById('accuracy-badge');
    
    if (!accuracyBadge) return;
    
    accuracyBadge.classList.remove('hidden', 'bg-red-500', 'bg-amber-500', 'bg-green-500');
    
    if (accuracy <= 5) {
      // Excellent accuracy (< 5m)
      accuracyBadge.classList.add('bg-green-500');
      accuracyBadge.textContent = `±${accuracy.toFixed(1)}m (Excellent)`;
    } else if (accuracy <= 15) {
      // Good accuracy (5-15m)
      accuracyBadge.classList.add('bg-amber-500');
      accuracyBadge.textContent = `±${accuracy.toFixed(1)}m (Good)`;
    } else {
      // Poor accuracy (>15m)
      accuracyBadge.classList.add('bg-red-500');
      accuracyBadge.textContent = `±${accuracy.toFixed(1)}m (Poor)`;
    }
    
    accuracyBadge.classList.remove('hidden');
  }

  // Function to start continuous location tracking
  function startLocationTracking() {
    if (!navigator.geolocation) {
      showNotification('Geolocation is not supported by this browser.', 'error');
      return;
    }
    
    // Update button state
    getLocationBtn.disabled = true;
    getLocationBtn.innerHTML = '<i data-lucide="loader-2" class="inline mr-1 animate-spin"></i> Getting location...';
    
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
      
      // Update display
      document.getElementById('location-text').textContent = 
        `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`;
      
      // Update accuracy display
      updateAccuracyDisplay(accuracy);
      
      // Update hidden inputs
      document.getElementById('latitude').value = latitude;
      document.getElementById('longitude').value = longitude;
      document.getElementById('accuracy').value = accuracy;
      
      // Update location display styling based on accuracy
      const locationDisplay = document.getElementById('location-display');
      locationDisplay.className = 'mb-4 p-3 rounded flex justify-between items-center';
      
      if (accuracy <= 10) {
        locationDisplay.classList.add('bg-green-100', 'text-green-800');
      } else if (accuracy <= 30) {
        locationDisplay.classList.add('bg-amber-100', 'text-amber-800');
      } else {
        locationDisplay.classList.add('bg-red-100', 'text-red-800');
      }
      
      // Initialize or update map
      initBaseLocationMap(latitude, longitude);
      
      // Update button state
      getLocationBtn.disabled = false;
      getLocationBtn.innerHTML = '<i data-lucide="navigation" class="inline mr-1"></i> Update Location';
      
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
      
      document.getElementById('location-text').textContent = errorMessage;
      document.getElementById('location-display').className = 
        'mb-4 p-3 bg-red-100 text-red-800 rounded flex justify-between items-center';
      
      // Update button state
      getLocationBtn.disabled = false;
      getLocationBtn.textContent = 'Try Again';
      
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
  const submitButton = document.createElement('button');
  submitButton.className = 'bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded w-full mt-6';
  submitButton.type = 'submit';
  submitButton.textContent = 'Create Base';
  form.appendChild(submitButton);

  // Handle form submission
  form.addEventListener('submit', function(e) {
    e.preventDefault();

    if (!latInput.value || !lngInput.value) {
      setError('Please get the location for this base first.');
      return;
    }
    
    // Get accuracy and warn if it's poor
    const accuracy = parseFloat(accuracyInput.value);
    if (accuracy > 20) {
      const confirmPoor = confirm(`Warning: GPS accuracy is poor (±${accuracy.toFixed(1)}m). This may affect gameplay. Do you still want to create this base?`);
      if (!confirmPoor) {
        return;
      }
    }

    // Clear any location watch
    const watchId = document.getElementById('location-watch-id').value;
    if (watchId) {
      navigator.geolocation.clearWatch(parseInt(watchId));
    }

    createBase(qrId, nameInput.value, parseFloat(latInput.value), parseFloat(lngInput.value));
  });

  container.appendChild(form);

  // Cancel button
  const cancelButton = document.createElement('button');
  cancelButton.className = 'mt-4 bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded w-full';
  cancelButton.textContent = 'Cancel';
  cancelButton.addEventListener('click', function() {
    // Clear any location watch
    const watchId = document.getElementById('location-watch-id').value;
    if (watchId) {
      navigator.geolocation.clearWatch(parseInt(watchId));
    }
    
    sessionStorage.removeItem('pendingQRCode');
    navigateTo('hostPanel');
  });
  container.appendChild(cancelButton);

  // Initialize Lucide icons
  if (window.lucide) window.lucide.createIcons();

  return container;
}

// Player Registration Page - New page for players to register when joining a team
function renderPlayerRegistrationPage() {
  const container = document.createElement('div');
  container.className = 'max-w-md mx-auto py-8';

  const teamId = sessionStorage.getItem('pendingTeamId');
  if (!teamId) {
    // No pending team, show error
    const errorDiv = document.createElement('div');
    errorDiv.className = 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded';
    errorDiv.textContent = 'No team selected. Please scan a team QR code.';
    container.appendChild(errorDiv);

    const backButton = document.createElement('button');
    backButton.className = 'mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded';
    backButton.textContent = 'Back to Home';
    backButton.addEventListener('click', function() {
      navigateTo('landing');
    });
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
  const title = document.createElement('h2');
  title.className = 'text-2xl font-bold mb-6 text-center';
  title.textContent = 'Join Team';
  container.appendChild(title);

  // Team info
  const teamInfo = document.createElement('div');
  teamInfo.className = `${teamColor} text-white px-6 py-4 rounded-lg text-center mb-6`;
  teamInfo.textContent = `You are joining: ${teamName}`;
  container.appendChild(teamInfo);

  // Player name form
  const form = document.createElement('form');
  form.className = 'space-y-4';

  const nameGroup = document.createElement('div');

  const nameLabel = document.createElement('label');
  nameLabel.className = 'block text-gray-700 text-sm font-bold mb-2';
  nameLabel.htmlFor = 'player-name';
  nameLabel.textContent = 'Your Name';
  nameGroup.appendChild(nameLabel);

  const nameInput = document.createElement('input');
  nameInput.className = 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline';
  nameInput.id = 'player-name';
  nameInput.type = 'text';
  nameInput.placeholder = 'Enter your name';
  nameGroup.appendChild(nameInput);

  form.appendChild(nameGroup);

  // Submit button
  const submitButton = document.createElement('button');
  submitButton.className = 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full';
  submitButton.type = 'submit';
  submitButton.textContent = 'Join Team';
  form.appendChild(submitButton);

  // Handle form submission
  form.addEventListener('submit', function(e) {
    e.preventDefault();

    // Get player name (optional)
    const playerName = nameInput.value.trim() || 'Anonymous Player';

    // Join the team
    joinTeam(teamId);

    // Clear pending team
    sessionStorage.removeItem('pendingTeamId');
  });

  container.appendChild(form);

  // Cancel button
  const cancelButton = document.createElement('button');
  cancelButton.className = 'mt-4 bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded w-full';
  cancelButton.textContent = 'Cancel';
  cancelButton.addEventListener('click', function() {
    sessionStorage.removeItem('pendingTeamId');
    navigateTo('landing');
  });
  container.appendChild(cancelButton);

  return container;
}

// First-Time User Page - New page for users who scan a QR code but aren't in a game
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
  joinButton.addEventListener('click', function() {
    // Store QR code in session storage for later use
    sessionStorage.setItem('pendingQRCode', appState.pendingQRCode);
    navigateTo('joinGame');
  });
  optionsContainer.appendChild(joinButton);

  // Create new game (host)
  const createButton = document.createElement('button');
  createButton.className = 'bg-green-600 text-white py-3 px-6 rounded-lg shadow-md hover:bg-green-700';
  createButton.textContent = 'Create a New Game';
  createButton.addEventListener('click', function() {
    // Store QR code in session storage for later use
    sessionStorage.setItem('pendingQRCode', appState.pendingQRCode);
    navigateTo('hostPanel');
  });
  optionsContainer.appendChild(createButton);

  container.appendChild(optionsContainer);

  return container;
}

// Join Game Page - For joining an existing game
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

// Results Page
function renderResultsPage() {
  const container = document.createElement('div');
  container.className = 'text-center py-10';

  // Find the winner (team with highest score)
  let winner = { name: 'No Team', score: 0, color: 'bg-gray-500' };

  if (appState.gameData.teams && appState.gameData.teams.length > 0) {
    winner = appState.gameData.teams.reduce(function(prev, current) {
      return (prev.score || 0) > (current.score || 0) ? prev : current;
    }, appState.gameData.teams[0]);
  }

  // Title
  const title = document.createElement('h2');
  title.className = 'text-3xl font-bold mb-8';
  title.textContent = 'Game Results';
  container.appendChild(title);

  // Winner section
  const winnerSection = document.createElement('div');
  winnerSection.className = 'mb-10';

  const trophyContainer = document.createElement('div');
  trophyContainer.className = 'inline-block p-6 rounded-full ' + winner.color + ' text-white mb-4';

  const trophy = document.createElement('span');
  trophy.className = 'text-3xl';
  trophy.textContent = '🏆';
  trophyContainer.appendChild(trophy);

  winnerSection.appendChild(trophyContainer);

  const winnerName = document.createElement('h3');
  winnerName.className = 'text-2xl font-bold';
  winnerName.textContent = winner.name + ' Wins!';
  winnerSection.appendChild(winnerName);

  const winnerScore = document.createElement('p');
  winnerScore.className = 'text-xl';
  winnerScore.textContent = (winner.score || 0) + ' points';
  winnerSection.appendChild(winnerScore);

  container.appendChild(winnerSection);

  // Final scores section
  const scoresSection = document.createElement('div');
  scoresSection.className = 'max-w-md mx-auto bg-white rounded-lg shadow-md p-6 mb-8';

  const scoresTitle = document.createElement('h3');
  scoresTitle.className = 'text-xl font-semibold mb-4';
  scoresTitle.textContent = 'Final Scores';
  scoresSection.appendChild(scoresTitle);

  if (appState.gameData.teams && appState.gameData.teams.length > 0) {
    // Sort teams by score (descending)
    const sortedTeams = [].concat(appState.gameData.teams).sort(function(a, b) {
      return (b.score || 0) - (a.score || 0);
    });

    sortedTeams.forEach(function(team, index) {
      const teamRow = document.createElement('div');
      teamRow.className = 'flex justify-between py-2 border-b last:border-b-0';

      const teamNameContainer = document.createElement('div');
      teamNameContainer.className = 'flex items-center';

      const rank = document.createElement('span');
      rank.className = 'font-bold mr-2';
      rank.textContent = '#' + (index + 1);
      teamNameContainer.appendChild(rank);

      const teamColor = document.createElement('div');
      teamColor.className = 'w-3 h-3 rounded-full ' + team.color + ' mr-2';
      teamNameContainer.appendChild(teamColor);

      const teamName = document.createElement('span');
      teamName.textContent = team.name;
      teamNameContainer.appendChild(teamName);

      teamRow.appendChild(teamNameContainer);

      const teamScore = document.createElement('span');
      teamScore.className = 'font-bold';
      teamScore.textContent = (team.score || 0) + ' pts';
      teamRow.appendChild(teamScore);

      scoresSection.appendChild(teamRow);
    });
  } else {
    const noTeams = document.createElement('p');
    noTeams.className = 'text-center text-gray-600';
    noTeams.textContent = 'No teams available';
    scoresSection.appendChild(noTeams);
  }

  container.appendChild(scoresSection);

  // Action buttons
  const actionsContainer = document.createElement('div');
  actionsContainer.className = 'flex flex-col space-y-4 max-w-xs mx-auto';

  const homeButton = document.createElement('button');
  homeButton.className = 'bg-blue-600 text-white py-3 px-6 rounded-lg shadow-md hover:bg-blue-700';
  homeButton.textContent = 'Back to Home';
  homeButton.addEventListener('click', function() { navigateTo('landing'); });
  actionsContainer.appendChild(homeButton);

  const newGameButton = document.createElement('button');
  newGameButton.className = 'bg-gray-600 text-white py-2 px-6 rounded-lg shadow-md hover:bg-gray-700';
  newGameButton.textContent = 'New Game';
  newGameButton.addEventListener('click', clearGameData);
  actionsContainer.appendChild(newGameButton);

  container.appendChild(actionsContainer);

  return container;
}