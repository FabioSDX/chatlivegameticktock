<?php
/**
 * Limpa os comentários salvos (usado no restart da partida).
 * Supports per-channel comment files.
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$channelId = trim($_GET['channel_id'] ?? '');
$dir = __DIR__ . '/data';
$empty = json_encode(['comments' => []], JSON_PRETTY_PRINT);

// Clear channel-specific file if channel_id provided
if (!empty($channelId)) {
    $file = $dir . '/comments_' . md5($channelId) . '.json';
    file_put_contents($file, $empty, LOCK_EX);
}

// Also clear legacy file for backwards compatibility
$legacyFile = $dir . '/comments.json';
if (file_exists($legacyFile)) {
    file_put_contents($legacyFile, $empty, LOCK_EX);
}

echo json_encode(['ok' => true, 'message' => 'Comments cleared']);
