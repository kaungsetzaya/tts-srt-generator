import "dotenv/config";
import { geminiService } from "../src/modules/translation/services/gemini.service";

async function runTest() {
    console.log("Testing Gemini Translation with .env API Key...");
    
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("Error: GEMINI_API_KEY is missing in .env file!");
        process.exit(1);
    }
    console.log(`Key found: ${key.substring(0, 10)}...`);

    try {
        const textToTranslate = "Hello, welcome to our video. Today we will show you an amazing AI tool.";
        console.log(`Original Text: "${textToTranslate}"\n`);
        
        const res = await geminiService.translateFullText(textToTranslate);
        
        console.log("Success!");
        console.log("Translated:", res);
    } catch (err: any) {
        console.error("\nError:", err.message);
    }
}

runTest();
