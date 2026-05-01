const WebSocket = require('ws');
const crypto = require('crypto');

function getSecMsGecToken() {
    const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
    // Get Windows File Time (100-nanosecond intervals since Jan 1, 1601)
    // Jan 1, 1970 is 11,644,473,600 seconds after Jan 1, 1601
    const ticks = BigInt(Math.floor(Date.now() / 1000) + 11644473600) * BigInt(10000000);
    // Round down to the nearest 300,000,000,000 (5 minutes)
    const roundedTicks = (ticks / BigInt(3000000000)) * BigInt(3000000000);
    const strToHash = roundedTicks.toString() + TRUSTED_CLIENT_TOKEN;
    return crypto.createHash('sha256').update(strToHash).digest('hex').toUpperCase();
}

async function getEdgeTTS(text, voice) {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomBytes(16).toString('hex');
    const endpoint = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4&ConnectionId=' + requestId;

    console.log('Connecting to:', endpoint);
    const secMsGec = getSecMsGecToken();
    console.log('Sec-MS-GEC:', secMsGec);

    const ws = new WebSocket(endpoint, {
      headers: {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
        'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'Sec-MS-GEC': secMsGec,
        'Sec-MS-GEC-Version': '1-143.0.3650.75'
      }
    });

    let audioData = Buffer.alloc(0);
    let timeout = setTimeout(() => { ws.close(); reject(new Error('TTS Timeout')); }, 10000);

    ws.on('open', () => {
      console.log('Connected!');
      const config = 'Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}';
      let lang = voice.startsWith('pt-BR') ? 'pt-BR' : 'en-US';
      const ssml = 'X-RequestId:' + requestId + '\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n<speak version=\'1.0\' xmlns=\'http://www.w3.org/2001/10/synthesis\' xml:lang=\'' + lang + '\'><voice name=\'' + voice + '\'><prosody pitch=\'+0Hz\' rate=\'+10%\' volume=\'+0%\'>' + text + '</prosody></voice></speak>';
      ws.send(config);
      ws.send(ssml);
    });

    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        const index = data.indexOf(Buffer.from('Path:audio\r\n'));
        if (index !== -1) {
          audioData = Buffer.concat([audioData, data.slice(index + 12)]);
        }
      } else {
        const msg = data.toString();
        if (msg.includes('Path:turn.end')) {
          clearTimeout(timeout);
          ws.close();
          resolve(audioData);
        }
      }
    });

    ws.on('error', (err) => { 
        console.error('WS Error:', err);
        clearTimeout(timeout); 
        reject(err); 
    });
    
    ws.on('close', (code, reason) => {
        console.log('WS Closed:', code, reason.toString());
    });
  });
}

getEdgeTTS('Hello test', 'en-US-GuyNeural')
    .then(data => console.log('Success! Got', data.length, 'bytes'))
    .catch(err => console.error('Failed:', err));
