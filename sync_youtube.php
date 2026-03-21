<?php
/**
 * sync_youtube.php
 * Busca mensagens do chat ao vivo do YouTube e salva localmente.
 * Suporta LIVE_CHAT_ID=AUTO com cache de 1 hora para o search (100 unidades/req).
 * Throttle de 4s entre chamadas ao liveChat/messages (1 unidade/req).
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$httpContext = stream_context_create([
    'http' => ['timeout' => 6, 'ignore_errors' => true],
    'ssl'  => ['verify_peer' => false, 'verify_peer_name' => false],
]);

function ytGet(string $url, $ctx): ?array {
    $raw = @file_get_contents($url, false, $ctx);
    if ($raw === false) return null;
    global $http_response_header;
    if (isset($http_response_header)) {
        foreach ($http_response_header as $h) {
            if (preg_match('#^HTTP/\S+\s+[45]\d\d#', $h)) return null;
        }
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : null;
}

function ytGetRaw(string $url, $ctx): array {
    $raw = @file_get_contents($url, false, $ctx);
    $data = $raw ? json_decode($raw, true) : null;
    return is_array($data) ? $data : [];
}

function returnError(string $msg, array &$state, string $stateFile, string $commentsFile, string $errorType = 'api'): void {
    file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT));
    $payload = ['comments' => [], 'apiStatus' => 'error', 'apiError' => $msg, 'errorType' => $errorType,
                 'liveStatus' => 'unknown',
                 'totalRequests' => $state['totalRequests'] ?? 0];
    if (file_exists($commentsFile)) {
        $saved = json_decode(file_get_contents($commentsFile), true);
        if (is_array($saved) && isset($saved['comments'])) $payload['comments'] = $saved['comments'];
    }
    echo json_encode($payload);
    exit;
}

//  Config 
$configFile = __DIR__ . '/config.txt';
if (!file_exists($configFile)) {
    echo json_encode(['error' => 'config.txt nao encontrado', 'apiStatus' => 'error']);
    exit;
}
$config        = parse_ini_file($configFile, false, INI_SCANNER_RAW);
$apiKey        = trim($_GET['api_key'] ?? '');
$channelId     = trim($_GET['channel_id'] ?? '');
$liveChatIdParam = trim($_GET['live_chat_id'] ?? '');
$liveChatIdCfg = trim($config['LIVE_CHAT_ID'] ?? 'AUTO');

if (empty($apiKey)) {
    echo json_encode(['error' => 'API_KEY nao configurada', 'apiStatus' => 'error']);
    exit;
}

//  Estado 
$dir = __DIR__ . '/data';
if (!is_dir($dir)) mkdir($dir, 0755, true);
$stateFile    = $dir . '/youtube_state_' . md5($channelId) . '.json';
$commentsFile = $dir . '/comments_' . md5($channelId) . '.json';

$state = [
    'lastFetchTime'  => 0,
    'lastMessageId'  => null,
    'nextPageToken'  => null,
    'lastLiveChatId' => '',
    'resolvedChatId' => '',
    'resolvedAt'     => 0,
    'totalRequests'  => 0,
];
if (file_exists($stateFile)) {
    $saved = json_decode(file_get_contents($stateFile), true);
    if (is_array($saved)) $state = array_merge($state, $saved);
}
$state['totalRequests']++;

//  Throttle: minimo 8s entre chamadas ao liveChat/messages 
$timeSinceLast = time() - (int)($state['lastFetchTime'] ?? 0);
if ($timeSinceLast < 8) {
    // Retorna cache sem chamar a API
    $commentsData = ['comments' => []];
    if (file_exists($commentsFile)) {
        $cur = json_decode(file_get_contents($commentsFile), true);
        if (is_array($cur) && isset($cur['comments'])) $commentsData['comments'] = $cur['comments'];
    }
    $commentsData['apiStatus']     = 'ok';
    $commentsData['liveStatus']    = !empty($state['resolvedChatId']) ? 'online' : 'offline';
    $commentsData['cached']        = true;
    $commentsData['totalRequests'] = $state['totalRequests'];
    $commentsData['liveChatId']    = $state['resolvedChatId'] ?: $liveChatIdCfg;
    file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT));
    echo json_encode($commentsData);
    exit;
}

//  Resolver liveChatId 
$liveChatId = '';

// If frontend provides a persisted liveChatId, use it directly (0 API calls)
if (!empty($liveChatIdParam)) {
    $liveChatId = $liveChatIdParam;
    if ($state['lastLiveChatId'] !== $liveChatId) {
        $state['nextPageToken']  = null;
        $state['lastMessageId']  = null;
        $state['lastLiveChatId'] = $liveChatId;
    }
} elseif (strtoupper($liveChatIdCfg) !== 'AUTO') {
    // Explicit liveChatId in config.txt
    $liveChatId = $liveChatIdCfg;
    if ($state['lastLiveChatId'] !== $liveChatId) {
        $state['nextPageToken']  = null;
        $state['lastMessageId']  = null;
        $state['lastLiveChatId'] = $liveChatId;
        $state['resolvedChatId'] = '';
    }
} else {
    // AUTO mode fallback — only if frontend didn't provide liveChatId
    // This path should rarely be hit now since frontend resolves via api_manager
    $cacheAge = time() - (int)($state['resolvedAt'] ?? 0);
    if (!empty($state['resolvedChatId']) && $cacheAge < 7200) {
        $liveChatId = $state['resolvedChatId'];
    } elseif (isset($state['noLiveAt']) && (time() - $state['noLiveAt'] < 120)) {
        $state['lastFetchTime'] = time();
        file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT));
        $commentsData = ['comments' => []];
        if (file_exists($commentsFile)) {
            $cur = json_decode(file_get_contents($commentsFile), true);
            if (is_array($cur) && isset($cur['comments'])) $commentsData['comments'] = $cur['comments'];
        }
        $commentsData['apiStatus'] = 'ok';
        $commentsData['liveStatus'] = 'offline';
        $commentsData['totalRequests'] = $state['totalRequests'];
        echo json_encode($commentsData);
        exit;
    } else {
        if (empty($channelId)) {
            returnError('CHANNEL_ID nao configurado (necessario para AUTO)', $state, $stateFile, $commentsFile, 'api');
        }
        $searchUrl = 'https://www.googleapis.com/youtube/v3/search'
            . '?part=id&channelId=' . urlencode($channelId)
            . '&eventType=live&type=video'
            . '&key=' . urlencode($apiKey);
        $searchData = ytGetRaw($searchUrl, $httpContext);

        if (!empty($searchData['error'])) {
            $code = $searchData['error']['code'] ?? 0;
            $msg  = $searchData['error']['message'] ?? 'Erro desconhecido';
            if ($code == 403 && strpos($msg, 'quota') !== false) {
                returnError("Cota da API esgotada. Erro: $msg", $state, $stateFile, $commentsFile, 'quota');
            }
            returnError("Erro API search ($code): $msg", $state, $stateFile, $commentsFile, 'api');
        }
        if (empty($searchData['items'])) {
            $state['lastFetchTime'] = time();
            $state['resolvedChatId'] = '';
            $state['noLiveAt'] = time();
            file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT));
            $commentsData = ['comments' => []];
            if (file_exists($commentsFile)) {
                $cur = json_decode(file_get_contents($commentsFile), true);
                if (is_array($cur) && isset($cur['comments'])) $commentsData['comments'] = $cur['comments'];
            }
            $commentsData['apiStatus'] = 'ok';
            $commentsData['liveStatus'] = 'offline';
            $commentsData['totalRequests'] = $state['totalRequests'];
            echo json_encode($commentsData);
            exit;
        }
        $videoId = $searchData['items'][0]['id']['videoId'] ?? '';
        if (empty($videoId)) {
            returnError('Nao foi possivel extrair videoId.', $state, $stateFile, $commentsFile, 'live');
        }
        $videoUrl = 'https://www.googleapis.com/youtube/v3/videos'
            . '?part=liveStreamingDetails&id=' . urlencode($videoId)
            . '&key=' . urlencode($apiKey);
        $videoData = ytGetRaw($videoUrl, $httpContext);
        $liveChatId = $videoData['items'][0]['liveStreamingDetails']['activeLiveChatId'] ?? '';
        if (empty($liveChatId)) {
            returnError("Live sem activeLiveChatId.", $state, $stateFile, $commentsFile, 'live');
        }
        $state['resolvedChatId'] = $liveChatId;
        $state['resolvedAt']     = time();
        $state['noLiveAt']       = 0;
        if ($state['lastLiveChatId'] !== $liveChatId) {
            $state['nextPageToken']  = null;
            $state['lastMessageId']  = null;
            $state['lastLiveChatId'] = $liveChatId;
        }
    }
}

if (empty($liveChatId)) {
    returnError('liveChatId vazio apos resolucao.', $state, $stateFile, $commentsFile, 'live');
}

//  Buscar mensagens 
$chatUrl = 'https://www.googleapis.com/youtube/v3/liveChat/messages'
    . '?liveChatId=' . urlencode($liveChatId)
    . '&part=snippet,authorDetails'
    . '&key=' . urlencode($apiKey);
if (!empty($state['nextPageToken'])) {
    $chatUrl .= '&pageToken=' . urlencode($state['nextPageToken']);
}

$chatData = ytGetRaw($chatUrl, $httpContext);

if (!empty($chatData['error'])) {
    $code = $chatData['error']['code'] ?? 0;
    $msg  = $chatData['error']['message'] ?? 'Erro desconhecido';
    if ($code == 403 && strpos($msg, 'quota') !== false) {
        returnError("Cota da API esgotada. Erro: $msg", $state, $stateFile, $commentsFile, 'quota');
    }
    if ($code == 403 || $code == 404) {
        $state['resolvedChatId'] = '';
        $state['resolvedAt']     = 0;
        $state['nextPageToken']  = null;
        file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT));
        // Signal frontend to clear persisted liveChatId
        $payload = ['comments' => [], 'apiStatus' => 'error', 'apiError' => "Chat error ($code): $msg",
                     'errorType' => 'live_ended', 'invalidChatId' => true,
                     'liveStatus' => 'offline', 'totalRequests' => $state['totalRequests']];
        echo json_encode($payload);
        exit;
    }
    returnError("Erro API chat ($code): $msg", $state, $stateFile, $commentsFile, 'live');
}

//  Processar mensagens 
$commentsData = ['comments' => []];
if (file_exists($commentsFile)) {
    $cur = json_decode(file_get_contents($commentsFile), true);
    if (is_array($cur) && isset($cur['comments'])) $commentsData['comments'] = $cur['comments'];
}

if (!empty($chatData['items'])) {
    $newComments = [];
    foreach ($chatData['items'] as $item) {
        $msgId   = $item['id'] ?? '';
        $type    = $item['snippet']['type'] ?? 'textMessageEvent';
        $author  = '@' . ($item['authorDetails']['displayName'] ?? 'User');
        $avatar  = $item['authorDetails']['profileImageUrl'] ?? '';
        $text    = $item['snippet']['displayMessage'] ?? '';

        if ($state['lastMessageId'] && $msgId === $state['lastMessageId']) continue;

        // Qualquer interação no chat entra no lobby
        // Tipos ignorados: chatEndedEvent (sistema), pollEvent (enquete)
        $ignored = ['chatEndedEvent', 'pollEvent'];
        if (in_array($type, $ignored)) continue;

        // Classifica o tipo para badge visual no frontend
        $isSuperChat = ($type === 'superChatEvent');
        $isNewMember = in_array($type, ['newSponsorEvent', 'membershipGiftingEvent', 'giftMembershipReceivedEvent', 'memberMilestoneChatEvent']);
        $trigger = 'chat';
        if ($isSuperChat) $trigger = 'superchat';
        if ($isNewMember) $trigger = 'member';

        $newComments[] = [
            'id'        => $msgId,
            'user'      => $author,
            'avatarUrl' => $avatar,
            'text'      => $text,
            'trigger'   => $trigger,
        ];
    }
    if (!empty($newComments)) {
        $state['lastMessageId']   = end($newComments)['id'];
        $commentsData['comments'] = array_merge($commentsData['comments'], $newComments);
        if (count($commentsData['comments']) > 200) {
            $commentsData['comments'] = array_slice($commentsData['comments'], -200);
        }
        file_put_contents($commentsFile, json_encode($commentsData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }
}

if (!empty($chatData['nextPageToken'])) {
    $state['nextPageToken'] = $chatData['nextPageToken'];
}

//  Salvar estado e responder 
$state['lastFetchTime'] = time();
file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT));

$commentsData['apiStatus']     = 'ok';
$commentsData['liveStatus']    = 'online';
$commentsData['totalRequests'] = $state['totalRequests'];
$commentsData['liveChatId']    = $liveChatId;
echo json_encode($commentsData);