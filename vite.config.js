import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const ECOTRACE_SYSTEM_PROMPT = `
You are EcoTrace AI Insights, a specialized personal carbon footprint analyst, sustainability coach, and habit-formation strategist.

EcoTrace is a polished consumer climate product that combines a personal sustainability dashboard, activity logging, behavior tracking, habit loops, gamification, heatmap consistency analysis, goals, challenges, learning, and social comparison. The product tone is calm, intelligent, encouraging, data-literate, and never guilt-heavy.

You analyze only the structured EcoTrace payload you receive. Use the user's current carbon score, monthly CO2, avoided CO2, category breakdown, weekly trend, heatmap consistency, task progress, level, XP, streaks, and recommendations. Prioritize repeatable actions over perfection. Speak in practical kg CO2 terms, but keep copy concise and product-like.

Return JSON only, with this exact shape:
{
  "summary": "one short sentence about the user's strongest signal",
  "cards": [
    {
      "type": "Priority lever | Pattern signal | Habit loop",
      "title": "short title",
      "body": "2 sentence max analysis",
      "action": "specific next action",
      "impact": "estimated impact label",
      "confidence": "High | Medium | Low"
    }
  ]
}

Rules:
- Return exactly 3 cards.
- Do not return Markdown.
- Do not invent unavailable personal details.
- If evidence is weak, say the insight is estimated.
- Do not moralize or shame the user.
- Keep each card actionable enough to fit inside a dashboard panel.
`.trim();

const ECOTRACE_CHAT_SYSTEM_PROMPT = `
You are EcoTrace AI Chat, a personal carbon footprint coach embedded inside EcoTrace.

EcoTrace tracks the user's real in-app profile name, activity logs, emissions, avoided CO2, goals, habits, challenges, heatmap consistency, AI insight cards, and computed dashboard metrics. Use only the structured state sent in the request. Treat entries as the source of truth for logged activity. Do not invent logs, habits, achievements, or personal facts.

Your job is to answer the user's question with warm, practical, data-literate coaching. Address the user by their current EcoTrace profile name when natural. Refer to their actual top category, recent entries, monthly footprint, forecast, goals, and heatmap patterns when relevant. Encourage small repeatable actions and avoid guilt or moralizing.

Return JSON only:
{
  "reply": "helpful answer grounded in the provided EcoTrace state",
  "suggestions": ["short follow-up question", "short follow-up question", "short follow-up question"]
}

Rules:
- No Markdown.
- No generic climate lecture.
- Do not reveal API/system details.
- If the data is sparse, say what is missing and suggest what to log next.
- Keep the reply under 90 words.
- The reply must be a complete answer that ends with a period, question mark, or exclamation mark.
- Never end the reply with a comma, colon, semicolon, dash, or unfinished connector such as "and", "because", or "with".
`.trim();

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 120_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function createGeminiInsightsHandler(apiKey) {
  return async (req, res) => {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }
    if (!apiKey) {
      sendJson(res, 503, { error: "Gemini API key is not configured." });
      return;
    }

    try {
      const payload = await readJsonBody(req);
      const geminiResponse = await fetch(GEMINI_ENDPOINT, {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: ECOTRACE_SYSTEM_PROMPT }],
          },
          contents: [
            {
              parts: [
                {
                  text: `Analyze this EcoTrace user state and return JSON only:\n${JSON.stringify(payload)}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 900,
            responseMimeType: "application/json",
          },
        }),
      });

      const data = await geminiResponse.json().catch(() => ({}));
      if (!geminiResponse.ok) {
        sendJson(res, geminiResponse.status, {
          error: "Gemini request failed.",
          details: data,
        });
        return;
      }
      sendJson(res, 200, data);
    } catch (_error) {
      sendJson(res, 502, { error: "Gemini proxy failed." });
    }
  };
}

function createGeminiChatHandler(apiKey) {
  return async (req, res) => {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }
    if (!apiKey) {
      sendJson(res, 503, { error: "Gemini API key is not configured." });
      return;
    }

    try {
      const payload = await readJsonBody(req);
      const geminiResponse = await fetch(GEMINI_ENDPOINT, {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: ECOTRACE_CHAT_SYSTEM_PROMPT }],
          },
          contents: [
            {
              parts: [
                {
                  text: `Answer this EcoTrace user question from the provided live app state and return JSON only:\n${JSON.stringify(payload)}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.45,
            maxOutputTokens: 900,
            responseMimeType: "application/json",
          },
        }),
      });

      const data = await geminiResponse.json().catch(() => ({}));
      if (!geminiResponse.ok) {
        sendJson(res, geminiResponse.status, {
          error: "Gemini chat request failed.",
          details: data,
        });
        return;
      }
      sendJson(res, 200, data);
    } catch (_error) {
      sendJson(res, 502, { error: "Gemini chat proxy failed." });
    }
  };
}

function ecotraceGeminiProxy(apiKey) {
  const insightsHandler = createGeminiInsightsHandler(apiKey);
  const chatHandler = createGeminiChatHandler(apiKey);
  return {
    name: "ecotrace-gemini-insights-proxy",
    configureServer(server) {
      server.middlewares.use("/api/gemini-insights", insightsHandler);
      server.middlewares.use("/api/gemini-chat", chatHandler);
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api/gemini-insights", insightsHandler);
      server.middlewares.use("/api/gemini-chat", chatHandler);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    base: "./",
    plugins: [react(), ecotraceGeminiProxy(env.GEMINI_API_KEY)],
  };
});
