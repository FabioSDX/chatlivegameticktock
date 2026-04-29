const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

const regex = /function update\(\)\s*\{\s*if \(\!pick\) return;\s*if \(pick\.stuck\) \{/;

const replaceStr = `function update() {
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

if (regex.test(code)) {
    code = code.replace(regex, replaceStr);
    console.log("Replaced with regex!");
} else {
    console.log("Still not found!");
}

fs.writeFileSync('index.html', code);
