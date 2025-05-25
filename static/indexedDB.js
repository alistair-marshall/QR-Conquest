// IndexedDB setup for offline support
const DB_NAME = 'qr-conquest-db';
const DB_VERSION = 1;
let db;

// Initialize IndexedDB
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = event => {
      console.error('IndexedDB error:', event.target.error);
      reject('Could not open IndexedDB');
    };
    
    request.onsuccess = event => {
      db = event.target.result;
      console.log('IndexedDB initialized successfully');
      resolve(db);
    };
    
    request.onupgradeneeded = event => {
      const db = event.target.result;
      
      // Create object stores
      
      // For storing pending base captures when offline
      if (!db.objectStoreNames.contains('pendingCaptures')) {
        const captureStore = db.createObjectStore('pendingCaptures', { keyPath: 'id', autoIncrement: true });
        captureStore.createIndex('baseId', 'baseId', { unique: false });
        captureStore.createIndex('playerId', 'playerId', { unique: false });
      }
      
      // For caching game data
      if (!db.objectStoreNames.contains('gameData')) {
        db.createObjectStore('gameData', { keyPath: 'id' });
      }
      
      // For caching team data
      if (!db.objectStoreNames.contains('teams')) {
        const teamStore = db.createObjectStore('teams', { keyPath: 'id' });
        teamStore.createIndex('gameId', 'gameId', { unique: false });
      }
      
      // For caching base data
      if (!db.objectStoreNames.contains('bases')) {
        const baseStore = db.createObjectStore('bases', { keyPath: 'id' });
        baseStore.createIndex('gameId', 'gameId', { unique: false });
        baseStore.createIndex('qrCode', 'qrCode', { unique: true });
      }
    };
  });
}

// Function to add a pending capture when offline
function addPendingCapture(baseId, playerId, latitude, longitude) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject('Database not initialized');
      return;
    }
    
    const transaction = db.transaction(['pendingCaptures'], 'readwrite');
    const store = transaction.objectStore('pendingCaptures');
    
    const capture = {
      baseId,
      playerId,
      latitude,
      longitude,
      timestamp: Date.now()
    };
    
    const request = store.add(capture);
    
    request.onsuccess = event => {
      console.log('Pending capture added to queue');
      
      // Try to register a sync if service worker is available
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        navigator.serviceWorker.ready
          .then(registration => registration.sync.register('sync-captures'))
          .catch(err => console.error('Background sync registration failed:', err));
      }
      
      resolve(event.target.result);
    };
    
    request.onerror = event => {
      console.error('Error adding pending capture:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Function to get pending captures
function getPendingCaptures() {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject('Database not initialized');
      return;
    }
    
    const transaction = db.transaction(['pendingCaptures'], 'readonly');
    const store = transaction.objectStore('pendingCaptures');
    const request = store.getAll();
    
    request.onsuccess = event => {
      resolve(event.target.result);
    };
    
    request.onerror = event => {
      console.error('Error getting pending captures:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Function to remove a pending capture after it's synced
function removePendingCapture(id) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject('Database not initialized');
      return;
    }
    
    const transaction = db.transaction(['pendingCaptures'], 'readwrite');
    const store = transaction.objectStore('pendingCaptures');
    const request = store.delete(id);
    
    request.onsuccess = event => {
      console.log('Pending capture removed from queue');
      resolve();
    };
    
    request.onerror = event => {
      console.error('Error removing pending capture:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Cache game data for offline use
function cacheGameData(gameData) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject('Database not initialized');
      return;
    }
    
    const transaction = db.transaction(['gameData', 'teams', 'bases'], 'readwrite');
    
    // Save game data
    const gameStore = transaction.objectStore('gameData');
    gameStore.put({
      id: gameData.id,
      name: gameData.name,
      status: gameData.status,
      hostName: gameData.hostName,
      lastUpdated: Date.now()
    });
    
    // Save teams
    const teamStore = transaction.objectStore('teams');
    if (gameData.teams && gameData.teams.length > 0) {
      gameData.teams.forEach(team => {
        teamStore.put({
          ...team,
          gameId: gameData.id,
          lastUpdated: Date.now()
        });
      });
    }
    
    // Save bases
    const baseStore = transaction.objectStore('bases');
    if (gameData.bases && gameData.bases.length > 0) {
      gameData.bases.forEach(base => {
        baseStore.put({
          ...base,
          gameId: gameData.id,
          lastUpdated: Date.now()
        });
      });
    }
    
    transaction.oncomplete = event => {
      console.log('Game data cached successfully');
      resolve();
    };
    
    transaction.onerror = event => {
      console.error('Error caching game data:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Load cached game data when offline
function loadCachedGameData(gameId) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject('Database not initialized');
      return;
    }
    
    const transaction = db.transaction(['gameData', 'teams', 'bases'], 'readonly');
    
    // Load game data
    const gameStore = transaction.objectStore('gameData');
    const gameRequest = gameStore.get(gameId);
    
    let gameData = null;
    let teams = [];
    let bases = [];
    
    gameRequest.onsuccess = event => {
      gameData = event.target.result;
      if (!gameData) {
        reject('No cached game data found');
        return;
      }
    };
    
    // Load teams
    const teamStore = transaction.objectStore('teams');
    const teamIndex = teamStore.index('gameId');
    const teamRequest = teamIndex.getAll(gameId);
    
    teamRequest.onsuccess = event => {
      teams = event.target.result;
    };
    
    // Load bases
    const baseStore = transaction.objectStore('bases');
    const baseIndex = baseStore.index('gameId');
    const baseRequest = baseIndex.getAll(gameId);
    
    baseRequest.onsuccess = event => {
      bases = event.target.result;
    };
    
    transaction.oncomplete = event => {
      if (!gameData) {
        reject('No cached game data found');
        return;
      }
      
      // Combine the data
      gameData.teams = teams;
      gameData.bases = bases;
      
      console.log('Loaded cached game data');
      resolve(gameData);
    };
    
    transaction.onerror = event => {
      console.error('Error loading cached game data:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Check QR code assignments in the cache
function checkCachedQRCodeAssignment(qrId) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject('Database not initialized');
      return;
    }
    
    // First check if it's a base QR code
    const baseTransaction = db.transaction(['bases'], 'readonly');
    const baseStore = baseTransaction.objectStore('bases');
    const baseIndex = baseStore.index('qrCode');
    const baseRequest = baseIndex.get(qrId);
    
    baseRequest.onsuccess = event => {
      const base = event.target.result;
      if (base) {
        resolve({
          status: 'base',
          base_id: base.id,
          game_id: base.gameId
        });
        return;
      }
      
      // TODO: Add check for team QR codes if you add a qrCode field to teams
      
      // If not found in cache
      resolve({ status: 'unknown' });
    };
    
    baseTransaction.onerror = event => {
      console.error('Error checking cached QR code:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Initialize the database when the script loads
initDB().catch(err => console.error('Failed to initialize IndexedDB:', err));

// Export functions for global use
window.dbHelpers = {
  addPendingCapture,
  getPendingCaptures,
  removePendingCapture,
  cacheGameData,
  loadCachedGameData,
  checkCachedQRCodeAssignment
};