// Uses Groq if GROQ_API_KEY is set, otherwise Gemini if GEMINI_API_KEY is set. Both are free.
exports.handler = async (event) => {
  try {
    const { messages = [], system = "" } = JSON.parse(event.body || "{}");
    const sys = String(system).slice(0, 4000);
    const msgs = messages.slice(-20).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content) }));

    if (process.env.GROQ_API_KEY) {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer " + process.env.GROQ_API_KEY },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
          max_tokens: 500,
          messages: [{ role: "system", content: sys }, ...msgs],
        }),
      });
      const d = await r.json();
      if (!r.ok) return out(r.status, { error: (d.error && d.error.message) || "Groq API error" });
      return out(200, { text: d.choices[0].message.content || "…" });
    }

    if (process.env.GEMINI_API_KEY) {
      const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sys }] },
          contents: msgs.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
          generationConfig: { maxOutputTokens: 600 },
        }),
      });
      const d = await r.json();
      if (!r.ok) return out(r.status, { error: (d.error && d.error.message) || "Gemini API error" });
      const text = ((d.candidates || [])[0]?.content?.parts || []).map((p) => p.text || "").join("");
      return out(200, { text: text || "…" });
    }

    return out(500, { error: "No key found. Add GROQ_API_KEY (or GEMINI_API_KEY) in Netlify environment variables, then redeploy." });
  } catch (e) {
    return out(500, { error: String(e.message || e) });
  }
};
const out = (s, b) => ({ statusCode: s, headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
