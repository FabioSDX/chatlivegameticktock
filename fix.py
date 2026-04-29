import re

with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# The corrupted part starts right after:
start_marker = "                var isFlagForbidden = /^(sr|sl|su|sd|tnt|mega|big|clone|thor|nuke|bh|play|join|pp)$/i.test(potentialCode);"

# The corrupted part ends right before:
end_marker = "            else if (data.type === 'follow') {"

pristine_block = """
                var foundCode = null;
                if (!isFlagForbidden) {
                    if (countryMapping[potentialCode]) {
                        foundCode = potentialCode;
                    } else if (nameToCountryCode[potentialCode]) {
                        foundCode = nameToCountryCode[potentialCode];
                    }
                }
                if (foundCode) {
                    if (!persistentScores[cUser]) persistentScores[cUser] = { score: 0, avatar: cAvatar, color: '#ffdd44' };
                    persistentScores[cUser].countryCode = foundCode;
                    getFlagImage(foundCode); // Preload
                    spawnText(tx || (uPick ? uPick.x : pick.x), ty || (uPick ? uPick.y : pick.y), '🚩 ' + countryMapping[foundCode].toUpperCase(), '#ffffff');
                }

                // TTS: Read non-command messages
                if (_ttsEnabled && cText.length > 2) {
                    var commandList = ['sr', 'sl', 'su', 'sd', 'tnt', 'mega', 'powertnt', 'clone', 'clonar', 'thor', 'raio', 'nuke', 'nuclear', 'pp', 'storm', 'tempestade', 'bh', 'blackhole', 'buraco', 'creeper', 'big', 'grande', 'play', 'join'];
                    var isPureCommand = words.every(function (w) { return commandList.indexOf(w) !== -1; });

                    if (!isPureCommand) {
                        speakTTS(data.nickname + ' said: ' + cText);
                    }
                }
            }
            else if (data.type === 'superchat') {
                var scUser = (data.user || 'unknown').toLowerCase(); if (scUser.charAt(0) !== '@') scUser = '@' + scUser;
                var scAvatar = data.avatar || ''; lastActivity[scUser] = Date.now(); if (scAvatar) loadAvatar(scAvatar);
                spawnUserPickaxe(scUser, scAvatar);
                var scPick = userPicks.find(function (up) { return up.userName === scUser; });
                var refP = (pick.active) ? pick : (camTarget || pick);
                var scx = scPick ? scPick.x : refP.x;
                var scy = scPick ? scPick.y : refP.y;
                var numVal = parseFloat((data.amount || '1').replace(/[^0-9.]/g, '')) || 1;
                for (var sci = 0; sci < Math.min(20, Math.floor(numVal)); sci++) activateTNT(scx + (Math.random() - 0.5) * TILE * 4, scy, scUser, scAvatar);
                if (numVal >= 10) activateMegaTNT(scx, scy, scUser, scAvatar);
                spawnText(scx, scy - 30, '💰 ' + (data.amount || '') + ' SUPER CHAT!', '#ffdd00');
                var superchatScore = Math.floor(numVal * 10);
                if (pick.active) score += superchatScore;
                // Contabilizar superchat como presente no ranking
                if (!persistentScores[scUser]) persistentScores[scUser] = { score: 0, avatar: scAvatar, color: '#ffdd44', likes: 0, giftsValue: 0 };
                persistentScores[scUser].score += superchatScore;
                persistentScores[scUser].giftsValue = (persistentScores[scUser].giftsValue || 0) + numVal;
                addCycleScore(scUser, superchatScore);
                // Also add to owner score for daily total
                if (pick.active && ownerName && persistentScores[ownerName]) {
                    persistentScores[ownerName].score += superchatScore;
                }
                triggerBotrixEvent('superchat', scUser, scAvatar);
            }
            else if (data.type === 'member') { var mUserRaw = data.user || ''; var mUser = (mUserRaw.charAt(0) === '@' ? mUserRaw : '@' + mUserRaw).toLowerCase(); if (mUser === '@') return; lastActivity[mUser] = Date.now(); if (data.avatar) loadAvatar(data.avatar); spawnUserPickaxe(mUser, data.avatar || ''); }
            else if (data.type === 'gift') {
                var gUserRaw = data.user || 'unknown';
                var gUser = (gUserRaw.charAt(0) === '@' ? gUserRaw : '@' + gUserRaw).toLowerCase(), gAvatar = data.avatar || '', giftName = (data.giftName || '').toLowerCase();
                var gUrl = data.giftPictureUrl || '';
                lastActivity[gUser] = Date.now(); if (gAvatar) loadAvatar(gAvatar); spawnUserPickaxe(gUser, gAvatar);
                var gPick = userPicks.find(function (up) { return up.userName === gUser; });
                var refP = (pick.active) ? pick : (camTarget || pick);
                var gx = gPick ? gPick.x : refP.x;
                var gy = gPick ? gPick.y : refP.y;
                var diamonds = data.diamondCount || 1, repeat = data.repeatCount || 1;
                if (data.platform === 'youtube') { repeat = 1; }
                
                var resultingPickaxe = null;

                if (giftName.includes('ice cream') || giftName.includes('sorvete')) {
                    persistentScores[gUser].giftsCount = (persistentScores[gUser].giftsCount || 0) + (1 * repeat);
                    spawnText(gx, gy - 30, '🍦 UPGRADE!', '#00ffff');
                    resultingPickaxe = getPickaxeForGifts(gUser);
                    if (gPick) gPick.pickaxe = resultingPickaxe;
                }
                else if (giftName.includes('finger heart') || giftName.includes('coração com os dedos')) {
                    persistentScores[gUser].giftsCount = PICKAXES.length - 1;
                    spawnText(gx, gy - 30, '🤞 MAX PICKAXE!', '#ff00ff');
                    resultingPickaxe = getPickaxeForGifts(gUser);
                    if (gPick) gPick.pickaxe = resultingPickaxe;
                }
                else if (giftName.includes('rose') || giftName.includes('rosa')) { 
                    var count = 10 * Math.min(repeat, 5); 
                    for (var gi = 0; gi < count; gi++) activateTNT(gx + (Math.random() - 0.5) * TILE * 3, gy, gUser, gAvatar); 
                    spawnText(gx, gy - 30, '🌹 ' + count + ' TNT!', '#ff6688'); if (pick.active) score += 1 * repeat; 
                }
                else if (giftName.includes('gg')) { 
                    var count = 20 * Math.min(repeat, 3);
                    for (var gi = 0; gi < count; gi++) activateTNT(gx + (Math.random() - 0.5) * TILE * 5, gy, gUser, gAvatar); 
                    spawnText(gx, gy - 30, '🎮 ' + count + ' TNT!', '#44ff44'); if (pick.active) score += 4 * repeat; 
                }
                else if (giftName.includes('creeper')) { 
                    for (var gi = 0; gi < Math.min(repeat, 3); gi++) activateCreeper(gx + (Math.random()-0.5)*TILE*2, gy, gUser); 
                    spawnText(gx, gy - 30, '💣 CREEPER!', '#44ff44'); if (pick.active) score += 5 * repeat; 
                }
                else if (giftName.includes('heart me') || giftName.includes('heart_me') || giftName.includes('coração') || giftName.includes('heart')) { 
                    var count = 30 * Math.min(repeat, 3);
                    for (var gi = 0; gi < count; gi++) activateHeartTNT(gx + (Math.random() - 0.5) * TILE * 4, gy, gUser, gAvatar); 
                    spawnText(gx, gy - 30, '❤️ ' + count + ' CORAÇÕES!', '#ff6688'); if (pick.active) score += 3 * repeat; 
                }
                else if (giftName.includes('like')) { 
                    for (var gi = 0; gi < Math.min(repeat, 5); gi++) activateMegaTNT(gx + (Math.random() - 0.5) * TILE * 3, gy, gUser, gAvatar); 
                    spawnText(gx, gy - 30, '❤️ MEGA!', '#ff4488'); if (pick.active) score += 5 * repeat; 
                }
                else { 
                    for (var gi = 0; gi < Math.min(repeat, 10); gi++) activateTNT(gx + (Math.random() - 0.5) * TILE * 3, gy, gUser, gAvatar); 
                    spawnText(gx, gy - 30, '🎁 TNT!', '#ffaa44'); if (pick.active) score += 1 * repeat; 
                }
                // Contabilizar valor dos presentes (diamantes) no ranking — TODOS os jogadores, incluindo owner
                if (!persistentScores[gUser]) persistentScores[gUser] = { score: 0, avatar: gAvatar, color: '#ff88ff', likes: 0, giftsValue: 0, giftsCount: 0 };
                var giftScoreValue = diamonds * repeat;
                persistentScores[gUser].score += giftScoreValue;
                persistentScores[gUser].giftsValue = (persistentScores[gUser].giftsValue || 0) + giftScoreValue;
                
                // Adiciona também ao cycle score para aparecer no ranking
                addCycleScore(gUser, giftScoreValue);
                
                showGiftAlert(gUser, gAvatar, giftName, gUrl, resultingPickaxe);
            }
"""

start_idx = text.find(start_marker)
end_idx = text.find(end_marker)

if start_idx != -1 and end_idx != -1:
    new_text = text[:start_idx + len(start_marker)] + "\n" + pristine_block + text[end_idx:]
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(new_text)
    print("FIX APPLIED SUCCESSFULLY!")
else:
    print(f"FAILED TO FIND MARKERS! start: {start_idx}, end: {end_idx}")
