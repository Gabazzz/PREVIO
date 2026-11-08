// Serverless proxy to the Anthropic API — used by the in-app "Registrar com IA" feature
// to parse natural-language transaction descriptions.
//
// SECURITY: this endpoint used to accept any POST with no authentication at all,
// meaning anyone who found the URL could spend the app's Anthropic API quota for
// free. It now requires a valid Supabase session (the same session the app already
// has after login) and only forwards a constrained, allow-listed request shape —
// never the caller's raw body — so a logged-in-but-malicious client can't swap in a
// different model, a bigger max_tokens, or an unrelated system prompt to run up costs.

const SUPABASE_URL = 'https://grjovgjhnmglvtclpwvs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyam92Z2pobm1nbHZ0Y2xwd3ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NTgzMTIsImV4cCI6MjA5NTMzNDMxMn0.ngTL5_rJ0NnCyRBuwKcSylnQBp6kNDFo5-73o5dPat4';

const ALLOWED_MODELS = new Set(['claude-haiku-5-5']);
const MAX_TOKENS_CAP = 300;
const MAX_INPUT_CHARS = 1000; // natural-language transaction entries are always short

async function verifySupabaseUser(accessToken) {
  if (!accessToken) return null;
  try {
    const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': SUPABASE_ANON_KEY
      }
    });
    if (!resp.ok) return null;
    const user = await resp.json();
    return user && user.id ? user : null;
  } catch (err) {
    return null;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  // 1. Require a logged-in Previo user
  const authHeader = req.headers['authorization'] || '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const user = await verifySupabaseUser(accessToken);
  if (!user) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }

  const key = process.env.ANTHROPIC_KEY;
  if (!key) return res.status(500).json({ error: 'Chave não configurada' });

  // 2. Build the Anthropic request ourselves from an allow-listed shape — never
  //    forward the caller's body verbatim.
  const body = req.body || {};
  const model = ALLOWED_MODELS.has(body.model) ? body.model : 'claude-haiku-5-5';
  const maxTokens = Math.min(MAX_TOKENS_CAP, Number(body.max_tokens) || MAX_TOKENS_CAP);
  const system = typeof body.system === 'string' ? body.system : '';
  const userMessage = Array.isArray(body.messages) && body.messages[0] && typeof body.messages[0].content === 'string'
    ? body.messages[0].content.slice(0, MAX_INPUT_CHARS)
    : null;

  if (!userMessage) {
    return res.status(400).json({ error: 'Requisição inválida.' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: userMessage }]
      })
    });

    const data = await response.json();
    return res.status(response.status).json(data);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
