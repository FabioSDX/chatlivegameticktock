const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

// Find the tnt type check block
let tntTypeCheckRegex = /if \(b\.nuke\) \{[\s\S]*?drawSize = TILE \* 0\.5;[\s\S]*?tntTexture = null;[\s\S]*?\} else if \(b\.mega\) \{[\s\S]*?drawSize = TILE \* 1\.8;[\s\S]*?tntTexture = MEGA_TNT_TEX;[\s\S]*?\} else if \(b\.heart\) \{/;

let tntTypeCheckReplacement = `if (b.nuke) {
                     drawSize = TILE * 0.5;
                     tntTexture = null;
                 } else if (b.mega) {
                     drawSize = TILE * 1.8;
                     tntTexture = MEGA_TNT_TEX;
                 } else if (b.heart) {
                     drawSize = TILE * 0.9;
                     tntTexture = null;
                 } else {
                     drawSize = TILE;
                     tntTexture = TNT_TEX;
                 }

                 ctx.save();
                 ctx.translate(b.x, b.y);
                 ctx.rotate(b.ang || 0);

                 if (b.nuke) {`;

// We also need to clean up the redundant drawing logic that follows
let redundantHeartDrawRegex = /} else if \(b\.heart\) \{[\s\S]*?ctx\.drawImage\(HEART_SPRITE, -drawSize \/ 2, -drawSize \/ 2, drawSize, drawSize\);[\s\S]*?}/;
let correctHeartDraw = `} else if (b.heart) {
                     var scale = 1.0 + glow * 0.25;
                     ctx.scale(scale, scale);
                     ctx.drawImage(HEART_SPRITE, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
                 }`;

code = code.replace(tntTypeCheckRegex, tntTypeCheckReplacement);
code = code.replace(redundantHeartDrawRegex, correctHeartDraw);

fs.writeFileSync('index.html', code);
console.log("Heart TNT drawSize fixed and loop cleaned.");
