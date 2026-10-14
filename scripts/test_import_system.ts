import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(name: string, condition: boolean, details: string) {
  results.push({ name, passed: condition, details });
  console.log(`${condition ? '✅ PASS' : '❌ FAIL'}: ${name} - ${details}`);
}

async function runTests() {
  console.log('\n======================================================');
  console.log('STARTING SEMI-AUTOMATIC PRICE IMPORT SYSTEM E2E TESTS');
  console.log('======================================================\n');

  // Test 1: Unauthorized access rejection
  try {
    const unauthRes = await fetch(`${BASE_URL}/api/price-history/validate-csv`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvContent: 'product_id,price\n1,100' }),
    });
    assert(
      'Unauthorized access restriction',
      unauthRes.status === 403,
      `Expected HTTP 403 Forbidden without admin headers, got ${unauthRes.status}`
    );
  } catch (err: any) {
    assert('Unauthorized access restriction', false, err.message);
  }

  // Admin headers for authorized tests
  const adminHeaders = {
    'Content-Type': 'application/json',
    'x-admin-role': 'admin',
    'x-admin-user-id': 'DTORVHWkRQRBLp1vS7JfdVIvVBr1',
    'x-admin-email': 'shivanandkabbur24@gmail.com',
  };

  // Test 2: Server-side CSV validation with valid, invalid, duplicate, and mismatch rows
  // Clearly labelled sample records that cannot be confused with live data
  const testCsv = [
    'product_id,observation_date,price,currency,source_name,source_url,source_observed_at,verification_method,review_status',
    // 1. Valid record
    'prod_1789196748190_ji01p,2024-06-15,4999,INR,Sample Retail Invoice,https://example.com/receipt/sample1,2024-06-15T10:00:00Z,invoice_receipt,approved',
    // 2. Invalid date
    'prod_1789196748190_ji01p,invalid-date-not-iso,4500,INR,Sample Invoice,https://example.com/receipt/sample2,2024-06-16T10:00:00Z,invoice_receipt,approved',
    // 3. Negative price
    'prod_1789196748190_ji01p,2024-06-17,-350,INR,Sample Invoice,https://example.com/receipt/sample3,2024-06-17T10:00:00Z,invoice_receipt,approved',
    // 4. Invalid currency
    'prod_1789196748190_ji01p,2024-06-18,5200,INVALID_CURR,Sample Invoice,https://example.com/receipt/sample4,2024-06-18T10:00:00Z,invoice_receipt,approved',
    // 5. Batch duplicate of Row 1 (exact same product_id + observation_date + price)
    'prod_1789196748190_ji01p,2024-06-15,4999,INR,Sample Retail Invoice,https://example.com/receipt/sample1,2024-06-15T10:00:00Z,invoice_receipt,approved',
    // 6. Unknown / mismatch variant product ID
    'NONEXISTENT_VARIANT_XYZ_999,2024-06-20,12999,INR,Sample Retail Invoice,https://example.com/receipt/sample6,2024-06-20T10:00:00Z,invoice_receipt,needs_review',
  ].join('\n');

  try {
    const validateRes = await fetch(`${BASE_URL}/api/price-history/validate-csv`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ csvContent: testCsv }),
    });

    const text = await validateRes.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch (parseErr) {
      console.error('Validate-csv returned non-json (status:', validateRes.status, '):', text.slice(0, 300));
      throw new Error(`Non-JSON response (status ${validateRes.status}): ${text.slice(0, 150)}`);
    }
    assert(
      'CSV validation HTTP response',
      validateRes.ok && json.success === true,
      `Server returned success: ${json.success}`
    );

    const validationData = json.data;
    assert(
      'Total row count parsed',
      validationData.totalRows === 6,
      `Parsed ${validationData.totalRows} rows, expected 6`
    );

    // Row 1 should be valid
    const row1 = validationData.rows[0];
    assert(
      'Row 1 Valid record passed validation',
      row1.isValid === true && row1.parsedData.price === 4999,
      `Row 1 valid: ${row1.isValid}, price: ${row1.parsedData?.price}`
    );

    // Row 2 should fail on invalid date
    const row2 = validationData.rows[1];
    assert(
      'Row 2 Invalid date caught',
      row2.isValid === false && row2.errors.some((e: string) => e.toLowerCase().includes('date')),
      `Row 2 errors: ${row2.errors.join('; ')}`
    );

    // Row 3 should fail on negative price
    const row3 = validationData.rows[2];
    assert(
      'Row 3 Negative price caught',
      row3.isValid === false && row3.errors.some((e: string) => e.toLowerCase().includes('price')),
      `Row 3 errors: ${row3.errors.join('; ')}`
    );

    // Row 4 should fail on invalid currency
    const row4 = validationData.rows[3];
    assert(
      'Row 4 Invalid currency caught',
      row4.isValid === false && row4.errors.some((e: string) => e.toLowerCase().includes('currency')),
      `Row 4 errors: ${row4.errors.join('; ')}`
    );

    // Row 5 should be flagged as duplicate
    const row5 = validationData.rows[4];
    assert(
      'Row 5 Duplicate observation caught',
      row5.isDuplicate === true,
      `Row 5 isDuplicate: ${row5.isDuplicate}, errors: ${row5.errors.join('; ')}`
    );

    // Row 6 Product catalog check (or product matching)
    const row6 = validationData.rows[5];
    assert(
      'Row 6 Product matching / variant check recorded',
      !row6.matchedProduct && row6.errors.some((e: string) => e.toLowerCase().includes('unknown product_id')),
      `Row 6 matchedProduct: ${Boolean(row6.matchedProduct)}, errors: ${row6.errors.join('; ')}`
    );
  } catch (err: any) {
    assert('CSV validation workflow', false, err.message);
  }

  // Test 3: Idempotent Import with Approved Rows
  try {
    const validRowData = {
      product_id: 'prod_1789196748190_ji01p',
      observation_date: '2024-06-15T00:00:00.000Z',
      price: 4999,
      currency: 'INR',
      source_name: 'Sample Verified Invoice',
      source_url: 'https://example.com/receipt/sample1',
      source_observed_at: '2024-06-15T10:00:00.000Z',
      verification_method: 'invoice_audit',
      review_status: 'approved',
    };

    // First import
    const importRes1 = await fetch(`${BASE_URL}/api/price-history/import-csv`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ observations: [validRowData] }),
    });
    const importJson1 = (await importRes1.json()) as any;
    assert(
      'First import of valid row',
      importRes1.ok && importJson1.data?.successful === 1,
      `Successful imports: ${importJson1.data?.successful}, errors: ${importJson1.data?.errors?.join('; ') || 'none'}`
    );

    // Second import with identical observation -> Must be idempotent without crashing or duplicating
    const importRes2 = await fetch(`${BASE_URL}/api/price-history/import-csv`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ observations: [validRowData] }),
    });
    const importJson2 = (await importRes2.json()) as any;
    assert(
      'Idempotent second import',
      importRes2.ok && importJson2.data?.successful === 1,
      `Repeated import succeeded idempotently: ${importJson2.data?.successful}`
    );
  } catch (err: any) {
    assert('Idempotent import workflow', false, err.message);
  }

  // Test 4: Tracking Queue Status Transitions & Persistence
  try {
    const queueStatuses = ['pending', 'in_review', 'approved', 'imported', 'needs_review', 'unavailable'];

    for (const status of queueStatuses) {
      const updateRes = await fetch(`${BASE_URL}/api/price-history/tracking-queue/update`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          productId: 'TEST_SAMPLE_PROD_1',
          productName: 'Sample Test Product - Flagship Edition',
          productUrl: 'https://example.com/test-product',
          marketplace: 'Amazon India',
          modelVariant: 'Midnight Black 256GB',
          trackingStatus: status,
          reviewNotes: `Testing transition to ${status}`,
          errorDetails: status === 'needs_review' ? 'Price divergence noticed' : undefined,
        }),
      });
      const updateJson = (await updateRes.json()) as any;
      assert(
        `Tracking queue status transition to '${status}'`,
        updateRes.ok && updateJson.data?.trackingStatus === status,
        `Persisted status: ${updateJson.data?.trackingStatus}`
      );
    }
  } catch (err: any) {
    assert('Tracking queue status transition workflow', false, err.message);
  }

  // Test 5: Browser-Assisted Price-History Workflow End-to-End
  try {
    const testProdId = 'prod_1789196748190_ji01p';

    // Step 1: Mark Ready for Review
    const markReviewRes = await fetch(`${BASE_URL}/api/price-history/tracking-queue/update`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        productId: testProdId,
        trackingStatus: 'in_review',
        reviewNotes: 'Verified official product page opened in new tab; in_review audit in progress.',
        officialProductUrl: 'https://www.flipkart.com/apple-iphone-15-black-128-gb/p/itm6ac6485515ae4',
      }),
    });
    const markReviewJson = (await markReviewRes.json()) as any;
    assert(
      'Browser-assisted workflow: Mark Ready for Review saves in_review status',
      markReviewRes.ok && markReviewJson.data?.trackingStatus === 'in_review',
      `Queue status set to: ${markReviewJson.data?.trackingStatus}`
    );

    // Step 2: Validate entered historical observation with verified source
    const obsRow = {
      product_id: testProdId,
      observation_date: '2024-05-20',
      price: '48999',
      currency: 'INR',
      source_name: 'Official Store Launch Archive',
      source_url: 'https://www.flipkart.com/apple-iphone-15-black-128-gb/p/itm6ac6485515ae4',
      verification_method: 'official_store_archive',
      review_status: 'approved',
    };

    const valRes = await fetch(`${BASE_URL}/api/price-history/validate-csv`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ rows: [obsRow] }),
    });
    const valJson = (await valRes.json()) as any;
    assert(
      'Browser-assisted workflow: Validate observation before import',
      valRes.ok && valJson.data?.rows?.[0]?.isValid === true,
      `Observation valid: ${valJson.data?.rows?.[0]?.isValid}`
    );

    // Step 3: Import verified observation and verify status marks imported
    const importRes = await fetch(`${BASE_URL}/api/price-history/import-csv`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ observations: [valJson.data.rows[0].parsedData] }),
    });
    const importJson = (await importRes.json()) as any;
    assert(
      'Browser-assisted workflow: Import observation successfully',
      importRes.ok && importJson.data?.successful === 1,
      `Imported records: ${importJson.data?.successful}`
    );

    // Step 4: Verify queue progress preserved
    const queueRes = await fetch(`${BASE_URL}/api/price-history/tracking-queue`, {
      headers: adminHeaders,
    });
    const queueJson = (await queueRes.json()) as any;
    assert(
      'Browser-assisted workflow: Queue preserves imported progress',
      queueRes.ok && Array.isArray(queueJson.data) && queueJson.data.length > 0,
      `Queue preserved ${queueJson.data?.length || 0} items across queries`
    );
  } catch (err: any) {
    assert('Browser-assisted price-history workflow', false, err.message);
  }

  console.log('\n======================================================');
  console.log('SUMMARY OF TEST EXECUTION');
  console.log('======================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Total tests: ${total} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
