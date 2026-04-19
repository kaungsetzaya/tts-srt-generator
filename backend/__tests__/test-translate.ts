import "dotenv/config";
import { geminiTranslate } from "../geminiTranslator";

async function runTest() {
    console.log("⏳ Testing Gemini Translation with .env API Key...");
    
    // API Key ရှိမရှိ စစ်ဆေးခြင်း
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("❌ Error: GEMINI_API_KEY is missing in .env file!");
        process.exit(1);
    }
    console.log(`🔑 Key found: ${key.substring(0, 10)}...`);

    try {
        const textToTranslate = "Hello, welcome to our video. Today we will show you an amazing AI tool.";
        console.log(`📝 Original Text: "${textToTranslate}"\n`);
        
        const res = await geminiTranslate(textToTranslate);
        
        console.log("✅ Success!");
        console.log("🤖 Model Used:", res.modelUsed);
        console.log("🇲🇲 Translated:", res.myanmar);
    } catch (err: any) {
        console.error("\n❌ Error:", err.message);
    }
}

runTest();
