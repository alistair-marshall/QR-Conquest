// Dev-only GPS simulator. Only activates on localhost — in production this
// file is inert. Replaces navigator.geolocation with a fake position that can
// be moved via an on-screen panel, arrow buttons, or right-clicking the map.
// Also provides a "simulate QR scan" box (a real scan is equivalent to
// handleQRCode(text), which is what the camera path calls after decoding).
(function () {
  'use strict';

  const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (!isLocal) return;

  const STORAGE_KEY = 'devgps-position';

  // Default position: middle of a generic park. Everything in the game is
  // relative to wherever bases get created, so the absolute value is arbitrary.
  let position = { lat: 51.5073, lng: -0.1657 };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved.lat === 'number' && typeof saved.lng === 'number') {
      position = saved;
    }
  } catch (e) { /* corrupt value — keep default */ }

  let nextWatchId = 1;
  const watchers = new Map();

  function makePosition() {
    return {
      coords: {
        latitude: position.lat,
        longitude: position.lng,
        accuracy: 5,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null
      },
      timestamp: Date.now()
    };
  }

  function notifyWatchers() {
    const pos = makePosition();
    watchers.forEach(cb => {
      try { cb(pos); } catch (e) { console.error('devGPS watcher error:', e); }
    });
  }

  function setPosition(lat, lng) {
    position = { lat, lng };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
    updatePanel();
    notifyWatchers();
  }

  // Nudge by metres (positive north = up, positive east = right)
  function nudge(northM, eastM) {
    const lat = position.lat + northM / 111320;
    const lng = position.lng + eastM / (111320 * Math.cos(position.lat * Math.PI / 180));
    setPosition(lat, lng);
  }

  const mockGeolocation = {
    getCurrentPosition(success, error, options) {
      setTimeout(() => success(makePosition()), 30);
    },
    watchPosition(success, error, options) {
      const id = nextWatchId++;
      watchers.set(id, success);
      setTimeout(() => success(makePosition()), 30);
      return id;
    },
    clearWatch(id) {
      watchers.delete(id);
    }
  };

  Object.defineProperty(navigator, 'geolocation', {
    value: mockGeolocation,
    configurable: true
  });

  // Expose for console use: devGPS.set(lat, lng), devGPS.get(), devGPS.nudge(n, e)
  window.devGPS = {
    set: setPosition,
    get: () => ({ ...position }),
    nudge: nudge
  };

  // --- On-screen control panel ------------------------------------------

  let coordsEl = null;

  function updatePanel() {
    if (coordsEl) {
      coordsEl.textContent = position.lat.toFixed(6) + ', ' + position.lng.toFixed(6);
    }
  }

  function buildPanel() {
    const panel = document.createElement('div');
    panel.id = 'devgps-panel';
    panel.style.cssText =
      'position:fixed;bottom:8px;left:8px;z-index:99999;background:rgba(17,24,39,.92);' +
      'color:#e5e7eb;font:12px/1.4 monospace;padding:8px;border-radius:8px;' +
      'box-shadow:0 2px 8px rgba(0,0,0,.4);min-width:215px;';

    const stepSelect = '<select id="devgps-step" style="background:#374151;border-radius:4px;padding:1px 2px;">' +
      '<option value="5">5 m</option><option value="25" selected>25 m</option>' +
      '<option value="100">100 m</option><option value="500">500 m</option></select>';

    const btn = 'background:#374151;border-radius:4px;width:28px;height:24px;cursor:pointer;';

    panel.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
        '<strong>DEV GPS</strong><span id="devgps-toggle" style="cursor:pointer;">[hide]</span></div>' +
      '<div id="devgps-body">' +
        '<div id="devgps-coords" style="margin-bottom:6px;"></div>' +
        '<div style="display:flex;gap:10px;align-items:center;margin-bottom:6px;">' +
          '<div style="display:grid;grid-template-columns:repeat(3,28px);gap:2px;">' +
            '<span></span><button id="devgps-n" style="' + btn + '">▲</button><span></span>' +
            '<button id="devgps-w" style="' + btn + '">◀</button><span></span>' +
            '<button id="devgps-e" style="' + btn + '">▶</button>' +
            '<span></span><button id="devgps-s" style="' + btn + '">▼</button><span></span>' +
          '</div>' +
          '<div>step<br>' + stepSelect + '</div>' +
        '</div>' +
        '<div style="margin-bottom:6px;">right-click map to teleport</div>' +
        '<div style="display:flex;gap:4px;">' +
          '<input id="devgps-qr" placeholder="QR code text" style="background:#374151;border-radius:4px;' +
            'padding:2px 4px;width:140px;color:#e5e7eb;">' +
          '<button id="devgps-scan" style="background:#7c3aed;border-radius:4px;padding:2px 8px;cursor:pointer;">scan</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(panel);
    coordsEl = panel.querySelector('#devgps-coords');
    updatePanel();

    const step = () => Number(panel.querySelector('#devgps-step').value);
    panel.querySelector('#devgps-n').onclick = () => nudge(step(), 0);
    panel.querySelector('#devgps-s').onclick = () => nudge(-step(), 0);
    panel.querySelector('#devgps-e').onclick = () => nudge(0, step());
    panel.querySelector('#devgps-w').onclick = () => nudge(0, -step());

    panel.querySelector('#devgps-toggle').onclick = function () {
      const body = panel.querySelector('#devgps-body');
      const hidden = body.style.display === 'none';
      body.style.display = hidden ? '' : 'none';
      this.textContent = hidden ? '[hide]' : '[show]';
    };

    function simulateScan() {
      const input = panel.querySelector('#devgps-qr');
      const code = input.value.trim();
      if (!code) return;
      if (typeof window.handleQRCode === 'function' || typeof handleQRCode === 'function') {
        (window.handleQRCode || handleQRCode)(code, 'scan');
        input.value = '';
      } else {
        console.warn('devGPS: handleQRCode not loaded yet');
      }
    }
    panel.querySelector('#devgps-scan').onclick = simulateScan;
    panel.querySelector('#devgps-qr').addEventListener('keydown', e => {
      if (e.key === 'Enter') simulateScan();
    });
  }

  // Right-click (contextmenu) on any Leaflet map teleports the fake position.
  function hookLeaflet() {
    if (!window.L || !L.map) return;
    const origMap = L.map;
    L.map = function () {
      const m = origMap.apply(this, arguments);
      m.on('contextmenu', e => setPosition(e.latlng.lat, e.latlng.lng));
      return m;
    };
    Object.assign(L.map, origMap);
  }

  document.addEventListener('DOMContentLoaded', () => {
    hookLeaflet();
    buildPanel();
    console.log('devGPS active — position', position, '— use devGPS.set(lat, lng) or the panel');
  });
})();
