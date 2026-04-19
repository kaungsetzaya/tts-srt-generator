import { geminiTranslateBatch } from "../geminiTranslator";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

async function runBatchTest() {
  console.log("--- Gemini Batch Translation Test (Video Mode) ---");

  // Simulating 5 video segments
  const segments = [
    { index: 1, start: 0, end: 2, text: "Welcome to our channel." },
    { index: 2, start: 2, end: 4, text: "Today we talk about zombies." },
    { index: 3, start: 4, end: 6, text: "The virus is spreading fast." },
    { index: 4, start: 6, end: 8, text: "We need to find a cure." },
    { index: 5, start: 8, end: 10, text: "Stay safe out there." }
  ];

  try {
    const result = await geminiTranslateBatch(segments);
    
    console.log("\n--- Results ---");
    result.translated.forEach((seg, i) => {
      console.log(`[${i+1}] Original: ${segments[i].text}`);
      console.log(`    Myanmar:  ${seg.text || "❌ EMPTY OUTPUT"}`);
    });

    if (result.translated.every(s => s.text && s.text !== segments[result.translated.indexOf(s)].text)) {
      console.log("\n✅ Batch Translation Working Perfectly.");
    } else {
      console.log("\n⚠️ Some segments returned empty or original text.");
    }
  } catch (error: any) {
    console.error(`\n❌ Batch Error: ${error.message}`);
  }
}

runBatchTest();
