const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

// 1. Add Sprite Cache
let tntTexTarget = "var TNT_TEX = new Image(); TNT_TEX.src = 'block/tnt.png';";
let spriteCode = `var TNT_TEX = new Image(); TNT_TEX.src = 'block/tnt.png';
        var MEGA_TNT_TEX = new Image(); MEGA_TNT_TEX.src = 'block/mega_tnt.png';
        
        // Cache do ícone de coração para performance (evita shadowBlur pesado por frame)
        var HEART_SPRITE = document.createElement('canvas');
        HEART_SPRITE.width = 80; HEART_SPRITE.height = 80;
        (function() {
            var hctx = HEART_SPRITE.getContext('2d');
            hctx.shadowBlur = 15; hctx.shadowColor = '#ff4488';
            hctx.font = 'bold 50px Arial'; hctx.textAlign = 'center'; hctx.textBaseline = 'middle';
            hctx.fillText('❤️', 40, 40);
        })();`;

// Remove MEGA_TNT_TEX since it's already in our spriteCode block
code = code.replace(/var MEGA_TNT_TEX = new Image\(\); MEGA_TNT_TEX\.src = 'block\/mega_tnt\.png';/, "");
code = code.replace(tntTexTarget, spriteCode);

// 2. Update Draw Loop
let heartDrawRegex = /} else if \(b\.heart\) \{[\s\S]*?ctx\.fillText\('❤️', 0, 0\);[\s\S]*?}/;
let heartReplacement = `} else if (b.heart) {
                     var scale = 1.0 + glow * 0.25;
                     ctx.scale(scale, scale);
                     ctx.drawImage(HEART_SPRITE, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
                 }`;

code = code.replace(heartDrawRegex, heartReplacement);

fs.writeFileSync('index.html', code);
console.log("Heart TNT optimized with Sprite Cache.");
