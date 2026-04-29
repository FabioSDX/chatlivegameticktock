const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

const targetStrDOM = `            if (!_cycleOverlay || _cycleOverlay.timer <= 0) {
                _cycleOverlay = null;
                if (cb) cb.style.display = '';
                if (lb) lb.style.display = '';
                return;
            }
            if (cb) cb.style.display = 'none';
            if (lb) lb.style.display = 'none';`;

const replacementStrDOM = `            if (!_cycleOverlay || _cycleOverlay.timer <= 0) {
                _cycleOverlay = null;
                if (cb && cb.style.display === 'none') cb.style.display = '';
                if (lb && lb.style.display === 'none') lb.style.display = '';
                return;
            }
            if (cb && cb.style.display !== 'none') cb.style.display = 'none';
            if (lb && lb.style.display !== 'none') lb.style.display = 'none';`;

const targetStrRoundRect = `        function _roundRect(c, x, y, w, h, r) {
            c.beginPath();
            c.moveTo(x + r, y);
            c.lineTo(x + w - r, y);
            c.quadraticCurveTo(x + w, y, x + w, y + r);
            c.lineTo(x + w, y + h - r);
            c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            c.lineTo(x + r, y + h);
            c.quadraticCurveTo(x, y + h, x, y + h - r);
            c.lineTo(x, y + r);
            c.quadraticCurveTo(x, y, x + r, y);
            c.closePath();
        }`;

const replacementStrRoundRect = `        function _roundRect(c, x, y, w, h, r) {
            c.beginPath();
            if (c.roundRect) {
                c.roundRect(x, y, w, h, r);
            } else {
                c.moveTo(x + r, y);
                c.lineTo(x + w - r, y);
                c.quadraticCurveTo(x + w, y, x + w, y + r);
                c.lineTo(x + w, y + h - r);
                c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
                c.lineTo(x + r, y + h);
                c.quadraticCurveTo(x, y + h, x, y + h - r);
                c.lineTo(x, y + r);
                c.quadraticCurveTo(x, y, x + r, y);
            }
            c.closePath();
        }`;


let success = false;
if (code.includes(targetStrDOM)) {
    code = code.replace(targetStrDOM, replacementStrDOM);
    console.log('Fixed DOM layout thrashing.');
    success = true;
}

if (code.includes(targetStrRoundRect)) {
    code = code.replace(targetStrRoundRect, replacementStrRoundRect);
    console.log('Optimized roundRect.');
    success = true;
}

// Fix gradient recreation loop
let startIndex = code.indexOf('// Card background with gradient');
let endIndex = code.indexOf('// Border', startIndex);

if (startIndex > -1 && endIndex > -1) {
    let gradCode = code.substring(startIndex, endIndex);
    let optGrad = `// Card background with gradient
                var grad;
                if (!_cycleOverlay.grads) _cycleOverlay.grads = {};
                if (_cycleOverlay.grads[i]) {
                    grad = _cycleOverlay.grads[i];
                } else {
                    grad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY);
                    if (i === 0) { grad.addColorStop(0, 'rgba(255,215,0,0.3)'); grad.addColorStop(1, 'rgba(255,215,0,0.08)'); }
                    else if (i === 1) { grad.addColorStop(0, 'rgba(192,192,192,0.25)'); grad.addColorStop(1, 'rgba(192,192,192,0.06)'); }
                    else { grad.addColorStop(0, 'rgba(205,127,50,0.25)'); grad.addColorStop(1, 'rgba(205,127,50,0.06)'); }
                    _cycleOverlay.grads[i] = grad;
                }
                ctx.fillStyle = grad;
                _roundRect(ctx, cardX, cardY, cardW, cardH, 18);
                ctx.fill();
                `;
    code = code.replace(gradCode, optGrad);
    console.log('Optimized gradient caching.');
}

if (success) {
    fs.writeFileSync('index.html', code);
}
