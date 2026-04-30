const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));

/* Serve website files */
app.use(express.static(__dirname));

if (!process.env.GEMINI_API_KEY) {
    console.log("❌ Missing GEMINI_API_KEY");
    process.exit(1);
}

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-pro-latest",
    "gemini-1.5-flash-latest"
];

let memory = [];

function currentDate() {
    return new Date().toLocaleString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function smartMath(exp) {
    try {
        if (!/^[0-9+\-*/(). %]+$/.test(exp)) return null;
        return eval(exp);
    } catch {
        return null;
    }
}

/* ROOT WEBSITE PAGE */
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

async function askNexora(prompt, image) {

    const text = (prompt || "").toLowerCase().trim();

    if (
        text.includes("who is your founder") ||
        text.includes("who founded you") ||
        text.includes("founder of cwa") ||
        text.includes("who is founder of cwa") ||
        text.includes("who is the founder")
    ) {
        return "Karthik Jayaprakash is the founder of CWA.";
    }

    if (
        text.includes("date") ||
        text.includes("time") ||
        text === "today"
    ) {
        return "Current date and time: " + currentDate();
    }

    if (
        text.includes("richest person") ||
        text.includes("richest man") ||
        text.includes("richest human")
    ) {
        return "Elon Musk is widely ranked among the richest people in the world currently. Rankings can change often based on markets.";
    }

    if (text.includes("richest country")) {
        return "- Luxembourg\n- Ireland\n- Singapore\n- Qatar\n- Norway";
    }

    const calc = smartMath(text);
    if (calc !== null) {
        return "Answer: " + calc;
    }

    let lastError = null;

    for (const model of MODELS) {
        try {

            const history = memory.join("\n");

            const finalPrompt = `
You are Nexora AI.

Rules:
- Give excellent modern answers
- Sound natural and intelligent
- Plain text only
- Use bullet points with -
- NEVER say "as of my last knowledge update"
- NEVER mention training cutoff
- Give present-day answers confidently
- If facts can change, say rankings may change
- Keep answers neat and readable
- Use memory for follow-up questions
- Understand short prompts like:
  just names
  short answer
  explain more
  only list
- If image is sent, analyze it clearly
- Solve calculations correctly
- Do not mention date unless asked

Recent Chat:
${history}

User Question:
${prompt || "Analyze this image"}
`;

            let contents;

            if (image) {
                const base64 = image.split(",")[1];

                contents = [
                    { text: finalPrompt },
                    {
                        inlineData: {
                            mimeType: "image/png",
                            data: base64
                        }
                    }
                ];
            } else {
                contents = finalPrompt;
            }

            const result = await ai.models.generateContent({
                model: model,
                contents: contents
            });

            return result.text;

        } catch (err) {
            lastError = err;
        }
    }

    throw lastError;
}

app.post("/api/nexora", async (req, res) => {
    try {

        const prompt = req.body.prompt || "";
        const image = req.body.image || null;

        const reply = await askNexora(prompt, image);

        memory.push("User: " + (prompt || "Image Request"));
        memory.push("Nexora: " + reply);

        if (memory.length > 24) {
            memory = memory.slice(-24);
        }

        res.json({
            response: reply
        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            response: "All AI models unavailable or quota reached."
        });
    }
});

app.listen(PORT, () => {
    console.log("🚀 Nexora AI Online");
});
