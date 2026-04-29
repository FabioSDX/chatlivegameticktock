const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

// The syntax error fix if it exists
if (code.includes('            }}')) {
    code = code.replace('            }}', '            }');
}

fs.writeFileSync('index.html', code);
