const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { WebcastPushConnection } = require('tiktok-live-connector');
const { LiveChat } = require('youtube-chat');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 3000;

app.use(express.static('.'));

// ── Per-client sessions ──────────────────────────────────────────────────────
// Each client can have BOTH tiktok + youtube connected simultaneously
// Map<ws, { tiktok: {conn, username, connected}, youtube: {conn, identifier, connected}, lastConnectAttempt }>
const sessions = new Map();

function getSession(ws) {
  if (!sessions.has(ws)) sessions.set(ws, { tiktok: null, youtube: null, lastConnectAttempt: 0 });
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
  try { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); } catch (e) {}
}

function cleanupSession(ws) {
  var s = sessions.get(ws);
  if (!s) return;
  if (s.tiktok && s.tiktok.conn) { try { s.tiktok.conn.disconnect(); } catch(e){} }
  if (s.youtube && s.youtube.conn) { try { s.youtube.conn.stop(); } catch(e){} }
  sessions.delete(ws);
}

// ── TikTok Connection ────────────────────────────────────────────────────────
function connectTikTok(ws, username) {
  var session = getSession(ws);
  // Disconnect previous TikTok only
  if (session.tiktok && session.tiktok.conn) {
    try { session.tiktok.conn.disconnect(); } catch(e){}
  }

  var opts = {
    processInitialData: true, enableExtendedGiftInfo: true, enableWebsocketUpgrade: true,
    requestPollingIntervalMs: 2000, requestOptions: { timeout: 15000 }, websocketOptions: { timeout: 15000 }
  };
  if (process.env.TIKTOK_SESSION_ID) opts.sessionId = process.env.TIKTOK_SESSION_ID;

  var tiktok = new WebcastPushConnection(username, opts);
  session.tiktok = { conn: tiktok, username: username, connected: false };
  session.lastConnectAttempt = Date.now();

  console.log('[TikTok] Connecting to @' + username + '...');

  tiktok.connect().then(function(state) {
    console.log('[TikTok] Connected to @' + username + ' | roomId:', state.roomId);
    if (session.tiktok) session.tiktok.connected = true;
    send(ws, { type: 'connected', platform: 'tiktok', username: username, roomId: state.roomId });
  }).catch(function(err) {
    console.error('[TikTok] Failed:', err.message);
    send(ws, { type: 'error', platform: 'tiktok', message: 'TikTok: ' + err.message });
  });

  tiktok.on('chat', function(data) {
    var u = data.user || {}, uid = getUser(u, data, username), nick = getNick(u, data, uid), av = getAvatar(u, data);
    send(ws, { type: 'chat', platform: 'tiktok', user: uid, nickname: nick, avatar: av, comment: data.comment || '' });
  });
  tiktok.on('member', function(data) {
    var u = data.user || {}, uid = getUser(u, data, ''), nick = getNick(u, data, uid), av = getAvatar(u, data);
    if (uid) send(ws, { type: 'member', platform: 'tiktok', user: uid, nickname: nick, avatar: av });
  });
  tiktok.on('gift', function(data) {
    var u = data.user || {}, uid = getUser(u, data, 'unknown'), nick = getNick(u, data, uid), av = getAvatar(u, data);
    send(ws, { type: 'gift', platform: 'tiktok', user: uid, nickname: nick, avatar: av,
      giftName: (data.giftName || data.describe || '').toLowerCase(), diamondCount: data.diamondCount || 1,
      repeatCount: data.repeatCount || 1, giftId: data.giftId || 0 });
  });
  tiktok.on('like', function(data) {
    var u = data.user || {}, uid = getUser(u, data, ''), nick = getNick(u, data, uid), av = getAvatar(u, data);
    if (uid) send(ws, { type: 'like', platform: 'tiktok', user: uid, nickname: nick, avatar: av, likeCount: data.likeCount || 1 });
  });
  tiktok.on('follow', function(data) {
    var u = data.user || {}, uid = getUser(u, data, 'unknown'), nick = getNick(u, data, uid), av = getAvatar(u, data);
    send(ws, { type: 'follow', platform: 'tiktok', user: uid, nickname: nick, avatar: av });
  });
  tiktok.on('share', function(data) {
    var u = data.user || {}, uid = getUser(u, data, 'unknown'), nick = getNick(u, data, uid), av = getAvatar(u, data);
    send(ws, { type: 'share', platform: 'tiktok', user: uid, nickname: nick, avatar: av });
  });
  tiktok.on('social', function(data) {
    var u = data.user || {}, uid = getUser(u, data, ''), nick = getNick(u, data, uid), av = getAvatar(u, data);
    if (uid) send(ws, { type: 'social', platform: 'tiktok', user: uid, nickname: nick, avatar: av, label: data.displayType || 'social' });
  });
  tiktok.on('roomUser', function(data) { send(ws, { type: 'roomUser', platform: 'tiktok', viewerCount: data.viewerCount || 0 }); });
  tiktok.on('streamEnd', function() {
    console.log('[TikTok] Stream ended @' + username);
    if (session.tiktok) session.tiktok.connected = false;
    send(ws, { type: 'streamEnd', platform: 'tiktok' });
  });
  tiktok.on('disconnected', function() {
    if (session.tiktok) session.tiktok.connected = false;
    send(ws, { type: 'disconnected', platform: 'tiktok' });
  });
  tiktok.on('error', function(err) {
    send(ws, { type: 'error', platform: 'tiktok', message: err.message });
  });
}

// ── YouTube Connection ───────────────────────────────────────────────────────
function connectYouTube(ws, channelId, liveId) {
  var session = getSession(ws);
  // Disconnect previous YouTube only
  if (session.youtube && session.youtube.conn) {
    try { session.youtube.conn.stop(); } catch(e){}
  }

  var opts = {};
  if (liveId) opts.liveId = liveId;
  else if (channelId) opts.channelId = channelId;
  else { send(ws, { type: 'error', platform: 'youtube', message: 'Channel ID or Live ID required.' }); return; }

  var identifier = liveId || channelId;
  console.log('[YouTube] Connecting to ' + identifier + '...');

  var yt;
  try { yt = new LiveChat(opts); } catch(err) {
    send(ws, { type: 'error', platform: 'youtube', message: 'YouTube: ' + err.message }); return;
  }

  session.youtube = { conn: yt, identifier: identifier, connected: false };
  session.lastConnectAttempt = Date.now();

  yt.on('start', function(liveIdResolved) {
    console.log('[YouTube] Connected! liveId:', liveIdResolved);
    if (session.youtube) session.youtube.connected = true;
    send(ws, { type: 'connected', platform: 'youtube', username: identifier, liveId: liveIdResolved });
  });
  yt.on('end', function(reason) {
    console.log('[YouTube] Ended:', reason);
    if (session.youtube) session.youtube.connected = false;
    send(ws, { type: 'streamEnd', platform: 'youtube', reason: reason || '' });
  });
  yt.on('error', function(err) {
    send(ws, { type: 'error', platform: 'youtube', message: 'YouTube: ' + String(err.message || err) });
  });
  yt.on('chat', function(chatItem) {
    var author = chatItem.author || {};
    var uid = (author.name || 'unknown').toLowerCase();
    var nick = author.name || uid;
    var av = (author.thumbnail && author.thumbnail.url) || '';
    var text = '';
    if (chatItem.message && Array.isArray(chatItem.message)) {
      text = chatItem.message.map(function(m) { return m.text || m.emojiText || ''; }).join('');
    }
    var msg = { type: 'chat', platform: 'youtube', user: '@' + uid, nickname: nick, avatar: av, comment: text,
      channelId: author.channelId || '', isOwner: !!chatItem.isOwner, isModerator: !!chatItem.isModerator, isMembership: !!chatItem.isMembership };
    if (chatItem.superchat) {
      msg.type = 'superchat';
      msg.amount = chatItem.superchat.amount || '';
      msg.color = chatItem.superchat.color || '';
    }
    send(ws, msg);
  });

  yt.start().then(function(ok) {
    if (!ok) send(ws, { type: 'error', platform: 'youtube', message: 'Failed to connect. Is the channel live?' });
  }).catch(function(err) {
    send(ws, { type: 'error', platform: 'youtube', message: 'YouTube: ' + err.message });
  });
}

// ── WebSocket handler ────────────────────────────────────────────────────────
wss.on('connection', function(ws) {
  console.log('[WS] Client connected. Total:', wss.clients.size);

  ws.on('message', function(raw) {
    try {
      var msg = JSON.parse(raw);
      var session = getSession(ws);

      // Rate-limit
      if ((msg.action === 'connect' || msg.action === 'connectYouTube') && session.lastConnectAttempt && (Date.now() - session.lastConnectAttempt < 10000)) {
        var wait = Math.ceil((10000 - (Date.now() - session.lastConnectAttempt)) / 1000);
        send(ws, { type: 'error', platform: msg.action === 'connect' ? 'tiktok' : 'youtube', message: 'Wait ' + wait + 's before reconnecting.' });
        return;
      }

      if (msg.action === 'connect' && msg.username) {
        var uname = msg.username.replace(/^@/, '').trim();
        if (!uname) { send(ws, { type: 'error', platform: 'tiktok', message: 'Username required.' }); return; }
        connectTikTok(ws, uname);
      }
      else if (msg.action === 'connectYouTube') {
        var cId = (msg.channelId || '').trim();
        var lId = (msg.liveId || '').trim();
        if (!cId && !lId) { send(ws, { type: 'error', platform: 'youtube', message: 'Channel or Live ID required.' }); return; }
        connectYouTube(ws, cId, lId);
      }
      else if (msg.action === 'disconnect') {
        var plat = msg.platform || 'all';
        if ((plat === 'all' || plat === 'tiktok') && session.tiktok && session.tiktok.conn) {
          try { session.tiktok.conn.disconnect(); } catch(e){} session.tiktok = null;
        }
        if ((plat === 'all' || plat === 'youtube') && session.youtube && session.youtube.conn) {
          try { session.youtube.conn.stop(); } catch(e){} session.youtube = null;
        }
        send(ws, { type: 'disconnected', platform: plat });
      }
      else if (msg.action === 'status') {
        send(ws, { type: 'status',
          tiktok: !!(session.tiktok && session.tiktok.connected),
          youtube: !!(session.youtube && session.youtube.connected),
          tiktokUser: session.tiktok ? session.tiktok.username : null,
          youtubeId: session.youtube ? session.youtube.identifier : null
        });
      }
    } catch(e) { console.error('[WS] Bad message:', e.message); }
  });

  ws.on('close', function() {
    var s = sessions.get(ws);
    if (s) console.log('[WS] Client left. TT:', s.tiktok ? s.tiktok.username : '-', 'YT:', s.youtube ? s.youtube.identifier : '-');
    cleanupSession(ws);
    console.log('[WS] Remaining:', wss.clients.size);
  });
  ws.on('error', function(err) { console.error('[WS] Error:', err.message); });
});

// ── Health + Start ───────────────────────────────────────────────────────────
app.get('/health', function(_req, res) { res.json({ status: 'ok', sessions: sessions.size, uptime: process.uptime() }); });

server.listen(PORT, function() {
  console.log('=== Pickaxe Drop Server ===');
  console.log('Game:      http://localhost:' + PORT);
  console.log('Platforms: TikTok + YouTube (simultaneous)');
  console.log('===========================');
  if (process.env.RENDER_EXTERNAL_URL) {
    setInterval(function() {
      require('http').get((process.env.RENDER_EXTERNAL_URL + '/health').replace('https:', 'http:'), function(){}).on('error', function(){});
    }, 14 * 60 * 1000);
  }
});
