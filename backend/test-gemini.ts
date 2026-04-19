import { geminiTranslate } from "./geminiTranslator";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the .env file located one level up
dotenv.config({ path: path.join(__dirname, "../.env") });

async function runTest() {
  console.log("--- Gemini Manual Translation Test ---");
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ Error: GEMINI_API_KEY not found in .env");
    console.log("Current path looking for .env:", path.join(__dirname, "../.env"));
    process.exit(1);
  }

  const text = "Hello, this is a test. Is the zombie dictionary working?";

  try {
    console.log(`Input: "${text}"`);
    console.log("Translating...");
    
    const result = await geminiTranslate(text);
    
    console.log("\n✅ Success!");
    console.log(`Model Used: ${result.modelUsed}`);
    console.log(`Myanmar Output: ${result.myanmar}`);
    
    if (result.myanmar.includes("ဇွန်ဘီး")) {
      console.log("✨ Phonetic Dictionary: Working (Zombie -> ဇွန်ဘီး)");
    }
  } catch (error: any) {
    console.error(`\n❌ Translation Failed: ${error.message}`);
  }
}

runTest();
