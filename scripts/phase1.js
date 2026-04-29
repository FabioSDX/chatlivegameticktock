const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

// 1. _allActivePicks in update()
let targetUpdate = `        function update() {
            if (!pick) return;
            if (pick.stuck) {`;
let replaceUpdate = `        function update() {
            if (!pick) return;
            if (!window._allActivePicks) window._allActivePicks = [];
            var aap = window._allActivePicks;
            aap.length = 0;
            aap.push(pick);
            for(var i=0; i<userPicks.length; i++) aap.push(userPicks[i]);
            if(typeof extraPicks !== 'undefined') {
                for(var i=0; i<extraPicks.length; i++) aap.push(extraPicks[i]);
            }
            if (pick.stuck) {`;
code = code.replace(targetUpdate, replaceUpdate);
code = code.replace(targetUpdate.replace(/\r\n/g, '\n'), replaceUpdate.replace(/\r\n/g, '\n'));

// 2. Democratic Camera
let targetCam = `            // ── Democratic Camera: follow the deepest player for 5+ seconds ──
            var allCamPicks = [pick].concat(userPicks).filter(function(p) { return p && !p.stuck; });
            var deepestPick = pick;
            var deepestY = pick ? pick.y : 0;
            for (var ci = 0; ci < allCamPicks.length; ci++) {
                if (allCamPicks[ci].y > deepestY) {
                    deepestY = allCamPicks[ci].y;
                    deepestPick = allCamPicks[ci];
                }
            }`;
let replaceCam = `            // ── Democratic Camera: follow the deepest player for 5+ seconds ──
            var deepestPick = pick;
            var deepestY = (pick && !pick.stuck) ? pick.y : 0;
            if (userPicks && userPicks.length > 0) {
                for (var ci = 0; ci < userPicks.length; ci++) {
                    var up = userPicks[ci];
                    if (up && !up.stuck && up.y > deepestY) {
                        deepestY = up.y;
                        deepestPick = up;
                    }
                }
            }`;
code = code.replace(targetCam, replaceCam);
code = code.replace(targetCam.replace(/\r\n/g, '\n'), replaceCam.replace(/\r\n/g, '\n'));

// 3. bigTimer allocation
let targetBig = `            // Decrement bigTimer on all picks
            var _allBigPicks = [pick].concat(userPicks);
            for (var _bi = 0; _bi < _allBigPicks.length; _bi++) {
                var _bp = _allBigPicks[_bi];
                if (_bp && _bp.bigTimer > 0) _bp.bigTimer--;
            }`;
let replaceBig = `            // Decrement bigTimer on all picks
            if (pick && pick.bigTimer > 0) pick.bigTimer--;
            for (var _bi = 0; _bi < userPicks.length; _bi++) {
                var _bp = userPicks[_bi];
                if (_bp && _bp.bigTimer > 0) _bp.bigTimer--;
            }`;
code = code.replace(targetBig, replaceBig);
code = code.replace(targetBig.replace(/\r\n/g, '\n'), replaceBig.replace(/\r\n/g, '\n'));

// 4. Concat replacements
code = code.replace(/var allP = \[pick\]\.concat\(userPicks, extraPicks\);/g, 'var allP = window._allActivePicks || [pick];');
code = code.replace(/var allPicks = \[pick\]\.concat\(userPicks, extraPicks\);/g, 'var allPicks = window._allActivePicks || [pick];');
code = code.replace(/var allP = \[pick\]\.concat\(userPicks\);/g, 'var allP = window._allActivePicks || [pick];');

fs.writeFileSync('index.html', code);
console.log('Phase 1 restored');
