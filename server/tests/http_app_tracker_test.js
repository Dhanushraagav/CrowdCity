import app from '../app.js';
import http from 'http';
import assert from 'assert';

async function testHttp() {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  console.log(`Express testing server listening on http://127.0.0.1:${port}`);

  try {
    // 1. GET /app-tracker page alias
    const resPage = await fetch(`http://127.0.0.1:${port}/app-tracker`);
    assert.strictEqual(resPage.status, 200, 'GET /app-tracker should return 200');
    const html = await resPage.text();
    assert(html.includes('Organize & Monitor Submitted Applications'), 'HTML should contain title');
    assert(html.includes('Personal Milestone Tracker'), 'HTML should contain disclaimer');
    console.log('✓ GET /app-tracker: HTTP 200, Successfully serves client/app-tracker.html with disclaimer');

    // 2. GET /api/applications without auth token
    const resUnauthGet = await fetch(`http://127.0.0.1:${port}/api/applications`);
    assert.strictEqual(resUnauthGet.status, 401, 'GET /api/applications should reject unauthenticated request with 401');
    const jsonUnauthGet = await resUnauthGet.json();
    assert(jsonUnauthGet.error, 'Should return error message');
    console.log('✓ GET /api/applications: HTTP 401, Protected with requireAuth middleware');

    // 3. POST /api/applications without auth token
    const resUnauthPost = await fetch(`http://127.0.0.1:${port}/api/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheme_name: 'Test', application_ref_no: 'TEST-1' })
    });
    assert.strictEqual(resUnauthPost.status, 401, 'POST /api/applications should reject unauthenticated request with 401');
    console.log('✓ POST /api/applications: HTTP 401, Protected with requireAuth middleware');

    // 4. GET /api/app-tracker alias without auth token
    const resAlias = await fetch(`http://127.0.0.1:${port}/api/app-tracker`);
    assert.strictEqual(resAlias.status, 401, 'GET /api/app-tracker (alias) should reject unauthenticated request with 401');
    console.log('✓ GET /api/app-tracker: HTTP 401, Protected route alias');

    console.log('\n🎉 ALL APP TRACKER HTTP TESTS PASSED SUCCESSFULLY!\n');
    server.close();
  } catch (err) {
    console.error('HTTP Test Failure:', err);
    server.close();
    process.exit(1);
  }
}

testHttp();
