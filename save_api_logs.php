<?php
/**
 * Persistência dos logs de requisições da API em arquivo JSON.
 * GET  = retorna o conteúdo atual de data/api_logs.json
 * POST = adiciona uma nova entrada ao log em data/api_logs.json
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
$file = $dir . '/api_logs.json';

if (!is_dir($dir)) {
  mkdir($dir, 0755, true);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  if (!is_file($file)) {
    echo json_encode(['total_requests' => 0, 'logs' => []]);
    exit;
  }
  $raw = file_get_contents($file);
  if ($raw === false || $raw === '') {
    echo json_encode(['total_requests' => 0, 'logs' => []]);
    exit;
  }
  $data = json_decode($raw, true);
  if (!is_array($data)) {
    echo json_encode(['total_requests' => 0, 'logs' => []]);
    exit;
  }
  echo json_encode([
    'total_requests' => isset($data['total_requests']) ? $data['total_requests'] : 0,
    'logs' => isset($data['logs']) && is_array($data['logs']) ? $data['logs'] : [],
  ]);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $body = file_get_contents('php://input');
  $newLog = json_decode($body, true);
  if (!is_array($newLog) || !isset($newLog['timestamp'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Log inválido']);
    exit;
  }

  // Carrega dados existentes
  $data = [];
  if (is_file($file)) {
    $raw = file_get_contents($file);
    if ($raw !== false && $raw !== '') {
      $data = json_decode($raw, true);
      if (!is_array($data)) {
        $data = [];
      }
    }
  }

  // Inicializa se necessário
  if (!isset($data['total_requests'])) {
    $data['total_requests'] = 0;
  }
  if (!isset($data['logs'])) {
    $data['logs'] = [];
  }

  // Adiciona novo log
  $data['logs'][] = $newLog;
  $data['total_requests']++;

  // Mantém apenas os últimos 100 logs para não crescer demais
  if (count($data['logs']) > 100) {
    $data['logs'] = array_slice($data['logs'], -100);
  }

  if (file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Erro ao gravar arquivo']);
    exit;
  }
  echo json_encode(['ok' => true]);
  exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'error' => 'Método não permitido']);
?></content>
<parameter name="filePath">c:\laragon8\www\jogointerativo\save_api_logs.php