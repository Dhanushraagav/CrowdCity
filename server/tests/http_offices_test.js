import app from '../app.js';
import assert from 'assert';

const server = app.listen(0, async () => {
  const port = server.address().port;
  console.log(`Express testing server listening on http://127.0.0.1:${port}`);

  try {
    // 1. GET /api/offices
    const resOffices = await fetch(`http://127.0.0.1:${port}/api/offices`);
    assert.strictEqual(resOffices.status, 200, 'GET /api/offices should return 200');
    const jsonOffices = await resOffices.json();
    assert.strictEqual(jsonOffices.success, true);
    assert(jsonOffices.total >= 50, `Expected >= 50 offices, got ${jsonOffices.total}`);
    console.log(`✓ GET /api/offices: HTTP 200, Total: ${jsonOffices.total} offices returned`);

    // 2. GET /api/offices/districts
    const resDistricts = await fetch(`http://127.0.0.1:${port}/api/offices/districts`);
    assert.strictEqual(resDistricts.status, 200, 'GET /api/offices/districts should return 200');
    const jsonDistricts = await resDistricts.json();
    assert.strictEqual(jsonDistricts.success, true);
    assert.strictEqual(jsonDistricts.count, 38, 'Should have all 38 districts');
    console.log(`✓ GET /api/offices/districts: HTTP 200, Covered all ${jsonDistricts.count} TN districts`);

    // 3. GET /api/offices/:id
    const resSingle = await fetch(`http://127.0.0.1:${port}/api/offices/off-col-chennai`);
    assert.strictEqual(resSingle.status, 200, 'GET /api/offices/:id should return 200');
    const jsonSingle = await resSingle.json();
    assert.strictEqual(jsonSingle.success, true);
    assert.strictEqual(jsonSingle.data.id, 'off-col-chennai');
    console.log(`✓ GET /api/offices/:id: HTTP 200, Found "${jsonSingle.data.name}"`);

    // 4. GET /api/government-offices alias
    const resAlias = await fetch(`http://127.0.0.1:${port}/api/government-offices?type=collectorate`);
    assert.strictEqual(resAlias.status, 200);
    const jsonAlias = await resAlias.json();
    assert(jsonAlias.total >= 38, 'Collectorates count should be >= 38');
    console.log(`✓ GET /api/government-offices (alias): HTTP 200, Found ${jsonAlias.total} Collectorates`);

    // 5. Test page alias /office-locator
    const resPage = await fetch(`http://127.0.0.1:${port}/office-locator`);
    assert.strictEqual(resPage.status, 200);
    const html = await resPage.text();
    assert(html.includes('Find Nearby Government Offices'), 'HTML should contain title');
    console.log('✓ GET /office-locator: HTTP 200, Successfully serves client/office-locator.html');

    console.log('\n🎉 ALL HTTP ENDPOINTS VERIFIED SUCCESSFULLY!\n');
    server.close(() => process.exit(0));
  } catch (err) {
    console.error('HTTP Test Failure:', err);
    server.close(() => process.exit(1));
  }
});
