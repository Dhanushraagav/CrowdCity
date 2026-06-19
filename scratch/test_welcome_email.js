import dotenv from 'dotenv';
import { sendWelcomeEmail } from '../server/services/emailService.js';

dotenv.config();

async function testWelcomeEmail() {
  console.log("==============================================");
  console.log("  Testing Welcome Email Integration");
  console.log(`  RESEND_API_KEY Configured: ${process.env.RESEND_API_KEY ? 'YES' : 'NO'}`);
  console.log("==============================================");

  const testEmail = process.env.TEST_RECIPIENT_EMAIL || 'test-user@example.com';
  const testName = 'Test User';

  try {
    const success = await sendWelcomeEmail(testEmail, testName);
    console.log(`  Send Welcome Email Success: ${success}`);
    console.log("==============================================");
  } catch (err) {
    console.error("  Test Crashed:", err);
    console.log("==============================================");
  }
}

testWelcomeEmail();
