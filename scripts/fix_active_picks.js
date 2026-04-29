const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

const targetStr = `        function update() {
            if (!pick) return;
            if (pick.stuck) {`;

const replaceStr = `        function update() {
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

if (code.includes(targetStr)) {
    code = code.replace(targetStr, replaceStr);
    console.log("Replaced exactly!");
} else {
    // flexible match
    let targetFlex = targetStr.replace(/\r\n/g, '\n');
    let replaceFlex = replaceStr.replace(/\r\n/g, '\n');
    if (code.includes(targetFlex)) {
        code = code.replace(targetFlex, replaceFlex);
        console.log("Replaced with LF flex!");
    } else {
        console.log("Target not found!");
    }
}

fs.writeFileSync('index.html', code);
