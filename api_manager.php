<?php
/**
 * api_manager.php
 * Manages YouTube API keys per user (channel owner).
 * Actions: test_key, register_key, get_keys, remove_key, rotate
 *
 * Each user is identified by their YouTube channel ID.
 * Keys are bound to the channel that owns them (verified via YouTube API).
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$dir = __DIR__ . '/data';
if (!is_dir($dir)) mkdir($dir, 0755, true);
$apiFile = $dir . '/user_apis.json';

$httpCtx = stream_context_create([
    'http' => ['timeout' => 8, 'ignore_errors' => true],
    'ssl'  => ['verify_peer' => false, 'verify_peer_name' => false],
]);

// Load existing data
$allData = [];
if (file_exists($apiFile)) {
    $raw = json_decode(file_get_contents($apiFile), true);
    if (is_array($raw)) $allData = $raw;
}

function saveData($file, $data) {
    file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
}

function ytGetRaw(string $url, $ctx): array {
    $raw = @file_get_contents($url, false, $ctx);
    $data = $raw ? json_decode($raw, true) : null;
    return is_array($data) ? $data : [];
}

// Parse input
$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) $input = [];
$action = $input['action'] ?? ($_GET['action'] ?? '');

/**
 * Test an API key: verify it works and get the channel info it belongs to.
 * Returns { ok, channelId, channelTitle, error }
 */
function testApiKey($apiKey, $ctx) {
    // Use videoCategories.list — cheapest call (1 unit), works with API key, no OAuth needed
    $url = 'https://www.googleapis.com/youtube/v3/videoCategories?part=snippet&regionCode=US&key=' . urlencode($apiKey);
    $raw = @file_get_contents($url, false, $ctx);
    if ($raw === false) return ['ok' => false, 'error' => 'Connection failed'];
    $data = json_decode($raw, true);
    if (!is_array($data)) return ['ok' => false, 'error' => 'Invalid response'];
    if (!empty($data['error'])) {
        $code = $data['error']['code'] ?? 0;
        $msg = $data['error']['message'] ?? 'Unknown error';
        if ($code == 400 && (strpos($msg, 'API key not valid') !== false || strpos($msg, 'keyInvalid') !== false)) {
            return ['ok' => false, 'error' => 'API key is not valid'];
        }
        if ($code == 403 && stripos($msg, 'quota') !== false) {
            return ['ok' => false, 'error' => 'Quota exceeded for this key', 'quota_exceeded' => true];
        }
        if ($code == 403) {
            return ['ok' => false, 'error' => "Access denied ($code): $msg"];
        }
        return ['ok' => false, 'error' => "API error ($code): $msg"];
    }
    return ['ok' => true];
}

/**
 * Verify channel ownership: check that the channel exists
 */
function verifyChannel($channelId, $apiKey, $ctx) {
    $url = 'https://www.googleapis.com/youtube/v3/channels?part=snippet&id=' . urlencode($channelId) . '&key=' . urlencode($apiKey);
    $raw = @file_get_contents($url, false, $ctx);
    if ($raw === false) return ['ok' => false, 'error' => 'Connection failed'];
    $data = json_decode($raw, true);
    if (!is_array($data)) return ['ok' => false, 'error' => 'Invalid response'];
    if (!empty($data['error'])) {
        return ['ok' => false, 'error' => $data['error']['message'] ?? 'API error'];
    }
    if (empty($data['items'])) return ['ok' => false, 'error' => 'Channel not found'];
    $title = $data['items'][0]['snippet']['title'] ?? '';
    $thumb = $data['items'][0]['snippet']['thumbnails']['default']['url'] ?? '';
    return ['ok' => true, 'channelTitle' => $title, 'channelThumb' => $thumb];
}


// ── ACTION: test_key ──
// Tests if an API key is valid and verifies the channel
if ($action === 'test_key') {
    $apiKey = trim($input['api_key'] ?? '');
    $channelId = trim($input['channel_id'] ?? '');
    if (empty($apiKey)) { echo json_encode(['ok' => false, 'error' => 'API key is required']); exit; }
    if (empty($channelId)) { echo json_encode(['ok' => false, 'error' => 'Channel ID is required']); exit; }

    $test = testApiKey($apiKey, $httpCtx);
    if (!$test['ok']) { echo json_encode($test); exit; }

    $ch = verifyChannel($channelId, $apiKey, $httpCtx);
    if (!$ch['ok']) { echo json_encode($ch); exit; }

    echo json_encode([
        'ok' => true,
        'channelTitle' => $ch['channelTitle'] ?? '',
        'channelThumb' => $ch['channelThumb'] ?? ''
    ]);
    exit;
}

// ── ACTION: register_key ──
// Registers an API key for a user (channel)
if ($action === 'register_key') {
    $apiKey = trim($input['api_key'] ?? '');
    $channelId = trim($input['channel_id'] ?? '');
    if (empty($apiKey) || empty($channelId)) {
        echo json_encode(['ok' => false, 'error' => 'API key and Channel ID are required']);
        exit;
    }

    // Test first
    $test = testApiKey($apiKey, $httpCtx);
    if (!$test['ok']) { echo json_encode($test); exit; }

    // Init user entry
    if (!isset($allData[$channelId])) {
        $allData[$channelId] = ['channelId' => $channelId, 'apis' => []];
    }

    // Check if key already registered
    $exists = false;
    foreach ($allData[$channelId]['apis'] as &$entry) {
        if ($entry['key'] === $apiKey) {
            $entry['status'] = 'ok';
            $entry['lastError'] = '';
            $entry['testedAt'] = time();
            $exists = true;
            break;
        }
    }
    unset($entry);

    if (!$exists) {
        $allData[$channelId]['apis'][] = [
            'key' => $apiKey,
            'status' => 'ok',
            'lastError' => '',
            'addedAt' => time(),
            'testedAt' => time()
        ];
    }

    saveData($apiFile, $allData);
    echo json_encode(['ok' => true, 'totalKeys' => count($allData[$channelId]['apis'])]);
    exit;
}

// ── ACTION: get_keys ──
// Returns all keys for a channel (masked for security)
if ($action === 'get_keys') {
    $channelId = trim($input['channel_id'] ?? ($_GET['channel_id'] ?? ''));
    if (empty($channelId)) { echo json_encode(['ok' => false, 'error' => 'Channel ID required']); exit; }

    $userData = $allData[$channelId] ?? null;
    if (!$userData || empty($userData['apis'])) {
        echo json_encode(['ok' => true, 'keys' => [], 'activeKey' => '']);
        exit;
    }

    $masked = [];
    foreach ($userData['apis'] as $entry) {
        $k = $entry['key'];
        $masked[] = [
            'keyMasked' => substr($k, 0, 8) . '...' . substr($k, -4),
            'status' => $entry['status'],
            'lastError' => $entry['lastError'] ?? '',
        ];
    }

    // Find active (first 'ok' key)
    $activeKey = '';
    foreach ($userData['apis'] as $entry) {
        if ($entry['status'] === 'ok') { $activeKey = $entry['key']; break; }
    }

    echo json_encode(['ok' => true, 'keys' => $masked, 'activeKey' => $activeKey]);
    exit;
}

// ── ACTION: remove_key ──
if ($action === 'remove_key') {
    $apiKey = trim($input['api_key'] ?? '');
    $channelId = trim($input['channel_id'] ?? '');
    if (empty($apiKey) || empty($channelId)) {
        echo json_encode(['ok' => false, 'error' => 'API key and Channel ID required']);
        exit;
    }
    if (isset($allData[$channelId])) {
        $allData[$channelId]['apis'] = array_values(array_filter(
            $allData[$channelId]['apis'],
            function($e) use ($apiKey) { return $e['key'] !== $apiKey; }
        ));
        saveData($apiFile, $allData);
    }
    echo json_encode(['ok' => true]);
    exit;
}

// ── ACTION: rotate ──
// When a key fails (quota), mark it and try the next one
if ($action === 'rotate') {
    $channelId = trim($input['channel_id'] ?? '');
    $failedKey = trim($input['failed_key'] ?? '');
    $errorMsg = trim($input['error'] ?? 'quota_exceeded');
    if (empty($channelId)) { echo json_encode(['ok' => false, 'error' => 'Channel ID required']); exit; }

    $userData = $allData[$channelId] ?? null;
    if (!$userData || empty($userData['apis'])) {
        echo json_encode(['ok' => false, 'error' => 'No keys registered', 'needNewKey' => true]);
        exit;
    }

    // Mark failed key
    foreach ($allData[$channelId]['apis'] as &$entry) {
        if ($entry['key'] === $failedKey) {
            $entry['status'] = 'error';
            $entry['lastError'] = $errorMsg;
            break;
        }
    }
    unset($entry);

    // Try to find another working key
    foreach ($allData[$channelId]['apis'] as &$entry) {
        if ($entry['status'] === 'ok' && $entry['key'] !== $failedKey) {
            saveData($apiFile, $allData);
            echo json_encode(['ok' => true, 'activeKey' => $entry['key']]);
            exit;
        }
    }
    unset($entry);

    // All keys marked as error — test them all to see if any recovered
    foreach ($allData[$channelId]['apis'] as &$entry) {
        $test = testApiKey($entry['key'], $httpCtx);
        if ($test['ok']) {
            $entry['status'] = 'ok';
            $entry['lastError'] = '';
            $entry['testedAt'] = time();
            saveData($apiFile, $allData);
            echo json_encode(['ok' => true, 'activeKey' => $entry['key'], 'recovered' => true]);
            exit;
        }
    }
    unset($entry);

    saveData($apiFile, $allData);
    echo json_encode(['ok' => false, 'error' => 'All keys exhausted', 'needNewKey' => true]);
    exit;
}

// ── ACTION: get_active_key ──
// Returns the current active key and persisted liveChatId
if ($action === 'get_active_key') {
    $channelId = trim($input['channel_id'] ?? ($_GET['channel_id'] ?? ''));
    if (empty($channelId)) { echo json_encode(['ok' => false, 'error' => 'Channel ID required']); exit; }

    $userData = $allData[$channelId] ?? null;
    if (!$userData || empty($userData['apis'])) {
        echo json_encode(['ok' => false, 'activeKey' => '', 'needSetup' => true]);
        exit;
    }

    foreach ($userData['apis'] as $entry) {
        if ($entry['status'] === 'ok') {
            echo json_encode([
                'ok' => true,
                'activeKey' => $entry['key'],
                'liveChatId' => $userData['liveChatId'] ?? ''
            ]);
            exit;
        }
    }

    echo json_encode(['ok' => false, 'activeKey' => '', 'allExhausted' => true]);
    exit;
}

// ── ACTION: resolve_live ──
// Resolves liveChatId via search+videos (101 units) and persists it per user.
// Only called once when user clicks "Find Live" or on first connect.
if ($action === 'resolve_live') {
    $channelId = trim($input['channel_id'] ?? '');
    $apiKey = trim($input['api_key'] ?? '');
    if (empty($channelId) || empty($apiKey)) {
        echo json_encode(['ok' => false, 'error' => 'channel_id and api_key required']);
        exit;
    }

    // Step 1: search for active live (100 units)
    $searchUrl = 'https://www.googleapis.com/youtube/v3/search'
        . '?part=id&channelId=' . urlencode($channelId)
        . '&eventType=live&type=video'
        . '&key=' . urlencode($apiKey);
    $searchData = ytGetRaw($searchUrl, $httpCtx);

    if (!empty($searchData['error'])) {
        $code = $searchData['error']['code'] ?? 0;
        $msg = $searchData['error']['message'] ?? 'Unknown error';
        echo json_encode(['ok' => false, 'error' => "API error ($code): $msg"]);
        exit;
    }
    if (empty($searchData['items'])) {
        // No live — clear persisted liveChatId
        if (isset($allData[$channelId])) {
            $allData[$channelId]['liveChatId'] = '';
            saveData($apiFile, $allData);
        }
        echo json_encode(['ok' => true, 'liveChatId' => '', 'liveStatus' => 'offline']);
        exit;
    }

    $videoId = $searchData['items'][0]['id']['videoId'] ?? '';
    if (empty($videoId)) {
        echo json_encode(['ok' => false, 'error' => 'Could not extract videoId']);
        exit;
    }

    // Step 2: get liveChatId from video (1 unit)
    $videoUrl = 'https://www.googleapis.com/youtube/v3/videos'
        . '?part=liveStreamingDetails&id=' . urlencode($videoId)
        . '&key=' . urlencode($apiKey);
    $videoData = ytGetRaw($videoUrl, $httpCtx);
    $liveChatId = $videoData['items'][0]['liveStreamingDetails']['activeLiveChatId'] ?? '';

    if (empty($liveChatId)) {
        echo json_encode(['ok' => true, 'liveChatId' => '', 'liveStatus' => 'offline', 'note' => 'Live found but chat not active']);
        exit;
    }

    // Persist liveChatId for this user
    if (!isset($allData[$channelId])) {
        $allData[$channelId] = ['channelId' => $channelId, 'apis' => []];
    }
    $allData[$channelId]['liveChatId'] = $liveChatId;
    saveData($apiFile, $allData);

    echo json_encode(['ok' => true, 'liveChatId' => $liveChatId, 'liveStatus' => 'online']);
    exit;
}

// ── ACTION: clear_live ──
// Clears persisted liveChatId (when live ends or chat errors)
if ($action === 'clear_live') {
    $channelId = trim($input['channel_id'] ?? '');
    if (!empty($channelId) && isset($allData[$channelId])) {
        $allData[$channelId]['liveChatId'] = '';
        saveData($apiFile, $allData);
    }
    echo json_encode(['ok' => true]);
    exit;
}

echo json_encode(['ok' => false, 'error' => 'Unknown action: ' . $action]);
