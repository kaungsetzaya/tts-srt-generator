import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';
config();

const geminiKey = process.env.GEMINI_API_KEY;
if (!geminiKey) {
  console.error("❌ Error: GEMINI_API_KEY not found in .env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(geminiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

async function test() {
  console.log("⏳ Sending text to Gemini for translation...");
  const prompt = "Act as a Burmese Movie Recapper. Translate this: 'Elias unlocked the heavy steel doors and found the key.'";
  
  try {
    const result = await model.generateContent(prompt);
    console.log("✅ Translation Success!");
    console.log("--------------------------------------------------");
    console.log(result.response.text());
    console.log("--------------------------------------------------");
  } catch (error) {
    console.error("❌ Gemini API Error:", error);
  }
}

test();
