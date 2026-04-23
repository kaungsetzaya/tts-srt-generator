import { geminiService } from "../src/modules/translation/services/gemini.service";
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
    const result = await geminiService.translateSegments(segments);
    
    console.log("\n--- Results ---");
    result.forEach((seg, i) => {
      console.log(`[${i+1}] Original: ${segments[i].text}`);
      console.log(`    Myanmar:  ${seg.translatedText || "EMPTY OUTPUT"}`);
    });

    if (result.every(s => !!s.translatedText && s.translatedText !== segments[result.indexOf(s)].text)) {
      console.log("\nBatch Translation Working Perfectly.");
    } else {
      console.log("\nSome segments returned empty or original text.");
    }
  } catch (error: any) {
    console.error(`\nBatch Error: ${error.message}`);
  }
}

runBatchTest();
