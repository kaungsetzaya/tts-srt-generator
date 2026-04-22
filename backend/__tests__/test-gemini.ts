import { geminiTranslate } from "../geminiTranslator";
import * as dotenv from "dotenv";
import path from "path";

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, "../.env") });

async function runTest() {
  console.log("--- Gemini Manual Translation Test ---");
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Ã¢ÂÅ’ Error: GEMINI_API_KEY not found in .env");
    process.exit(1);
  }

  // Sample text to translate
  const text = "Hello, this is a test for the TTS generator. We are checking if the zombie dictionary works.";

  try {
    console.log(`Input: "${text}"`);
    console.log("Translating...");
    
    const result = await geminiTranslate(text);
    
    console.log("\nÃ¢Å“â€¦ Success!");
    console.log(`Model Used: ${result.modelUsed}`);
    console.log(`Myanmar Output: ${result.myanmar}`);
    
    // Verify if phonetic dictionary was applied
    if (result.myanmar.includes("Ã¡â‚¬â€¡Ã¡â‚¬Â½Ã¡â‚¬â€Ã¡â‚¬ÂºÃ¡â‚¬ËœÃ¡â‚¬Â®Ã¡â‚¬Â¸")) {
      console.log("Ã¢Å“Â¨ Phonetic Dictionary: Working (Zombie -> Ã¡â‚¬â€¡Ã¡â‚¬Â½Ã¡â‚¬â€Ã¡â‚¬ÂºÃ¡â‚¬ËœÃ¡â‚¬Â®Ã¡â‚¬Â¸)");
    }
  } catch (error: any) {
    console.error(`\nÃ¢ÂÅ’ Translation Failed: ${error.message}`);
  }
}

runTest();
