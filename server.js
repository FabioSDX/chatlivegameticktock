const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { WebSocketServer } = require('ws');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 3000;

// ── CORS headers ─────────────────────────────────────────────────────────────────
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Favicon handler - serve inline SVG emoji
app.get('/favicon.ico', function (req, res) {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⛏</text></svg>');
});

app.use(express.static('.'));

// ── Per-client sessions ──────────────────────────────────────────────────────
// Each client can have ONLY tiktok connected
// Map<ws, { tiktok: {conn, username, connected}, lastTTConnect }>
const sessions = new Map();

function getSession(ws) {
  if (!sessions.has(ws)) sessions.set(ws, { tiktok: null, lastTTConnect: 0 });
  return sessions.get(ws);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function getAvatar(user, data) {
  return (user && user.profilePictureUrl) || (data && data.profilePictureUrl) || '';
}
function getUser(user, data, fallback) {
  var u = user || {};
  return (u.uniqueId || (data && data.uniqueId) || u.nickname || (data && data.nickname) || fallback || '').toLowerCase();
}
function getNick(user, data, fallback) {
  return (user && user.nickname) || (data && data.nickname) || fallback || '';
}

function send(ws, obj) {
  try { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); } catch (e) { }
}

function cleanupSession(ws) {
  var s = sessions.get(ws);
  if (!s) return;
  if (s.tiktok && s.tiktok.conn) { try { s.tiktok.conn.disconnect(); } catch (e) { } }
  sessions.delete(ws);
}

// ── TikTok Connection ────────────────────────────────────────────────────────
function connectTikTok(ws, username, sessionId) {
  var session = getSession(ws);
  // Disconnect previous TikTok only
  if (session.tiktok && session.tiktok.conn) {
    try { session.tiktok.conn.disconnect(); } catch (e) { }
  }

  var opts = {
    processInitialData: true, enableExtendedGiftInfo: true, enableWebsocketUpgrade: true,
    requestPollingIntervalMs: 2000, requestOptions: { timeout: 15000 }, websocketOptions: { timeout: 15000 }
  };
  if (sessionId) opts.sessionId = sessionId;
  else if (process.env.TIKTOK_SESSION_ID) opts.sessionId = process.env.TIKTOK_SESSION_ID;

  var tiktok = new WebcastPushConnection(username, opts);
  session.tiktok = { conn: tiktok, username: username, connected: false };
  session.lastTTConnect = Date.now();

  console.log('[TikTok] Connecting to @' + username + '...');

  tiktok.connect().then(function (state) {
    console.log('[TikTok] Connected to @' + username + ' | roomId:', state.roomId);
    if (session.tiktok) session.tiktok.connected = true;
    var gifts = [];
    if (state.availableGifts) {
      gifts = state.availableGifts.map(function(g) { 
        return { name: g.name ? g.name.toLowerCase() : '', url: (g.image && g.image.url_list) ? g.image.url_list[0] : '' };
      });
    }
    var hostAvatar = '';
    try { hostAvatar = state.roomInfo.owner.avatar_thumb.url_list[0]; } catch(e) {}
    send(ws, { type: 'connected', platform: 'tiktok', username: username, roomId: state.roomId, availableGifts: gifts, ownerAvatar: hostAvatar });
  }).catch(function (err) {
    console.error('[TikTok] Failed:', err.message);
    // Retry without websocket upgrade if that was the issue
    if (err.message && err.message.includes('websocket upgrade')) {
      console.log('[TikTok] Retrying with polling only...');
      opts.enableWebsocketUpgrade = false;
      var tiktok2 = new WebcastPushConnection(username, opts);
      session.tiktok = { conn: tiktok2, username: username, connected: false };
      // Re-attach all events
      attachTikTokEvents(ws, tiktok2, username, session);
      tiktok2.connect().then(function (state) {
        console.log('[TikTok] Connected (polling) to @' + username + ' | roomId:', state.roomId);
        if (session.tiktok) session.tiktok.connected = true;
        var gifts = [];
        if (state.availableGifts) {
          gifts = state.availableGifts.map(function(g) { 
            return { name: g.name ? g.name.toLowerCase() : '', url: (g.image && g.image.url_list) ? g.image.url_list[0] : '' };
          });
        }
        var hostAvatar = '';
        try { hostAvatar = state.roomInfo.owner.avatar_thumb.url_list[0]; } catch(e) {}
        send(ws, { type: 'connected', platform: 'tiktok', username: username, roomId: state.roomId, availableGifts: gifts, ownerAvatar: hostAvatar });
      }).catch(function (err2) {
        console.error('[TikTok] Polling also failed:', err2.message);
        send(ws, { type: 'error', platform: 'tiktok', message: 'TikTok: ' + err2.message });
      });
      return;
    }
    send(ws, { type: 'error', platform: 'tiktok', message: 'TikTok: ' + err.message });
  });

  attachTikTokEvents(ws, tiktok, username, session);
}

function attachTikTokEvents(ws, tiktok, username, session) {

  tiktok.on('chat', function (data) {
    var u = data.user || {}, uid = getUser(u, data, username), nick = getNick(u, data, uid), av = getAvatar(u, data);
    send(ws, { type: 'chat', platform: 'tiktok', user: uid, nickname: nick, avatar: av, comment: data.comment || '' });
  });
  tiktok.on('member', function (data) {
    var u = data.user || {}, uid = getUser(u, data, ''), nick = getNick(u, data, uid), av = getAvatar(u, data);
    if (uid) send(ws, { type: 'member', platform: 'tiktok', user: uid, nickname: nick, avatar: av });
  });
  tiktok.on('gift', function (data) {
    var u = data.user || {}, uid = getUser(u, data, 'unknown'), nick = getNick(u, data, uid), av = getAvatar(u, data);
    send(ws, {
      type: 'gift', platform: 'tiktok', user: uid, nickname: nick, avatar: av,
      giftName: (data.giftName || data.describe || '').toLowerCase(), diamondCount: data.diamondCount || 1,
      repeatCount: data.repeatCount || 1, giftId: data.giftId || 0,
      giftPictureUrl: data.giftPictureUrl || (data.extendedGiftInfo && data.extendedGiftInfo.icon && data.extendedGiftInfo.icon.url_list ? data.extendedGiftInfo.icon.url_list[0] : '')
    });
  });
  tiktok.on('like', function (data) {
    var u = data.user || {}, uid = getUser(u, data, ''), nick = getNick(u, data, uid), av = getAvatar(u, data);
    if (!uid) return;

    // Buffer likes per user to avoid flooding the WebSocket
    if (!session.likeBuffer) session.likeBuffer = {};
    if (!session.likeBuffer[uid]) {
      session.likeBuffer[uid] = { type: 'like', platform: 'tiktok', user: uid, nickname: nick, avatar: av, likeCount: 0 };
    }
    session.likeBuffer[uid].likeCount += (data.likeCount || 1);

    if (!session.likeTimeout) {
      session.likeTimeout = setTimeout(function () {
        if (session.likeBuffer) {
          for (var user in session.likeBuffer) {
            send(ws, session.likeBuffer[user]);
          }
          session.likeBuffer = {};
        }
        session.likeTimeout = null;
      }, 300); // 300ms interval for responsiveness
    }
  });
  tiktok.on('follow', function (data) {
    var u = data.user || {}, uid = getUser(u, data, 'unknown'), nick = getNick(u, data, uid), av = getAvatar(u, data);
    send(ws, { type: 'follow', platform: 'tiktok', user: uid, nickname: nick, avatar: av });
  });
  tiktok.on('share', function (data) {
    var u = data.user || {}, uid = getUser(u, data, 'unknown'), nick = getNick(u, data, uid), av = getAvatar(u, data);
    send(ws, { type: 'share', platform: 'tiktok', user: uid, nickname: nick, avatar: av });
  });
  tiktok.on('social', function (data) {
    var u = data.user || {}, uid = getUser(u, data, ''), nick = getNick(u, data, uid), av = getAvatar(u, data);
    if (uid) send(ws, { type: 'social', platform: 'tiktok', user: uid, nickname: nick, avatar: av, label: data.displayType || 'social' });
  });
  tiktok.on('roomUser', function (data) { send(ws, { type: 'roomUser', platform: 'tiktok', viewerCount: data.viewerCount || 0 }); });
  tiktok.on('streamEnd', function () {
    console.log('[TikTok] Stream ended @' + username);
    if (session.tiktok) session.tiktok.connected = false;
    send(ws, { type: 'streamEnd', platform: 'tiktok' });
  });
  tiktok.on('disconnected', function () {
    if (session.tiktok) session.tiktok.connected = false;
    send(ws, { type: 'disconnected', platform: 'tiktok' });
  });
  tiktok.on('error', function (err) {
    send(ws, { type: 'error', platform: 'tiktok', message: err.message });
  });
}


// ── WebSocket handler ────────────────────────────────────────────────────────
wss.on('connection', function (ws) {
  console.log('[WS] Client connected. Total:', wss.clients.size);

  ws.on('message', function (raw) {
    try {
      var msg = JSON.parse(raw);
      var session = getSession(ws);

      // Rate-limit per platform
      if (msg.action === 'connect' && session.lastTTConnect && (Date.now() - session.lastTTConnect < 10000)) {
        var wait = Math.ceil((10000 - (Date.now() - session.lastTTConnect)) / 1000);
        send(ws, { type: 'error', platform: 'tiktok', message: 'Wait ' + wait + 's before reconnecting.' });
        return;
      }

      if (msg.action === 'connect' && msg.username) {
        var uname = msg.username.replace(/^@/, '').trim();
        if (!uname) { send(ws, { type: 'error', platform: 'tiktok', message: 'Username required.' }); return; }
        connectTikTok(ws, uname, msg.sessionId);
      }
      else if (msg.action === 'disconnect') {
        var plat = msg.platform || 'all';
        if ((plat === 'all' || plat === 'tiktok') && session.tiktok && session.tiktok.conn) {
          try { session.tiktok.conn.disconnect(); } catch (e) { } session.tiktok = null;
        }
        send(ws, { type: 'disconnected', platform: plat });
      }
      else if (msg.action === 'status') {
        send(ws, {
          type: 'status',
          tiktok: !!(session.tiktok && session.tiktok.connected),
          tiktokUser: session.tiktok ? session.tiktok.username : null
        });
      }
    } catch (e) { console.error('[WS] Bad message:', e.message); }
  });

  ws.on('close', function () {
    var s = sessions.get(ws);
    if (s) console.log('[WS] Client left. TT:', s.tiktok ? s.tiktok.username : '-');
    cleanupSession(ws);
    console.log('[WS] Remaining:', wss.clients.size);
  });
  ws.on('error', function (err) { console.error('[WS] Error:', err.message); });
});

// ── Health + Start ───────────────────────────────────────────────────────────
app.get('/health', function (_req, res) { res.json({ status: 'ok', sessions: sessions.size, uptime: process.uptime() }); });

// ── Lista de músicas da pasta /music ───────────────────────────────────────────
app.get('/music-list', function (_req, res) {
  var musicDir = path.join(__dirname, 'music');
  try {
    if (!fs.existsSync(musicDir)) {
      return res.json({ files: [] });
    }
    var files = fs.readdirSync(musicDir);
    var audioExt = ['.mp3', '.ogg', '.wav', '.m4a', '.webm'];
    var musicFiles = files.filter(function (f) {
      var ext = path.extname(f).toLowerCase();
      return audioExt.includes(ext);
    });
    // Retorna URLs relativas
    musicFiles = musicFiles.map(function (f) { return 'music/' + f; });
    res.json({ files: musicFiles });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Lista de vídeos da pasta /video ───────────────────────────────────────────
app.get('/video-list', function (_req, res) {
  var videoDir = path.join(__dirname, 'video');
  try {
    if (!fs.existsSync(videoDir)) {
      return res.json({ files: [] });
    }
    var files = fs.readdirSync(videoDir);
    var videoExt = ['.mp4', '.webm', '.ogg', '.mov'];
    var videoFiles = files.filter(function (f) {
      var ext = path.extname(f).toLowerCase();
      return videoExt.includes(ext);
    });
    // Retorna URLs relativas
    videoFiles = videoFiles.map(function (f) { return 'video/' + f; });
    res.json({ files: videoFiles });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Lista de áudios da pasta /menssagens ───────────────────────────────────────
app.get('/messages-list', function (_req, res) {
  var msgDir = path.join(__dirname, 'menssagens');
  try {
    if (!fs.existsSync(msgDir)) {
      return res.json({ files: [] });
    }
    var files = fs.readdirSync(msgDir);
    var audioExt = ['.mp3', '.ogg', '.wav', '.m4a', '.webm'];
    var audioFiles = files.filter(function (f) {
      var ext = path.extname(f).toLowerCase();
      return audioExt.includes(ext);
    });
    // Retorna URLs relativas
    audioFiles = audioFiles.map(function (f) { return 'menssagens/' + f; });
    res.json({ files: audioFiles });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Serve pasta de mensagens como estático
app.use('/menssagens', express.static(path.join(__dirname, 'menssagens')));

// ── TikTok TTS Proxy ───────────────────────────────────────────────────────────
// ── Microsoft Edge TTS Proxy (Vozes Naturais) ──────────────────────────────────
async function getEdgeTTS(text, voice) {
  const WebSocket = require('ws');
  const { v4: uuidv4 } = require('crypto');

  return new Promise((resolve, reject) => {
    const requestId = require('crypto').randomBytes(16).toString('hex');
    const endpoint = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4&ConnectionId=' + requestId;

    const ws = new WebSocket(endpoint, {
      headers: {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
        'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
      }
    });

    let audioData = Buffer.alloc(0);
    let timeout = setTimeout(() => { ws.close(); reject(new Error('TTS Timeout')); }, 10000);

    ws.on('open', () => {
      const config = 'Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}';
      let lang = voice.startsWith('pt-BR') ? 'pt-BR' : 'en-US';
      const ssml = 'X-RequestId:' + requestId + '\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n<speak version=\'1.0\' xmlns=\'http://www.w3.org/2001/10/synthesis\' xml:lang=\'' + lang + '\'><voice name=\'' + voice + '\'><prosody pitch=\'+0Hz\' rate=\'+10%\' volume=\'+0%\'>' + text + '</prosody></voice></speak>';
      ws.send(config);
      ws.send(ssml);
    });

    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        const index = data.indexOf(Buffer.from('Path:audio\r\n'));
        if (index !== -1) {
          audioData = Buffer.concat([audioData, data.slice(index + 12)]);
        }
      } else {
        const msg = data.toString();
        if (msg.includes('Path:turn.end')) {
          clearTimeout(timeout);
          ws.close();
          resolve(audioData);
        }
      }
    });

    ws.on('error', (err) => { clearTimeout(timeout); reject(err); });
  });
}

app.get('/tts', async function (req, res) {
  var text = req.query.text;
  var voice = req.query.voice || 'en-US-GuyNeural';
  if (!text) return res.status(400).send('Text is required');

  text = text.substring(0, 500);

  try {
    console.log('[TTS] Microsoft Natural:', voice, '| Texto:', text.substring(0, 30) + '...');
    const audioBuffer = await getEdgeTTS(text, voice);

    if (audioBuffer && audioBuffer.length > 0) {
      res.set('Content-Type', 'audio/mpeg');
      return res.send(audioBuffer);
    }
    throw new Error('Buffer de áudio vazio');

  } catch (e) {
    console.error('[TTS] Erro Microsoft TTS:', e.message);
    // Fallback final Google Translate (Proxy to avoid CORS/Referer issues)
    let tl = voice.startsWith('pt-BR') ? 'pt-br' : 'en';
    var googleUrl = 'https://translate.google.com/translate_tts?ie=UTF-8&q=' + encodeURIComponent(text) + '&tl=' + tl + '&client=tw-ob';
    
    const https = require('https');
    https.get(googleUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }, (gRes) => {
      if (gRes.statusCode !== 200) {
        return res.status(gRes.statusCode).send('Google TTS Error');
      }
      res.set('Content-Type', 'audio/mpeg');
      gRes.pipe(res);
    }).on('error', (err) => {
      res.status(500).send('TTS Fallback Error: ' + err.message);
    });
  }
});

server.listen(PORT, function () {
  console.log('=== Pickaxe Drop Server ===');
  console.log('Game:      http://localhost:' + PORT);
  console.log('Platforms: TikTok Live');
  console.log('===========================');
  if (process.env.RENDER_EXTERNAL_URL) {
    setInterval(function () {
      require('http').get((process.env.RENDER_EXTERNAL_URL + '/health').replace('https:', 'http:'), function () { }).on('error', function () { });
    }, 14 * 60 * 1000);
  }
});
