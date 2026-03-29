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
// Map<ws, { tiktokConnection?, youtubeConnection?, platform, username, isConnected }>
const sessions = new Map();

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
  try {
    if (ws.readyState === 1) ws.send(JSON.stringify(obj));
  } catch (e) { /* ignore closed sockets */ }
}

function cleanupSession(ws) {
  var session = sessions.get(ws);
  if (!session) return;
  if (session.tiktokConnection) {
    try { session.tiktokConnection.disconnect(); } catch (e) {}
  }
  if (session.youtubeConnection) {
    try { session.youtubeConnection.stop(); } catch (e) {}
  }
  sessions.delete(ws);
}

// ── Connect a single client to TikTok ────────────────────────────────────────
function connectTikTok(ws, username) {
  var session = sessions.get(ws);
  // Disconnect previous connections
  if (session && session.tiktokConnection) {
    try { session.tiktokConnection.disconnect(); } catch (e) {}
  }
  if (session && session.youtubeConnection) {
    try { session.youtubeConnection.stop(); } catch (e) {}
  }

  var opts = {
    processInitialData: true,
    enableExtendedGiftInfo: true,
    enableWebsocketUpgrade: true,
    requestPollingIntervalMs: 2000,
    requestOptions: { timeout: 15000 },
    websocketOptions: { timeout: 15000 }
  };
  if (process.env.TIKTOK_SESSION_ID) opts.sessionId = process.env.TIKTOK_SESSION_ID;

  var tiktok = new WebcastPushConnection(username, opts);

  sessions.set(ws, {
    tiktokConnection: tiktok, youtubeConnection: null,
    platform: 'tiktok', username: username,
    isConnected: false, lastConnectAttempt: Date.now()
  });

  console.log('[TikTok] Connecting to @' + username + '...');

  tiktok.connect().then(function(state) {
    console.log('[TikTok] Connected to @' + username + ' | roomId:', state.roomId);
    var s = sessions.get(ws);
    if (s) s.isConnected = true;
    send(ws, { type: 'connected', platform: 'tiktok', username: username, roomId: state.roomId });
  }).catch(function(err) {
    console.error('[TikTok] Connection failed for @' + username + ':', err.message);
    send(ws, { type: 'error', platform: 'tiktok', message: 'TikTok connection failed: ' + err.message });
  });

  tiktok.on('chat', function(data) {
    var user = data.user || {};
    var uid = getUser(user, data, username);
    var nick = getNick(user, data, uid);
    var avatar = getAvatar(user, data);
    send(ws, { type: 'chat', platform: 'tiktok', user: uid, nickname: nick, avatar: avatar, comment: data.comment || '' });
  });

  tiktok.on('member', function(data) {
    var user = data.user || {};
    var uid = getUser(user, data, '');
    var nick = getNick(user, data, uid);
    var avatar = getAvatar(user, data);
    if (!uid) return;
    send(ws, { type: 'member', platform: 'tiktok', user: uid, nickname: nick, avatar: avatar });
  });

  tiktok.on('gift', function(data) {
    var user = data.user || {};
    var uid = getUser(user, data, 'unknown');
    var nick = getNick(user, data, uid);
    var avatar = getAvatar(user, data);
    var giftName = (data.giftName || data.describe || '').toLowerCase();
    var diamonds = data.diamondCount || 1;
    var repeat = data.repeatCount || 1;
    send(ws, {
      type: 'gift', platform: 'tiktok', user: uid, nickname: nick, avatar: avatar,
      giftName: giftName, diamondCount: diamonds, repeatCount: repeat, giftId: data.giftId || 0
    });
  });

  tiktok.on('like', function(data) {
    var user = data.user || {};
    var uid = getUser(user, data, '');
    var nick = getNick(user, data, uid);
    var avatar = getAvatar(user, data);
    if (!uid) return;
    send(ws, { type: 'like', platform: 'tiktok', user: uid, nickname: nick, avatar: avatar, likeCount: data.likeCount || 1 });
  });

  tiktok.on('follow', function(data) {
    var user = data.user || {};
    var uid = getUser(user, data, 'unknown');
    var nick = getNick(user, data, uid);
    var avatar = getAvatar(user, data);
    send(ws, { type: 'follow', platform: 'tiktok', user: uid, nickname: nick, avatar: avatar });
  });

  tiktok.on('share', function(data) {
    var user = data.user || {};
    var uid = getUser(user, data, 'unknown');
    var nick = getNick(user, data, uid);
    var avatar = getAvatar(user, data);
    send(ws, { type: 'share', platform: 'tiktok', user: uid, nickname: nick, avatar: avatar });
  });

  tiktok.on('social', function(data) {
    var user = data.user || {};
    var uid = getUser(user, data, '');
    var nick = getNick(user, data, uid);
    var avatar = getAvatar(user, data);
    if (!uid) return;
    var label = data.displayType || data.label || 'social';
    send(ws, { type: 'social', platform: 'tiktok', user: uid, nickname: nick, avatar: avatar, label: label });
  });

  tiktok.on('roomUser', function(data) {
    send(ws, { type: 'roomUser', platform: 'tiktok', viewerCount: data.viewerCount || 0 });
  });

  tiktok.on('streamEnd', function(actionId) {
    console.log('[TikTok] Stream ended for @' + username);
    var s = sessions.get(ws);
    if (s) s.isConnected = false;
    send(ws, { type: 'streamEnd', platform: 'tiktok', actionId: actionId });
  });

  tiktok.on('disconnected', function() {
    console.log('[TikTok] Disconnected from @' + username);
    var s = sessions.get(ws);
    if (s) s.isConnected = false;
    send(ws, { type: 'disconnected', platform: 'tiktok' });
  });

  tiktok.on('error', function(err) {
    console.error('[TikTok] Error for @' + username + ':', err.message);
    send(ws, { type: 'error', platform: 'tiktok', message: err.message });
  });
}

// ── Connect a single client to YouTube ───────────────────────────────────────
function connectYouTube(ws, channelId, liveId) {
  var session = sessions.get(ws);
  // Disconnect previous connections
  if (session && session.tiktokConnection) {
    try { session.tiktokConnection.disconnect(); } catch (e) {}
  }
  if (session && session.youtubeConnection) {
    try { session.youtubeConnection.stop(); } catch (e) {}
  }

  var opts = {};
  if (liveId) {
    opts.liveId = liveId;
  } else if (channelId) {
    opts.channelId = channelId;
  } else {
    send(ws, { type: 'error', platform: 'youtube', message: 'Channel ID or Live ID is required.' });
    return;
  }

  var identifier = liveId || channelId;
  console.log('[YouTube] Connecting to ' + identifier + '...');

  var yt;
  try {
    yt = new LiveChat(opts);
  } catch (err) {
    console.error('[YouTube] Failed to create LiveChat:', err.message);
    send(ws, { type: 'error', platform: 'youtube', message: 'Failed to create YouTube connection: ' + err.message });
    return;
  }

  sessions.set(ws, {
    tiktokConnection: null, youtubeConnection: yt,
    platform: 'youtube', username: identifier,
    isConnected: false, lastConnectAttempt: Date.now()
  });

  yt.on('start', function(liveIdResolved) {
    console.log('[YouTube] Connected! liveId:', liveIdResolved);
    var s = sessions.get(ws);
    if (s) s.isConnected = true;
    send(ws, { type: 'connected', platform: 'youtube', username: identifier, liveId: liveIdResolved });
  });

  yt.on('end', function(reason) {
    console.log('[YouTube] Stream ended:', reason);
    var s = sessions.get(ws);
    if (s) s.isConnected = false;
    send(ws, { type: 'streamEnd', platform: 'youtube', reason: reason || 'Stream ended' });
  });

  yt.on('error', function(err) {
    console.error('[YouTube] Error:', err.message || err);
    send(ws, { type: 'error', platform: 'youtube', message: String(err.message || err) });
  });

  yt.on('chat', function(chatItem) {
    var author = chatItem.author || {};
    var uid = (author.name || 'unknown').toLowerCase();
    var nick = author.name || uid;
    var avatar = (author.thumbnail && author.thumbnail.url) || '';
    var channelUrl = author.channelId ? ('https://youtube.com/channel/' + author.channelId) : '';

    // Extract text from message array
    var text = '';
    if (chatItem.message && Array.isArray(chatItem.message)) {
      text = chatItem.message.map(function(m) {
        return m.text || m.emojiText || '';
      }).join('');
    }

    var msg = {
      type: 'chat', platform: 'youtube',
      user: '@' + uid, nickname: nick, avatar: avatar,
      comment: text, channelId: author.channelId || '',
      isOwner: !!chatItem.isOwner,
      isModerator: !!chatItem.isModerator,
      isMembership: !!chatItem.isMembership
    };

    // Super Chat
    if (chatItem.superchat) {
      msg.type = 'superchat';
      msg.amount = chatItem.superchat.amount || '';
      msg.color = chatItem.superchat.color || '';
    }

    send(ws, msg);
  });

  // Start the connection
  yt.start().then(function(ok) {
    if (!ok) {
      console.error('[YouTube] Failed to start for ' + identifier);
      send(ws, { type: 'error', platform: 'youtube', message: 'Failed to connect. Check if the channel is live.' });
    }
  }).catch(function(err) {
    console.error('[YouTube] Start error:', err.message);
    send(ws, { type: 'error', platform: 'youtube', message: 'YouTube connection failed: ' + err.message });
  });
}

// ── WebSocket connection handler ─────────────────────────────────────────────
wss.on('connection', function(ws) {
  console.log('[WS] New client connected. Total:', wss.clients.size);

  ws.on('message', function(raw) {
    try {
      var msg = JSON.parse(raw);

      // ── TikTok connect ──
      if (msg.action === 'connect' && msg.username) {
        var uname = msg.username.replace(/^@/, '').trim();
        if (!uname) {
          send(ws, { type: 'error', message: 'Username is required.' });
          return;
        }
        var existing = sessions.get(ws);
        if (existing && existing.lastConnectAttempt && (Date.now() - existing.lastConnectAttempt < 10000)) {
          var wait = Math.ceil((10000 - (Date.now() - existing.lastConnectAttempt)) / 1000);
          send(ws, { type: 'error', platform: 'tiktok', message: 'Please wait ' + wait + 's before reconnecting.' });
          return;
        }
        console.log('[WS] Client wants TikTok @' + uname);
        connectTikTok(ws, uname);
      }

      // ── YouTube connect ──
      else if (msg.action === 'connectYouTube') {
        var channelId = (msg.channelId || '').trim();
        var liveId = (msg.liveId || '').trim();
        if (!channelId && !liveId) {
          send(ws, { type: 'error', platform: 'youtube', message: 'Channel ID or Live ID is required.' });
          return;
        }
        var existing = sessions.get(ws);
        if (existing && existing.lastConnectAttempt && (Date.now() - existing.lastConnectAttempt < 10000)) {
          var wait = Math.ceil((10000 - (Date.now() - existing.lastConnectAttempt)) / 1000);
          send(ws, { type: 'error', platform: 'youtube', message: 'Please wait ' + wait + 's before reconnecting.' });
          return;
        }
        console.log('[WS] Client wants YouTube ' + (liveId || channelId));
        connectYouTube(ws, channelId, liveId);
      }

      // ── Disconnect ──
      else if (msg.action === 'disconnect') {
        var platform = msg.platform || 'all';
        var session = sessions.get(ws);
        if (session) {
          if ((platform === 'all' || platform === 'tiktok') && session.tiktokConnection) {
            try { session.tiktokConnection.disconnect(); } catch (e) {}
            session.tiktokConnection = null;
          }
          if ((platform === 'all' || platform === 'youtube') && session.youtubeConnection) {
            try { session.youtubeConnection.stop(); } catch (e) {}
            session.youtubeConnection = null;
          }
          session.isConnected = false;
        }
        send(ws, { type: 'disconnected', platform: platform });
      }

      // ── Status ──
      else if (msg.action === 'status') {
        var session = sessions.get(ws);
        send(ws, {
          type: 'status',
          connected: !!(session && session.isConnected),
          platform: session ? session.platform : null,
          username: session ? session.username : null
        });
      }

    } catch (e) {
      console.error('[WS] Bad message:', e.message);
    }
  });

  ws.on('close', function() {
    var session = sessions.get(ws);
    if (session) {
      console.log('[WS] Client disconnected. Was on ' + (session.platform || '?') + ' @' + (session.username || '?'));
    }
    cleanupSession(ws);
    console.log('[WS] Clients remaining:', wss.clients.size);
  });

  ws.on('error', function(err) {
    console.error('[WS] Client error:', err.message);
  });
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', function(_req, res) {
  res.json({ status: 'ok', sessions: sessions.size, uptime: process.uptime() });
});

// ── Start server ─────────────────────────────────────────────────────────────
server.listen(PORT, function() {
  console.log('=== Pickaxe Drop Server ===');
  console.log('Game:      http://localhost:' + PORT);
  console.log('Platforms: TikTok + YouTube (no API key needed)');
  console.log('===========================');

  if (process.env.RENDER_EXTERNAL_URL) {
    setInterval(function() {
      var url = process.env.RENDER_EXTERNAL_URL + '/health';
      require('http').get(url.replace('https:', 'http:'), function() {}).on('error', function() {});
    }, 14 * 60 * 1000);
  }
});
