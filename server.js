const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const PUBLIC_DIR = __dirname;

// In-memory telemetry state
let missionState = {
  systemState: 'NOMINAL',
  alertActive: false,
  alertMessage: '',
  solarWindSpeed: 420, // km/s
  magneticFlux: 8.4,   // nT
  coronaTemp: 1.25,    // million Kelvin
  magX: 2.1,
  magY: -4.3,
  magZ: 1.8
};

// Store active SSE clients
let sseClients = [];

// Payload JSON data
const payloadData = {
  velc: {
    title: 'Visible Emission Line Coronagraph (primary)',
    desc: 'Studies the solar corona\'s dynamics, magnetic fields, and mass ejections. Designed to capture 1,440 solar images daily.'
  },
  suit: {
    title: 'Solar Ultraviolet Imaging Telescope',
    desc: 'Images the solar Photosphere and Chromosphere in near Ultraviolet (UV), tracking dynamic solar atmospheric layers.'
  },
  aspex: {
    title: 'Aditya Solar wind Particle Experiment',
    desc: 'Analyzes solar wind particles (electrons, protons, and alpha particles) and their energy distribution.'
  },
  papa: {
    title: 'Plasma Analyser Package for Aditya',
    desc: 'Measures solar wind plasma composition and identifies components contributing to space weather events.'
  },
  solexs: {
    title: 'Solar Low Energy X-ray Spectrometer',
    desc: 'Monitors soft X-ray emissions to study solar flare activities and heating mechanisms of the solar corona.'
  },
  hel1os: {
    title: 'High Energy L1 Orbiting X-ray Spectrometer',
    desc: 'Observes hard X-ray emissions from high-energy events in the solar atmosphere, tracking solar flare kinetics.'
  },
  mag: {
    title: 'Magnetometer',
    desc: 'Measures the magnitude and direction of the interplanetary magnetic field at the Lagrangian Point L1.'
  }
};

// Update telemetry data dynamically every 1.5 seconds
setInterval(() => {
  // If nominal state, fluctuate values slightly
  if (!missionState.alertActive) {
    missionState.solarWindSpeed = Math.round(missionState.solarWindSpeed + (Math.random() * 20 - 10));
    missionState.solarWindSpeed = Math.max(300, Math.min(600, missionState.solarWindSpeed));

    missionState.magneticFlux = parseFloat((missionState.magneticFlux + (Math.random() * 0.8 - 0.4)).toFixed(2));
    missionState.magneticFlux = Math.max(4.0, Math.min(15.0, missionState.magneticFlux));

    missionState.coronaTemp = parseFloat((missionState.coronaTemp + (Math.random() * 0.04 - 0.02)).toFixed(2));
    missionState.coronaTemp = Math.max(1.1, Math.min(1.4, missionState.coronaTemp));
  } else {
    // Alert state (Solar Flare/CME) - spike readings
    missionState.solarWindSpeed = Math.round(missionState.solarWindSpeed + (Math.random() * 50 - 10));
    missionState.solarWindSpeed = Math.max(750, Math.min(1200, missionState.solarWindSpeed));

    missionState.magneticFlux = parseFloat((missionState.magneticFlux + (Math.random() * 3.0 - 0.5)).toFixed(2));
    missionState.magneticFlux = Math.max(25.0, Math.min(65.0, missionState.magneticFlux));

    missionState.coronaTemp = parseFloat((missionState.coronaTemp + (Math.random() * 0.15 - 0.05)).toFixed(2));
    missionState.coronaTemp = Math.max(1.8, Math.min(3.2, missionState.coronaTemp));
  }

  // Fluctuate magnetic direction vectors
  missionState.magX = parseFloat((missionState.magX + (Math.random() * 0.6 - 0.3)).toFixed(1));
  missionState.magY = parseFloat((missionState.magY + (Math.random() * 0.6 - 0.3)).toFixed(1));
  missionState.magZ = parseFloat((missionState.magZ + (Math.random() * 0.6 - 0.3)).toFixed(1));

  // Broadcast to all connected clients
  broadcastTelemetry();
}, 1500);

function broadcastTelemetry() {
  const dataString = `data: ${JSON.stringify(missionState)}\n\n`;
  sseClients.forEach(client => {
    client.write(dataString);
  });
}

// MIME types lookup
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];

  // ==========================================================================
  // SSE ENDPOINT: /api/telemetry/stream
  // ==========================================================================
  if (urlPath === '/api/telemetry/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    // Send initial handshake state
    res.write(`data: ${JSON.stringify(missionState)}\n\n`);

    sseClients.push(res);

    req.on('close', () => {
      sseClients = sseClients.filter(client => client !== res);
    });
    return;
  }

  // ==========================================================================
  // REST API: /api/payloads
  // ==========================================================================
  if (urlPath === '/api/payloads' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payloadData));
    return;
  }

  // ==========================================================================
  // REST API: /api/control (Update Alerts / States)
  // ==========================================================================
  if (urlPath === '/api/control' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        
        if (payload.systemState) missionState.systemState = payload.systemState;
        
        if (payload.alertActive !== undefined) {
          missionState.alertActive = !!payload.alertActive;
          
          if (missionState.alertActive) {
            missionState.alertMessage = payload.alertMessage || 'SOLAR FLARE FLUX ALARM';
            // Instantly trigger spike on alert active
            missionState.solarWindSpeed = 820;
            missionState.magneticFlux = 35.2;
            missionState.coronaTemp = 2.15;
          } else {
            missionState.alertMessage = '';
            // Reset to nominal normal values
            missionState.solarWindSpeed = 420;
            missionState.magneticFlux = 8.4;
            missionState.coronaTemp = 1.25;
          }
        }

        // Broadcast changes immediately
        broadcastTelemetry();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, state: missionState }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON request payload' }));
      }
    });
    return;
  }

  // ==========================================================================
  // STATIC FILE SERVER
  // ==========================================================================
  let filePath = path.join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath);
  
  // Guard against path traversal attacks
  const relative = path.relative(PUBLIC_DIR, filePath);
  const isSafe = relative && !relative.startsWith('..') && !path.isAbsolute(relative);
  
  if (urlPath !== '/' && !isSafe) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Access Denied');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`[Aditya-L1 Server] Running on http://localhost:${PORT}`);
});
