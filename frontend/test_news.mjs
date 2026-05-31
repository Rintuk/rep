import https from 'https';

https.get('https://rep-production-cf90.up.railway.app/api/news', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const items = JSON.parse(data);
      console.log('Status:', res.statusCode);
      if (Array.isArray(items)) {
        console.log(`Found ${items.length} news items.`);
        items.slice(0, 3).forEach(n => {
          console.log(`ID: ${n.id}, Title: ${n.title}, has_image: ${!!n.image_url}, image_len: ${n.image_url ? n.image_url.length : 0}`);
        });
      } else {
        console.log('Response not an array:', items);
      }
    } catch (e) {
      console.log('Error parsing JSON:', data.substring(0, 100));
    }
  });
}).on('error', err => {
  console.log('Error:', err.message);
});
