import "dotenv/config";
import { geminiTranslate } from "../geminiTranslator";

async function runTest() {
    console.log("Ã¢ÂÂ³ Testing Gemini Translation with .env API Key...");
    
    // API Key Ã¡â‚¬â€ºÃ¡â‚¬Â¾Ã¡â‚¬Â­Ã¡â‚¬â„¢Ã¡â‚¬â€ºÃ¡â‚¬Â¾Ã¡â‚¬Â­ Ã¡â‚¬â€¦Ã¡â‚¬â€¦Ã¡â‚¬ÂºÃ¡â‚¬â€ Ã¡â‚¬Â±Ã¡â‚¬Â¸Ã¡â‚¬ÂÃ¡â‚¬Â¼Ã¡â‚¬â€žÃ¡â‚¬ÂºÃ¡â‚¬Â¸
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("Ã¢ÂÅ’ Error: GEMINI_API_KEY is missing in .env file!");
        process.exit(1);
    }
    console.log(`Ã°Å¸â€â€˜ Key found: ${key.substring(0, 10)}...`);

    try {
        const textToTranslate = "Hello, welcome to our video. Today we will show you an amazing AI tool.";
        console.log(`Ã°Å¸â€œÂ Original Text: "${textToTranslate}"\n`);
        
        const res = await geminiTranslate(textToTranslate);
        
        console.log("Ã¢Å“â€¦ Success!");
        console.log("Ã°Å¸Â¤â€“ Model Used:", res.modelUsed);
        console.log("Ã°Å¸â€¡Â²Ã°Å¸â€¡Â² Translated:", res.myanmar);
    } catch (err: any) {
        console.error("\nÃ¢ÂÅ’ Error:", err.message);
    }
}

runTest();
