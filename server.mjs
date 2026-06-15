import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = fileURLToPath(new URL('.', import.meta.url));
const DIST_DIR = resolve(ROOT_DIR, 'dist');
const INDEX_FILE = join(DIST_DIR, 'index.html');
const PORT = Number(process.env.PORT || 4173);
const HOST = '0.0.0.0';
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const MAX_BODY_SIZE = 120_000;

const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2']
]);

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

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > MAX_BODY_SIZE) {
        rejectBody(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolveBody(raw ? JSON.parse(raw) : {});
      } catch (error) {
        rejectBody(error);
      }
    });
    req.on('error', rejectBody);
  });
}

async function proxyGemini(req, res, options) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    sendJson(res, 503, { error: 'Gemini API key is not configured.' });
    return;
  }

  try {
    const payload = await readJsonBody(req);
    const geminiResponse = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: options.systemPrompt }]
        },
        contents: [{
          parts: [{
            text: `${options.instruction}\n${JSON.stringify(payload)}`
          }]
        }],
        generationConfig: {
          temperature: options.temperature,
          maxOutputTokens: 900,
          responseMimeType: 'application/json'
        }
      })
    });

    const data = await geminiResponse.json().catch(() => ({}));
    if (!geminiResponse.ok) {
      sendJson(res, geminiResponse.status, { error: options.errorMessage, details: data });
      return;
    }
    sendJson(res, 200, data);
  } catch (error) {
    sendJson(res, 502, { error: options.fallbackError });
  }
}

function getSafeStaticPath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const requestedPath = decoded === '/' ? '/index.html' : decoded;
  const normalized = normalize(requestedPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = resolve(DIST_DIR, `.${normalized}`);
  return filePath.startsWith(DIST_DIR) ? filePath : INDEX_FILE;
}

async function serveStatic(req, res, pathname) {
  let filePath = getSafeStaticPath(pathname);
  let fileStat = await stat(filePath).catch(() => null);

  if (!fileStat || fileStat.isDirectory()) {
    filePath = INDEX_FILE;
    fileStat = await stat(filePath).catch(() => null);
  }

  if (!fileStat) {
    sendJson(res, 500, { error: 'EcoTrace build output is missing. Run npm run build before npm start.' });
    return;
  }

  const contentType = MIME_TYPES.get(extname(filePath).toLowerCase()) || 'application/octet-stream';
  const isAsset = filePath.includes(`${join('dist', 'assets')}`);
  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': fileStat.size,
    'Cache-Control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache'
  });
  createReadStream(filePath).pipe(res);
}

async function handleRequest(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/health') {
    sendJson(res, 200, {
      status: 'ok',
      app: 'EcoTrace',
      ai: process.env.GEMINI_API_KEY ? 'configured' : 'fallback'
    });
    return;
  }

  if (url.pathname === '/api/gemini-insights') {
    await proxyGemini(req, res, {
      systemPrompt: ECOTRACE_SYSTEM_PROMPT,
      instruction: 'Analyze this EcoTrace user state and return JSON only:',
      temperature: 0.35,
      errorMessage: 'Gemini request failed.',
      fallbackError: 'Gemini proxy failed.'
    });
    return;
  }

  if (url.pathname === '/api/gemini-chat') {
    await proxyGemini(req, res, {
      systemPrompt: ECOTRACE_CHAT_SYSTEM_PROMPT,
      instruction: 'Answer this EcoTrace user question from the provided live app state and return JSON only:',
      temperature: 0.45,
      errorMessage: 'Gemini chat request failed.',
      fallbackError: 'Gemini chat proxy failed.'
    });
    return;
  }

  await serveStatic(req, res, url.pathname);
}

if (!existsSync(INDEX_FILE)) {
  console.error('EcoTrace build output is missing. Run npm run build before npm start.');
  process.exit(1);
}

const server = createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error(error);
    sendJson(res, 500, { error: 'EcoTrace server failed.' });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`EcoTrace listening on http://${HOST}:${PORT}`);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
