const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

// 1. Optimize Linear Gradients
let startGrad = code.indexOf('var grad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY);');
if (startGrad > -1) {
    let endGrad = code.indexOf('ctx.fillStyle = grad;', startGrad) + 'ctx.fillStyle = grad;'.length;
    let oldGrad = code.substring(startGrad, endGrad);
    let newGrad = `var grad;
                if (!_cycleOverlay.bgGrads) _cycleOverlay.bgGrads = {};
                if (_cycleOverlay.bgGrads[i]) {
                    grad = _cycleOverlay.bgGrads[i];
                } else {
                    grad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY);
                    if (i === 0) { grad.addColorStop(0, 'rgba(255,215,0,0.3)'); grad.addColorStop(1, 'rgba(255,215,0,0.08)'); }
                    else if (i === 1) { grad.addColorStop(0, 'rgba(192,192,192,0.25)'); grad.addColorStop(1, 'rgba(192,192,192,0.06)'); }
                    else { grad.addColorStop(0, 'rgba(205,127,50,0.25)'); grad.addColorStop(1, 'rgba(205,127,50,0.06)'); }
                    _cycleOverlay.bgGrads[i] = grad;
                }
                ctx.fillStyle = grad;`;
    code = code.replace(oldGrad, newGrad);
    console.log('Fixed Linear Gradients');
}

// 2. Optimize Avatar Clip
let startClip = code.indexOf('ctx.save();\r\n                ctx.beginPath();\r\n                ctx.arc(avX, avY, avSize / 2, 0, Math.PI * 2);\r\n                ctx.closePath();\r\n                ctx.clip();');
if (startClip === -1) {
    startClip = code.indexOf('ctx.save();\n                ctx.beginPath();\n                ctx.arc(avX, avY, avSize / 2, 0, Math.PI * 2);\n                ctx.closePath();\n                ctx.clip();');
}

if (startClip > -1) {
    let endClip = code.indexOf('ctx.restore();', startClip) + 'ctx.restore();'.length;
    let oldClip = code.substring(startClip, endClip);
    let newClip = `var avUrl = p.userAvatarUrl || p.avatar;
                var avImg = avUrl ? avatarCache[avUrl] : null;
                if (avImg && avImg.src && avImg.complete && avImg.naturalWidth > 0) {
                    ctx.drawImage(avImg, avX - avSize / 2, avY - avSize / 2, avSize, avSize);
                } else {
                    ctx.fillStyle = medalColors[i];
                    ctx.beginPath();
                    ctx.arc(avX, avY, avSize / 2, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold ' + Math.floor(avSize * 0.5) + 'px Arial';
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText((p.name || '?').replace('@','').charAt(0).toUpperCase(), avX, avY);
                }`;
    code = code.replace(oldClip, newClip);
    console.log('Fixed Avatar Clip');
}

// 3. Optimize Spotlight
let startSpot = code.indexOf('if (top3.length > 0 && _cycleOverlayTimer > 20) {');
if (startSpot > -1) {
    let endSpot = code.indexOf('ctx.fillRect(0, 0, W, H);\r\n            }', startSpot);
    if (endSpot === -1) endSpot = code.indexOf('ctx.fillRect(0, 0, W, H);\n            }', startSpot);
    
    if (endSpot > -1) {
        endSpot += 'ctx.fillRect(0, 0, W, H);\n            }'.length;
        let oldSpot = code.substring(startSpot, endSpot);
        let newSpot = `if (top3.length > 0 && _cycleOverlayTimer > 20) {
                if (!_cycleOverlay.spotGrad) {
                    _cycleOverlay.spotGrad = ctx.createRadialGradient(W / 2, podiumH[0], 0, W / 2, podiumH[0], W * 0.4);
                    _cycleOverlay.spotGrad.addColorStop(0, 'rgba(255,215,0,1)');
                    _cycleOverlay.spotGrad.addColorStop(1, 'rgba(255,215,0,0)');
                }
                var spotAlpha = Math.sin(_cycleOverlayTimer * 0.03) * 0.08 + 0.08;
                ctx.save();
                ctx.globalAlpha = spotAlpha * alpha;
                ctx.fillStyle = _cycleOverlay.spotGrad;
                var rW = W * 0.8, rH = W * 0.8;
                ctx.fillRect((W - rW) / 2, podiumH[0] - rH / 2, rW, rH);
                ctx.restore();
            }`;
        code = code.replace(oldSpot, newSpot);
        console.log('Fixed Spotlight');
    }
}

fs.writeFileSync('index.html', code);
