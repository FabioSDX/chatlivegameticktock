<?php
/**
 * Ranking de campeões de todos os tempos.
 * GET  → retorna top 10 do ranking
 * POST → registra uma vitória { user, avatarUrl }
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$dir  = __DIR__ . '/data';
$file = $dir . '/ranking.json';
if (!is_dir($dir)) mkdir($dir, 0755, true);

function loadRanking($file) {
    if (!is_file($file)) return [];
    $raw = file_get_contents($file);
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $ranking = loadRanking($file);
    // Ordena por pontos desc, depois por vitórias, depois por último win
    usort($ranking, fn($a,$b) => ($b['points'] ?? 0) <=> ($a['points'] ?? 0)
        ?: $b['wins'] <=> $a['wins']
        ?: $b['lastWin'] <=> $a['lastWin']);
    echo json_encode(['ok' => true, 'ranking' => array_slice($ranking, 0, 10)]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    if (empty($body['user'])) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'user obrigatório']);
        exit;
    }

    $ranking  = loadRanking($file);
    $user     = trim($body['user']);
    $avatar   = trim($body['avatarUrl'] ?? '');
    $pts      = max(0, (int)($body['points'] ?? 0));
    $now      = time();

    // Procura entrada existente
    $found = false;
    foreach ($ranking as &$entry) {
        if ($entry['user'] === $user) {
            $entry['wins']++;
            $entry['points'] = ($entry['points'] ?? 0) + $pts;
            $entry['lastWin'] = $now;
            if ($avatar) $entry['avatarUrl'] = $avatar;
            $found = true;
            break;
        }
    }
    unset($entry);

    if (!$found) {
        $ranking[] = ['user' => $user, 'avatarUrl' => $avatar, 'wins' => 1, 'points' => $pts, 'lastWin' => $now];
    }

    if (file_put_contents($file, json_encode($ranking, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX) === false) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Erro ao gravar']);
        exit;
    }

    // Retorna ranking atualizado
    usort($ranking, fn($a,$b) => ($b['points'] ?? 0) <=> ($a['points'] ?? 0)
        ?: $b['wins'] <=> $a['wins']
        ?: $b['lastWin'] <=> $a['lastWin']);
    echo json_encode(['ok' => true, 'ranking' => array_slice($ranking, 0, 10)]);
    exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'error' => 'Método não permitido']);
