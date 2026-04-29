const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

const targetStr = `            // Pass 1: 3D faces (drawn BEHIND front faces)
            for (var r = rStart; r <= rEnd; r++) {
                for (var c = 0; c < COLS; c++) {
                    var cell = getCell(r, c);
                    if (!cell || cell.t === E) continue;
                    var x = c * TILE;
                    var y = r * TILE;
                    var tex = BTEX[cell.t];

                    var aboveCell = getCell(r - 1, c);
                    var rightCell = getCell(r, c + 1);
                    var aboveEmpty = !aboveCell || aboveCell.t === E;
                    var rightEmpty = !rightCell || rightCell.t === E;

                    // Top face
                    if (aboveEmpty) {
                        ctx.save();
                        ctx.beginPath();
                        ctx.moveTo(x, y);
                        ctx.lineTo(x + _3D_SIDE, y - _3D_TOP);
                        ctx.lineTo(x + TILE + _3D_SIDE, y - _3D_TOP);
                        ctx.lineTo(x + TILE, y);
                        ctx.closePath();
                        ctx.clip();
                        if (tex && tex.complete && tex.naturalWidth > 0) {
                            ctx.save();
                            ctx.transform(1, 0, _3D_SIDE / TILE, -_3D_TOP / TILE, x, y);
                            ctx.drawImage(tex, 0, 0, TILE, TILE);
                            ctx.restore();
                        }
                        // Crack on top face
                        if (cell.cr > 0.01) {
                            var stageT = Math.min(9, Math.floor(cell.cr * 10));
                            var dtexT = DESTROY_TEX[stageT];
                            if (dtexT && dtexT.complete && dtexT.naturalWidth > 0) {
                                ctx.save();
                                ctx.transform(1, 0, _3D_SIDE / TILE, -_3D_TOP / TILE, x, y);
                                ctx.drawImage(dtexT, 0, 0, TILE, TILE);
                                ctx.restore();
                            }
                        }
                        ctx.fillStyle = 'rgba(255,255,255,0.22)';
                        ctx.fill();
                        ctx.restore();
                    }

                    // Right face
                    if (rightEmpty) {
                        ctx.save();
                        ctx.beginPath();
                        ctx.moveTo(x + TILE, y);
                        ctx.lineTo(x + TILE + _3D_SIDE, y - _3D_TOP);
                        ctx.lineTo(x + TILE + _3D_SIDE, y + TILE - _3D_TOP);
                        ctx.lineTo(x + TILE, y + TILE);
                        ctx.closePath();
                        ctx.clip();
                        if (tex && tex.complete && tex.naturalWidth > 0) {
                            ctx.save();
                            ctx.transform(_3D_SIDE / TILE, -_3D_TOP / TILE, 0, 1, x + TILE, y);
                            ctx.drawImage(tex, 0, 0, TILE, TILE);
                            ctx.restore();
                        }
                        // Crack on right face
                        if (cell.cr > 0.01) {
                            var stageR = Math.min(9, Math.floor(cell.cr * 10));
                            var dtexR = DESTROY_TEX[stageR];
                            if (dtexR && dtexR.complete && dtexR.naturalWidth > 0) {
                                ctx.save();
                                ctx.transform(_3D_SIDE / TILE, -_3D_TOP / TILE, 0, 1, x + TILE, y);
                                ctx.drawImage(dtexR, 0, 0, TILE, TILE);
                                ctx.restore();
                            }
                        }
                        ctx.fillStyle = 'rgba(0,0,0,0.3)';
                        ctx.fill();
                        ctx.restore();
                    }
                }
            }`;

const replacementStr = `            // Pass 1: 3D faces (drawn BEHIND front faces) - OPTIMIZED (No Clip Paths)
            for (var r = rStart; r <= rEnd; r++) {
                for (var c = 0; c < COLS; c++) {
                    var cell = getCell(r, c);
                    if (!cell || cell.t === E) continue;
                    var x = c * TILE;
                    var y = r * TILE;
                    var tex = BTEX[cell.t];

                    var aboveCell = getCell(r - 1, c);
                    var rightCell = getCell(r, c + 1);
                    var aboveEmpty = !aboveCell || aboveCell.t === E;
                    var rightEmpty = !rightCell || rightCell.t === E;

                    if (aboveEmpty) {
                        ctx.save();
                        ctx.transform(1, 0, _3D_SIDE / TILE, -_3D_TOP / TILE, x, y);
                        if (tex && tex.complete && tex.naturalWidth > 0) {
                            ctx.drawImage(tex, 0, 0, TILE, TILE);
                        } else {
                            ctx.fillStyle = BDEF[cell.t] ? BDEF[cell.t].color : '#fff';
                            ctx.fillRect(0, 0, TILE, TILE);
                        }
                        if (cell.cr > 0.01) {
                            var stageT = Math.min(9, Math.floor(cell.cr * 10));
                            var dtexT = DESTROY_TEX[stageT];
                            if (dtexT && dtexT.complete && dtexT.naturalWidth > 0) {
                                ctx.drawImage(dtexT, 0, 0, TILE, TILE);
                            }
                        }
                        ctx.fillStyle = 'rgba(255,255,255,0.22)';
                        ctx.fillRect(0, 0, TILE, TILE);
                        ctx.restore();
                    }

                    if (rightEmpty) {
                        ctx.save();
                        ctx.transform(_3D_SIDE / TILE, -_3D_TOP / TILE, 0, 1, x + TILE, y);
                        if (tex && tex.complete && tex.naturalWidth > 0) {
                            ctx.drawImage(tex, 0, 0, TILE, TILE);
                        } else {
                            ctx.fillStyle = BDEF[cell.t] ? BDEF[cell.t].color : '#fff';
                            ctx.fillRect(0, 0, TILE, TILE);
                        }
                        if (cell.cr > 0.01) {
                            var stageR = Math.min(9, Math.floor(cell.cr * 10));
                            var dtexR = DESTROY_TEX[stageR];
                            if (dtexR && dtexR.complete && dtexR.naturalWidth > 0) {
                                ctx.drawImage(dtexR, 0, 0, TILE, TILE);
                            }
                        }
                        ctx.fillStyle = 'rgba(0,0,0,0.3)';
                        ctx.fillRect(0, 0, TILE, TILE);
                        ctx.restore();
                    }
                }
            }`;

if (code.includes(targetStr)) {
    code = code.replace(targetStr, replacementStr);
    fs.writeFileSync('index.html', code);
    console.log('Success: Replaced 3D rendering pass successfully!');
} else {
    console.log('Error: Target string not found. Trying flexible match...');
    let startIndex = code.indexOf('// Pass 1: 3D faces (drawn BEHIND front faces)');
    let endIndex = code.indexOf('// Pass 2: Front faces');
    if (startIndex > -1 && endIndex > -1) {
        let chunk = code.substring(startIndex, endIndex);
        code = code.replace(chunk, replacementStr + '\n\n            ');
        fs.writeFileSync('index.html', code);
        console.log('Success: Replaced using flexible matching!');
    } else {
        console.log('Error: Could not find block to replace.');
    }
}
