const express = require("express");
const cors = require("cors");
require("dotenv").config();

const Groq = require("groq-sdk");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));

if (!process.env.GROQ_API_KEY) {
    console.log("❌ Missing GROQ_API_KEY in .env");
    process.exit(1);
}

const ai = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

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

app.get("/", (req, res) => {
    res.send("🚀 Nexora AI Running");
});

async function askNexora(prompt) {

    const text = (prompt || "").toLowerCase().trim();

    // Founder Logic
    if (
        text.includes("who is your founder") ||
        text.includes("who founded you") ||
        text.includes("founder of cwa") ||
        text.includes("who is founder of cwa") ||
        text.includes("who is the founder")
    ) {
        return "Karthik Jayaprakash is the founder of CWA.";
    }

    // Date and Time Logic
    if (
        text.includes("date") ||
        text.includes("time") ||
        text.includes("today")
    ) {
        return "Current date and time: " + currentDate();
    }

    // Math Logic
    const calc = smartMath(text);
    if (calc !== null) {
        return "Answer: " + calc;
    }

    const history = memory.join("\n");

    const finalPrompt = `
You are Nexora AI.

Rules:
- Give excellent modern answers
- Sound natural and intelligent
- Plain text only
- Use bullet points with -
- Never mention training cutoff
- Keep answers neat and readable
- Use memory for follow-up questions

Recent Chat:
${history}

User Question:
${prompt}
`;

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
}

app.post("/api/nexora", async (req, res) => {
    try {

        const prompt = req.body.prompt || "";

        const reply = await askNexora(prompt);

        memory.push("User: " + prompt);
        memory.push("Nexora: " + reply);

        if (memory.length > 24) {
            memory = memory.slice(-24);
        }

        res.json({
            response: reply
        });

    } catch (err) {

        console.log("REAL ERROR:", err);

        res.status(500).json({
            response: "Groq AI error."
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Nexora AI Online on port ${PORT}`);
});
