// Replace the placeholder functions with actual IndexedDB operations
// Handle background sync for offline captures
self.addEventListener('sync', event => {
  if (event.tag === 'sync-captures') {
    event.waitUntil(syncPendingCaptures());
  }
});

// Function to sync pending captures when online
async function syncPendingCaptures() {
  try {
    // Open IndexedDB directly from the service worker
    const db = await openDatabase();
    
    // Get pending captures from IndexedDB
    const pendingCaptures = await getPendingCaptures(db);
    
    // Process each pending capture
    const syncPromises = pendingCaptures.map(async (capture) => {
      try {
        const response = await fetch(`/api/bases/${capture.baseId}/capture`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            player_id: capture.playerId,
            latitude: capture.latitude,
            longitude: capture.longitude
          })
        });
        
        if (response.ok) {
          // Remove from pending queue if successful
          return removePendingCapture(db, capture.id);
        }
      } catch (error) {
        console.error('Sync failed for capture:', capture.id, error);
        // Leave in queue for next sync attempt
      }
    });
    
    await Promise.all(syncPromises);
    
    // Close the database connection
    db.close();
    
  } catch (error) {
    console.error('Error in syncPendingCaptures:', error);
  }
}

// Open the IndexedDB database
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('qr-conquest-db', 1);
    
    request.onerror = event => {
      reject('Could not open IndexedDB');
    };
    
    request.onsuccess = event => {
      resolve(event.target.result);
    };
    
    request.onupgradeneeded = event => {
      const db = event.target.result;
      
      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains('pendingCaptures')) {
        const captureStore = db.createObjectStore('pendingCaptures', { keyPath: 'id', autoIncrement: true });
        captureStore.createIndex('baseId', 'baseId', { unique: false });
        captureStore.createIndex('playerId', 'playerId', { unique: false });
      }
    };
  });
}

// Get pending captures from IndexedDB
function getPendingCaptures(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingCaptures'], 'readonly');
    const store = transaction.objectStore('pendingCaptures');
    const request = store.getAll();
    
    request.onsuccess = event => {
      resolve(event.target.result);
    };
    
    request.onerror = event => {
      reject('Error getting pending captures');
    };
  });
}

// Remove a pending capture from IndexedDB
function removePendingCapture(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingCaptures'], 'readwrite');
    const store = transaction.objectStore('pendingCaptures');
    const request = store.delete(id);
    
    request.onsuccess = event => {
      resolve();
    };
    
    request.onerror = event => {
      reject('Error removing pending capture');
    };
  });
}