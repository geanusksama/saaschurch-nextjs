const https = require('https');

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, statusText: res.statusMessage, body: data, headers: res.headers }));
    }).on('error', reject);
  });
}

async function main() {
  console.log("=== CHECKING OLD SUPABASE PROJECT STORAGE ===");

  const oldUrl = 'https://uoswswovjcycsamjawnl.supabase.co/storage/v1/object/public/fotos/fotodespesa/325696_1778009060190.jpg';
  console.log(`Fetching from old project: ${oldUrl}`);
  try {
    const result = await httpGet(oldUrl);
    console.log(`Status: ${result.status} ${result.statusText}`);
    console.log(`Content-Type: ${result.headers['content-type']}`);
    console.log(`Content-Length: ${result.headers['content-length']}`);
    if (result.status === 200) {
      console.log('File successfully found in the old project!');
    } else {
      console.log('Response body:', result.body);
    }
  } catch (e) {
    console.error('HTTP fetch error:', e);
  }
}

main().catch(console.error);
