// scripts/llm_utils.js

export async function callLLM(apiKey, model, systemPrompt, userPrompt) {
    if (!apiKey) {
        throw new Error("API Key is missing. Please check Settings.");
    }

    if (model.includes("gpt")) {
        return callOpenAI(apiKey, model, systemPrompt, userPrompt);
    } else {
        return callGemini(apiKey, model, systemPrompt, userPrompt);
    }
}

async function callOpenAI(apiKey, model, systemPrompt, userPrompt) {
    const url = "https://api.openai.com/v1/chat/completions";
    const body = {
        model: model,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ],
        temperature: 0.7
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error?.message || "OpenAI API Error");
        }
        return data.choices[0].message.content;
    } catch (error) {
        console.error("OpenAI Error:", error);
        throw error;
    }
}

async function callGemini(apiKey, model, systemPrompt, userPrompt) {
    // Map model name to Gemini API format if needed, but 'gemini-1.5-flash' should render to valid URL path
    // Endpoint: https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=API_KEY

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const body = {
        contents: [{
            parts: [{ text: `${systemPrompt}\n\nUser: ${userPrompt}` }] // Gemini doesn't strictly distinguish system/user in same way as simple messages sometimes, but this works well.
        }]
    };

    // Note: For better system instruction support in Gemini 1.5, we should use the system_instruction field if supported by the endpoint version,
    // but appending to prompt is a robust fallback for simple extensions.

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error?.message || "Gemini API Error");
        }

        // Extract text
        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error("Gemini Error:", error);
        throw error;
    }
}
