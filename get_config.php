<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

$config = [];
foreach (file('config.txt', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
    $line = trim($line);
    if ($line === '' || $line[0] === ';') continue;
    [$key, $val] = array_pad(explode('=', $line, 2), 2, '');
    $config[trim($key)] = trim($val);
}

echo json_encode([
    'pickaxe_change_interval' => (int)($config['PICKAXE_CHANGE_INTERVAL'] ?? 10),
    'owner_name' => $config['OWNER_NAME'] ?? ''
]);
