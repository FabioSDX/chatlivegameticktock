const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Serve static files (game assets)
app.use(express.static('.'));

let tiktokConnection = null;
let currentUsername = '';
let isConnected = false;

// Broadcast to all connected browser clients
function broadcast(data) {
  const msg = JSON.stringify(data);
  let sent = 0;
  wss.clients.forEach(client => {
    if (client.readyState === 1) { client.send(msg); sent++; }
  });
  if (data.type === 'chat' || data.type === 'like' || data.type === 'member') {
    console.log(`📡 Broadcast ${data.type} to ${sent} client(s)`);
  }
}

function connectTikTok(username, retryMode) {
  if (tiktokConnection) {
    try { tiktokConnection.disconnect(); } catch (e) {}
  }

  currentUsername = username;

  const options = {
    processInitialData: true,
    enableExtendedGiftInfo: true,
    fetchRoomInfoOnConnect: true,
    requestPollingIntervalMs: 1000
  };

  // retryMode: undefined = first attempt (bypass), 'direct' = direct scraping, 'polling' = request polling
  if (!retryMode) {
    options.connectWithUniqueId = true;
  }

  // If a sessionId is set via env var, use request polling
  if (process.env.TIKTOK_SESSION_ID) {
    options.sessionId = process.env.TIKTOK_SESSION_ID;
  }

  // If a Sign API key is set via env var, use it for higher rate limits
  if (process.env.TIKTOK_SIGN_KEY) {
    options.signApiKey = process.env.TIKTOK_SIGN_KEY;
  }

  console.log(`Connecting to TikTok @${username} (mode: ${retryMode || 'bypass'}, sessionId: ${options.sessionId ? 'yes' : 'no'})`);
  tiktokConnection = new WebcastPushConnection(username, options);

  tiktokConnection.connect().then(state => {
    isConnected = true;
    console.log(`Connected to TikTok @${username} (roomId: ${state.roomId})`);
    broadcast({
      type: 'connected',
      username: username,
      roomId: state.roomId
    });
  }).catch(err => {
    isConnected = false;
    const msg = err.message || String(err);
    console.error('TikTok connection failed:', msg);

    // Retry chain: bypass -> direct -> polling (if sessionId available)
    if (!retryMode && (msg.includes('user_not_found') || msg.includes('not_found'))) {
      console.log('Retrying with direct scraping...');
      broadcast({ type: 'status', connected: false, username, message: 'Retrying connection...' });
      connectTikTok(username, 'direct');
      return;
    }

    if (retryMode !== 'polling' && msg.includes('websocket upgrade')) {
      console.log('WebSocket upgrade rejected. Retrying with request polling...');
      broadcast({ type: 'status', connected: false, username, message: 'Retrying with polling...' });
      connectTikTok(username, 'polling');
      return;
    }

    let userMsg = msg;
    if (msg.includes('user_not_found')) {
      userMsg = 'User not found or not currently live. Check the username and make sure the stream is active.';
    } else if (msg.includes('LIVE has ended')) {
      userMsg = 'This user is not currently live.';
    } else if (msg.includes('rate') || msg.includes('429')) {
      userMsg = 'Rate limited. Wait a moment and try again.';
    } else if (msg.includes('websocket upgrade')) {
      userMsg = 'TikTok blocked the connection. Set TIKTOK_SESSION_ID env var with your browser session cookie to use polling mode.';
    }

    broadcast({ type: 'error', message: userMsg });
  });

  // Chat messages
  tiktokConnection.on('chat', data => {
    const user = data.user || {};
    const uniqueId = (user.uniqueId || data.uniqueId || '').toLowerCase();
    const nickname = user.nickname || data.nickname || '';
    const comment = data.comment || '';
    const effectiveUser = uniqueId || nickname.toLowerCase() || currentUsername.toLowerCase();
    console.log(`💬 Chat: @${effectiveUser}${nickname ? ' (' + nickname + ')' : ''}: "${comment}"`);
    broadcast({
      type: 'chat',
      user: effectiveUser,
      nickname: nickname || effectiveUser,
      comment: comment,
      avatar: user.profilePictureUrl || data.profilePictureUrl || '',
      userId: user.userId || data.userId || ''
    });
  });

  // New viewer joins
  tiktokConnection.on('member', data => {
    const user = data.user || {};
    const effectiveUser = user.uniqueId || data.uniqueId || user.nickname || data.nickname || '';
    if (!effectiveUser) return; // skip anonymous viewers
    console.log(`👋 Member joined: @${effectiveUser}`);
    broadcast({
      type: 'member',
      user: effectiveUser,
      nickname: user.nickname || data.nickname || effectiveUser,
      avatar: user.profilePictureUrl || data.profilePictureUrl || ''
    });
  });

  // Gifts
  tiktokConnection.on('gift', data => {
    if (data.giftType === 1 && !data.repeatEnd) return;
    const user = data.user || {};
    const ext = data.extendedGiftInfo || {};
    const effectiveUser = user.uniqueId || data.uniqueId || user.nickname || data.nickname || '';
    broadcast({
      type: 'gift',
      user: effectiveUser,
      nickname: user.nickname || data.nickname || effectiveUser,
      avatar: user.profilePictureUrl || data.profilePictureUrl || '',
      giftId: data.giftId,
      giftName: ext.name || data.describe || '',
      diamondCount: ext.diamond_count || data.diamondCount || 0,
      repeatCount: data.repeatCount || 1
    });
  });

  // Likes
  tiktokConnection.on('like', data => {
    const user = data.user || {};
    const effectiveUser = user.uniqueId || data.uniqueId || user.nickname || data.nickname || '';
    if (!effectiveUser) {
      console.log('Like event without user identity, skipping');
      return;
    }
    console.log(`❤ Like from @${effectiveUser} (x${data.likeCount || 1})`);
    broadcast({
      type: 'like',
      user: effectiveUser,
      nickname: user.nickname || data.nickname || effectiveUser,
      avatar: user.profilePictureUrl || data.profilePictureUrl || '',
      likeCount: data.likeCount || 1,
      totalLikes: data.totalLikeCount || 0
    });
  });

  // Social events (follow, share)
  tiktokConnection.on('social', data => {
    const user = data.user || {};
    const effectiveUser = user.uniqueId || data.uniqueId || user.nickname || data.nickname || '';
    const display = (data.displayType || '').toLowerCase();
    if (display.includes('follow')) {
      broadcast({
        type: 'follow',
        user: effectiveUser,
        nickname: user.nickname || data.nickname || effectiveUser,
        avatar: user.profilePictureUrl || ''
      });
    } else if (display.includes('share')) {
      broadcast({
        type: 'share',
        user: effectiveUser,
        nickname: user.nickname || data.nickname || effectiveUser,
        avatar: user.profilePictureUrl || ''
      });
    }
  });

  // Follow event (custom event from library)
  tiktokConnection.on('follow', data => {
    const user = data.user || {};
    const effectiveUser = user.uniqueId || data.uniqueId || user.nickname || data.nickname || '';
    broadcast({
      type: 'follow',
      user: effectiveUser,
      nickname: user.nickname || data.nickname || effectiveUser,
      avatar: user.profilePictureUrl || ''
    });
  });

  // Share event (custom event from library)
  tiktokConnection.on('share', data => {
    const user = data.user || {};
    const effectiveUser = user.uniqueId || data.uniqueId || user.nickname || data.nickname || '';
    broadcast({
      type: 'share',
      user: effectiveUser,
      nickname: user.nickname || data.nickname || effectiveUser,
      avatar: user.profilePictureUrl || ''
    });
  });

  // Viewer count
  tiktokConnection.on('roomUser', data => {
    broadcast({
      type: 'roomUser',
      viewerCount: data.viewerCount
    });
  });

  // Stream ended
  tiktokConnection.on('streamEnd', () => {
    isConnected = false;
    broadcast({ type: 'streamEnd' });
    console.log('TikTok stream ended');
  });

  // Disconnected
  tiktokConnection.on('disconnected', () => {
    isConnected = false;
    broadcast({ type: 'disconnected' });
    console.log('Disconnected from TikTok');
  });

  tiktokConnection.on('error', err => {
    console.error('TikTok error:', err.info || err.message || err);
    broadcast({ type: 'error', message: err.message || String(err) });
  });

  // Debug: log all raw decoded events to see what TikTok is actually sending
  tiktokConnection.on('rawData', (msgType, data) => {
    if (!['WebcastResponseMessage', 'WebcastControlMessage'].includes(msgType)) {
      console.log(`📦 Raw event: ${msgType}`);
    }
  });
}

// Handle browser WebSocket connections
wss.on('connection', ws => {
  console.log('Browser client connected. Total clients:', wss.clients.size);

  // Send current status
  ws.send(JSON.stringify({
    type: 'status',
    connected: isConnected,
    username: currentUsername
  }));

  ws.on('message', raw => {
    try {
      const msg = JSON.parse(raw);
      if (msg.action === 'connect' && msg.username) {
        connectTikTok(msg.username.replace('@', ''));
      } else if (msg.action === 'disconnect') {
        if (tiktokConnection) {
          try { tiktokConnection.disconnect(); } catch (e) {}
          tiktokConnection = null;
          isConnected = false;
          broadcast({ type: 'disconnected' });
        }
      }
    } catch (e) {}
  });

  ws.on('close', () => {
    console.log('Browser client disconnected. Total clients:', wss.clients.size);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Pickaxe Drop server running at http://localhost:${PORT}`);
});
