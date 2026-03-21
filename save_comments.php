<?php
/**
 * Persistência dos comentários em arquivo de texto (JSON).
 * GET  = retorna o conteúdo atual de data/comments.json
 * POST = grava o body (JSON) em data/comments.json
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
$file = $dir . '/comments.json';

if (!is_dir($dir)) {
  mkdir($dir, 0755, true);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  if (!is_file($file)) {
    echo json_encode(['comments' => []]);
    exit;
  }
  $raw = file_get_contents($file);
  if ($raw === false || $raw === '') {
    echo json_encode(['comments' => []]);
    exit;
  }
  $data = json_decode($raw, true);
  if (!is_array($data)) {
    echo json_encode(['comments' => []]);
    exit;
  }
  echo json_encode([
    'comments' => isset($data['comments']) && is_array($data['comments']) ? $data['comments'] : [],
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
    'comments' => isset($data['comments']) && is_array($data['comments']) ? $data['comments'] : [],
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