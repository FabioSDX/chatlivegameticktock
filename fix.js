const fs = require('fs');
const lines = fs.readFileSync('index.html', 'utf8').split('\n');

const correctBlock = \                // Also add to owner score for daily total
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
                    spawnText(gx, gy - 30, '?? UPGRADE!', '#00ffff');
                    resultingPickaxe = getPickaxeForGifts(gUser);
                    if (gPick) gPick.pickaxe = resultingPickaxe;
                }
                else if (giftName.includes('finger heart') || giftName.includes('coração com os dedos')) {
                    persistentScores[gUser].giftsCount = PICKAXES.length - 1;
                    spawnText(gx, gy - 30, '?? MAX PICKAXE!', '#ff00ff');
                    resultingPickaxe = getPickaxeForGifts(gUser);
                    if (gPick) gPick.pickaxe = resultingPickaxe;
                }
                else if (giftName.includes('rose') || giftName.includes('rosa')) { 
                    var count = 10 * Math.min(repeat, 5); 
                    for (var gi = 0; gi < count; gi++) activateTNT(gx + (Math.random() - 0.5) * TILE * 3, gy, gUser, gAvatar); 
                    spawnText(gx, gy - 30, '?? ' + count + ' TNT!', '#ff6688'); if (pick.active) score += 1 * repeat; 
                }
                else if (giftName.includes('gg')) { 
                    var count = 20 * Math.min(repeat, 3);
                    for (var gi = 0; gi < count; gi++) activateTNT(gx + (Math.random() - 0.5) * TILE * 5, gy, gUser, gAvatar); 
                    spawnText(gx, gy - 30, '?? ' + count + ' TNT!', '#44ff44'); if (pick.active) score += 4 * repeat; 
                }
                else if (giftName.includes('creeper')) { 
                    for (var gi = 0; gi < Math.min(repeat, 3); gi++) activateCreeper(gx + (Math.random()-0.5)*TILE*2, gy, gUser); 
                    spawnText(gx, gy - 30, '?? CREEPER!', '#44ff44'); if (pick.active) score += 5 * repeat; 
                }
                else if (giftName.includes('heart me') || giftName.includes('heart_me') || giftName.includes('coração') || giftName.includes('heart')) { 
                    var count = 30 * Math.min(repeat, 3);
                    for (var gi = 0; gi < count; gi++) activateHeartTNT(gx + (Math.random() - 0.5) * TILE * 4, gy, gUser, gAvatar); 
                    spawnText(gx, gy - 30, '?? ' + count + ' CORAÇÕES!', '#ff6688'); if (pick.active) score += 3 * repeat; 
                }
                
                showGiftAlert(gUser, gAvatar, giftName, gUrl, resultingPickaxe);
            }\;

let startIndex = -1;
for (let i = 9360; i < lines.length; i++) {
    if (lines[i].includes('// Also add to owner score for daily total')) {
        startIndex = i;
        break;
    }
}

let endIndex = -1;
for (let i = startIndex + 1; i < lines.length; i++) {
    if (lines[i].includes(\"else if (data.type === 'error')\")) {
        endIndex = i;
        break;
    }
}

if (startIndex !== -1 && endIndex !== -1) {
    lines.splice(startIndex, endIndex - startIndex, correctBlock);
    fs.writeFileSync('index.html', lines.join('\\n'));
    console.log('Fixed lines from ' + startIndex + ' to ' + endIndex);
} else {
    console.log('Could not find bounds: start=' + startIndex + ', end=' + endIndex);
}
