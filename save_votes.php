<?php
/**
 * Persistência dos votos em arquivo de texto (JSON).
 * GET  = retorna o conteúdo atual de data/votes.json
 * POST = grava o body (JSON) em data/votes.json
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

$dir = __DIR__ . '/data';
$file = $dir . '/votes.json';

if (!is_dir($dir)) {
  mkdir($dir, 0755, true);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  if (!is_file($file)) {
    echo json_encode(['counts' => [], 'userVotes' => [], 'logEntries' => []]);
    exit;
  }
  $raw = file_get_contents($file);
  if ($raw === false || $raw === '') {
    echo json_encode(['counts' => [], 'userVotes' => [], 'logEntries' => []]);
    exit;
  }
  $data = json_decode($raw, true);
  if (!is_array($data)) {
    echo json_encode(['counts' => [], 'userVotes' => [], 'logEntries' => []]);
    exit;
  }
  echo json_encode([
    'counts' => isset($data['counts']) && is_array($data['counts']) ? $data['counts'] : [],
    'userVotes' => isset($data['userVotes']) && is_array($data['userVotes']) ? $data['userVotes'] : [],
    'logEntries' => isset($data['logEntries']) && is_array($data['logEntries']) ? $data['logEntries'] : [],
  ]);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $body = file_get_contents('php://input');
  $data = json_decode($body, true);
  if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'JSON inválido']);
    exit;
  }
  $out = [
    'counts' => isset($data['counts']) && is_array($data['counts']) ? $data['counts'] : [],
    'userVotes' => isset($data['userVotes']) && is_array($data['userVotes']) ? $data['userVotes'] : [],
    'logEntries' => isset($data['logEntries']) && is_array($data['logEntries']) ? $data['logEntries'] : [],
  ];
  if (file_put_contents($file, json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Erro ao gravar arquivo']);
    exit;
  }
  echo json_encode(['ok' => true]);
  exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'error' => 'Método não permitido']);
