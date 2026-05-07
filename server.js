const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const Groq = require("groq-sdk");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));

/* Serve website files */
app.use(express.static(__dirname));

if (!process.env.GROQ_API_KEY) {
    console.log("❌ Missing GROQ_API_KEY in .env");
    process.exit(1);
}

const ai = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

const MODELS = ["llama3-8b-8192"];

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

            const result = await ai.chat.completions.create({
    messages: [
        {
            role: "user",
            content: finalPrompt
        }
    ],
    model: "llama3-8b-8192"
});

return result.choices[0].message.content;
            
}catch(err){
    console.log("MODEL ERROR:", err);
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
