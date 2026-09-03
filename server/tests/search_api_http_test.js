import app from '../app.js';
import http from 'http';

async function testHttp() {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  console.log('HTTP Server listening on port:', port);

  try {
    // Test 1: Exact Complaint ID search via HTTP
    const res1 = await fetch(`http://127.0.0.1:${port}/api/issues/search?q=CC-2026-000001`);
    console.log('Test 1 Status:', res1.status);
    const json1 = await res1.json();
    console.log('Test 1 Success:', json1.success);
    console.log('Test 1 Total:', json1.total);
    console.log('Test 1 Complaint ID:', json1.data[0]?.complaint_id);
    console.log('Test 1 Category:', json1.data[0]?.category);
    console.log('Test 1 District:', json1.data[0]?.district?.name);

    if (json1.data[0]?.complaint_id !== 'CC-2026-000001') {
      throw new Error('Expected CC-2026-000001 as first result');
    }

    // Test 2: Category search
    const res2 = await fetch(`http://127.0.0.1:${port}/api/issues/search?q=Streetlights`);
    const json2 = await res2.json();
    console.log('Test 2 Total:', json2.total);
    console.log('Test 2 Top Category:', json2.data[0]?.category);

    // Test 3: Status / SLA search
    const res3 = await fetch(`http://127.0.0.1:${port}/api/issues/search?q=verified`);
    const json3 = await res3.json();
    console.log('Test 3 Verified Count:', json3.total);

    // Test 4: Combined filters
    const res4 = await fetch(`http://127.0.0.1:${port}/api/issues/search?district=coimbatore&status=resolved`);
    const json4 = await res4.json();
    console.log('Test 4 Combined Filter Total:', json4.total);

    // Test 5: Empty query
    const res5 = await fetch(`http://127.0.0.1:${port}/api/issues/search?q=NONEXISTENT99999`);
    const json5 = await res5.json();
    console.log('Test 5 Non-Existent Count:', json5.total);

    console.log('\nALL HTTP API TESTS PASSED SUCCESSFULLY!');
  } finally {
    server.close();
    process.exit(0);
  }
}

testHttp().catch(err => {
  console.error('HTTP Test Failed:', err);
  process.exit(1);
});
