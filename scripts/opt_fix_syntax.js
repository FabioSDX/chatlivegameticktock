const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

const targetStr = `                ctx.fillRect((W - rW) / 2, podiumH[0] - rH / 2, rW, rH);
                ctx.restore();
            }}

            ctx.restore();
        }`;

const replacementStr = `                ctx.fillRect((W - rW) / 2, podiumH[0] - rH / 2, rW, rH);
                ctx.restore();
            }

            ctx.restore();
        }`;

if (code.includes(targetStr)) {
    code = code.replace(targetStr, replacementStr);
    fs.writeFileSync('index.html', code);
    console.log('Fixed syntax error: Replaced "}}" with "}"');
} else {
    // try fallback with \n
    const targetStr2 = targetStr.replace(/\r\n/g, '\n');
    const replacementStr2 = replacementStr.replace(/\r\n/g, '\n');
    if (code.includes(targetStr2)) {
        code = code.replace(targetStr2, replacementStr2);
        fs.writeFileSync('index.html', code);
        console.log('Fixed syntax error (LF): Replaced "}}" with "}"');
    } else {
        console.log('Could not find the target string "}}" to fix!');
    }
}
