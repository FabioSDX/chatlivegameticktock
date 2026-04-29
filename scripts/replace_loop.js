const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

let startIndex = code.indexOf('function loop() {');
let endIndex = code.indexOf('requestAnimationFrame(loop);\r\n        }', startIndex) + 40;
if (endIndex < 40) endIndex = code.indexOf('requestAnimationFrame(loop);\n        }', startIndex) + 40;

if (startIndex > -1 && endIndex > 40) {
    let chunk = code.substring(startIndex, endIndex);
    let replacement = `var physicsLastTime = performance.now();
        var physicsAccumulator = 0;
        var physicsTimeStep = 1000 / 60;

        function loop() {
            var now = performance.now();
            fpsFrameCount++;
            if (now - fpsLastTime >= fpsUpdateInterval) {
                var fps = Math.round((fpsFrameCount * 1000) / (now - fpsLastTime));
                document.getElementById('fpsCounter').innerText = 'FPS: ' + fps;
                fpsFrameCount = 0;
                fpsLastTime = now;
            }

            var dt = now - physicsLastTime;
            physicsLastTime = now;
            if (dt > 250) dt = 250;

            physicsAccumulator += dt;
            while (physicsAccumulator >= physicsTimeStep) {
                update();
                updateFX();
                updateWeatherParticles();
                physicsAccumulator -= physicsTimeStep;
            }

            try { draw(); } catch(e) { console.warn('draw error:', e.message); }
            requestAnimationFrame(loop);
        }`;
    code = code.replace(chunk, replacement);
    fs.writeFileSync('index.html', code);
    console.log('Fixed loop successfully!');
} else {
    console.log('Could not find loop bounds.');
}
