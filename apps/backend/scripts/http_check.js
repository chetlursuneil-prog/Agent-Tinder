const http = require('http');
const url = 'http://localhost:3002/swipe';

http.get(url, (res) => {
  console.log('statusCode', res.statusCode);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('bodyLength', data.length);
    console.log('bodyPreview', data.slice(0, 200));
  });
}).on('error', (e) => {
  console.error('ERR', e.message);
});
