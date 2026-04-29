const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

// Fix DOM layout thrashing part 1
code = code.replace(
    "if (cb) cb.style.display = 'none';\r\n            if (lb) lb.style.display = 'none';",
    "if (cb && cb.style.display !== 'none') cb.style.display = 'none';\r\n            if (lb && lb.style.display !== 'none') lb.style.display = 'none';"
);
code = code.replace(
    "if (cb) cb.style.display = 'none';\n            if (lb) lb.style.display = 'none';",
    "if (cb && cb.style.display !== 'none') cb.style.display = 'none';\n            if (lb && lb.style.display !== 'none') lb.style.display = 'none';"
);

// Fix DOM layout thrashing part 2
code = code.replace(
    "if (cb) cb.style.display = '';\r\n                if (lb) lb.style.display = '';",
    "if (cb && cb.style.display !== '') cb.style.display = '';\r\n                if (lb && lb.style.display !== '') lb.style.display = '';"
);
code = code.replace(
    "if (cb) cb.style.display = '';\n                if (lb) lb.style.display = '';",
    "if (cb && cb.style.display !== '') cb.style.display = '';\n                if (lb && lb.style.display !== '') lb.style.display = '';"
);


// Native roundRect
let nativeRect = `function _roundRect(c, x, y, w, h, r) {
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
code = code.replace(/function _roundRect\(c, x, y, w, h, r\) {[\s\S]*?c\.closePath\(\);\s*}/g, nativeRect);

fs.writeFileSync('index.html', code);
console.log('Optimizations applied');
