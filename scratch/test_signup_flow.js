import dotenv from 'dotenv';

dotenv.config();

// We will fetch the endpoint to test the full flow
async function runTest() {
  console.log("==============================================");
  console.log("  Testing Signup Welcome Email Audit Flow");
  console.log("==============================================");

  const PORT = process.env.PORT || 5000;
  const url = `http://localhost:${PORT}/api/auth/send-welcome`;

  const payload = {
    email: process.env.TEST_RECIPIENT_EMAIL || "test-signup@example.com",
    userId: "a0eebc99-9c0b-4ef8-bb6d-" + Date.now().toString().slice(-12),
    fullName: "Test User"
  };

  console.log(`Sending POST to ${url}...`);
  console.log("Payload:", JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log("Response Status:", response.status);
    console.log("Response Data:", JSON.stringify(data, null, 2));
    console.log("==============================================");
  } catch (err) {
    console.error("Test Request Crashed:", err);
    console.log("==============================================");
  }
}

runTest();
