import { geminiService } from "../src/modules/translation/services/gemini.service";
import * as dotenv from "dotenv";
import path from "path";

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, "../.env") });

async function runTest() {
  console.log("--- Gemini Manual Translation Test ---");
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Error: GEMINI_API_KEY not found in .env");
    process.exit(1);
  }

  // Sample text to translate
  const text = "Hello, this is a test for the TTS generator. We are checking if the zombie dictionary works.";

  try {
    console.log(`Input: "${text}"`);
    console.log("Translating...");
    
    const result = await geminiService.translateFullText(text);
    
    console.log("\nSuccess!");
    console.log(`Myanmar Output: ${result}`);
    
    // Verify if phonetic dictionary was applied
    // Zombie -> ဇမ်ဘီး
    if (result.includes("ဇမ်ဘီး")) {
      console.log("Phonetic Dictionary: Working (Zombie -> ဇမ်ဘီး)");
    }
  } catch (error: any) {
    console.error(`\nTranslation Failed: ${error.message}`);
  }
}

runTest();
