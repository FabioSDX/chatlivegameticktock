<?php
/**
 * Persistência das pontuações acumuladas dos jogadores.
 * GET  = retorna o conteúdo atual de data/persistent_scores.json
 * POST = grava o body (JSON) em data/persistent_scores.json
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$dir  = __DIR__ . '/data';
$file = $dir . '/persistent_scores.json';

if (!is_dir($dir)) {
    mkdir($dir, 0755, true);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!is_file($file)) {
        echo json_encode(new stdClass());
        exit;
    }
    $raw = file_get_contents($file);
    if ($raw === false || $raw === '') {
        echo json_encode(new stdClass());
        exit;
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        echo json_encode(new stdClass());
        exit;
    }
    echo json_encode($data);
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
    if (file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX) === false) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Erro ao gravar arquivo']);
        exit;
    }
    echo json_encode(['ok' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'error' => 'Método não permitido']);
