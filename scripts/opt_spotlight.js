const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

const targetStr = `            // ── 1st place spotlight effect ──
            if (top3.length > 0 && _cycleOverlayTimer > 20) {
                var spotAlpha = Math.sin(_cycleOverlayTimer * 0.03) * 0.08 + 0.08;
                var spotGrad = ctx.createRadialGradient(W / 2, podiumH[0], 0, W / 2, podiumH[0], W * 0.4);
                spotGrad.addColorStop(0, 'rgba(255,215,0,' + spotAlpha + ')');
                spotGrad.addColorStop(1, 'rgba(255,215,0,0)');
                ctx.fillStyle = spotGrad;
                ctx.fillRect(0, 0, W, H);
            }`;

const replacementStr = `            // ── 1st place spotlight effect ──
            if (top3.length > 0 && _cycleOverlayTimer > 20) {
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

let targetGradStr = `                // Card background with gradient
                var grad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY);
                if (i === 0) { grad.addColorStop(0, 'rgba(255,215,0,0.3)'); grad.addColorStop(1, 'rgba(255,215,0,0.08)'); }
                else if (i === 1) { grad.addColorStop(0, 'rgba(192,192,192,0.25)'); grad.addColorStop(1, 'rgba(192,192,192,0.06)'); }
                else { grad.addColorStop(0, 'rgba(205,127,50,0.25)'); grad.addColorStop(1, 'rgba(205,127,50,0.06)'); }
                ctx.fillStyle = grad;`;

let replaceGradStr = `                // Card background with gradient
                var grad;
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

let targetClipStr = `                // Avatar circle
                var avX = numX + numW + avSize / 2 + 8;
                var avY = cardY + cardH / 2;
                ctx.save();
                ctx.beginPath();
                ctx.arc(avX, avY, avSize / 2, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                var avUrl = p.userAvatarUrl || p.avatar;
                var avImg = avUrl ? avatarCache[avUrl] : null;
                if (avImg && avImg.src && avImg.complete && avImg.naturalWidth > 0) {
                    ctx.drawImage(avImg, avX - avSize / 2, avY - avSize / 2, avSize, avSize);
                } else {
                    ctx.fillStyle = medalColors[i];
                    ctx.fillRect(avX - avSize / 2, avY - avSize / 2, avSize, avSize);
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold ' + Math.floor(avSize * 0.5) + 'px Arial';
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText((p.name || '?').replace('@','').charAt(0).toUpperCase(), avX, avY);
                }
                ctx.restore();`;

let replaceClipStr = `                // Avatar circle
                var avX = numX + numW + avSize / 2 + 8;
                var avY = cardY + cardH / 2;
                var avUrl = p.userAvatarUrl || p.avatar;
                var avImg = avUrl ? avatarCache[avUrl] : null;
                if (avImg && avImg.src && avImg.complete && avImg.naturalWidth > 0) {
                    // Draw square avatar, the ring will cover the sharp edges slightly, avoiding expensive clip()
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

function regexReplace(target, replace) {
    let t = target.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&').replace(/\\r\\n/g, '\\r?\\n').replace(/\\s+/g, '\\s+');
    code = code.replace(new RegExp(t), replace);
}

regexReplace(targetStr, replacementStr);
regexReplace(targetGradStr, replaceGradStr);
regexReplace(targetClipStr, replaceClipStr);

fs.writeFileSync('index.html', code);
console.log('Optimizations applied');
