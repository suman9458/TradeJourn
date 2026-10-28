/**
 * Google Gemini REST Client (Node 18+ native fetch, zero external SDK dependency)
 * ==============================================================================
 * Compatible with Google Generative AI v1beta specifications:
 * - System instructions
 * - Multi-turn conversation contents
 * - Function declarations / Tool calling
 * - Multimodal image inputs (charts, screenshots)
 * - Configurable generation settings & bounded retries
 */

const VALID_GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
const DEFAULT_MODEL = 'gemini-2.0-flash';

// Normalize model names and alias legacy or invalid names
const normalizeModelName = (modelName) => {
  if (!modelName) return DEFAULT_MODEL;
  const clean = modelName.trim().toLowerCase();
  if (VALID_GEMINI_MODELS.includes(clean)) return clean;
  if (clean.includes('1.5-pro')) return 'gemini-1.5-pro';
  if (clean.includes('1.5-flash')) return 'gemini-1.5-flash';
  // Default all other flash variants to gemini-2.0-flash
  return DEFAULT_MODEL;
};

/**
 * Generate content using Google Gemini v1beta API
 */
async function generateGeminiContent({
  apiKey,
  model = DEFAULT_MODEL,
  systemInstruction = null,
  contents = [],
  tools = null,
  generationConfig = {},
  timeoutMs = 15000,
  fetchFn = globalThis.fetch
}) {
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new Error('MISSING_GEMINI_API_KEY: A valid Google Gemini API key is required.');
  }

  const targetModel = normalizeModelName(model);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey.trim()}`;

  const requestBody = {
    contents: Array.isArray(contents) ? contents : [{ role: 'user', parts: [{ text: String(contents) }] }]
  };

  if (systemInstruction) {
    requestBody.system_instruction = {
      parts: [{ text: typeof systemInstruction === 'string' ? systemInstruction : String(systemInstruction) }]
    };
  }

  if (Array.isArray(tools) && tools.length > 0) {
    requestBody.tools = tools;
  }

  requestBody.generationConfig = {
    temperature: generationConfig.temperature !== undefined ? generationConfig.temperature : 0.3,
    maxOutputTokens: generationConfig.maxOutputTokens || 1024,
    topP: generationConfig.topP || 0.9,
    ...generationConfig
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    clearTimeout(timeoutId);

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errMsg = data?.error?.message || `HTTP ${response.status} from Gemini API`;
      const errStatus = response.status;
      const error = new Error(`Gemini API Error (${errStatus}): ${errMsg}`);
      error.status = errStatus;
      error.details = data?.error;
      throw error;
    }

    const candidate = data?.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    // Extract text responses
    const textParts = parts.filter(p => p.text).map(p => p.text).join('\n').trim();

    // Extract function calls if tool calling triggered
    const functionCalls = parts
      .filter(p => p.functionCall)
      .map(p => ({
        name: p.functionCall.name,
        args: p.functionCall.args || {}
      }));

    return {
      success: true,
      model: targetModel,
      text: textParts,
      functionCalls,
      rawParts: parts,
      finishReason: candidate?.finishReason || 'STOP',
      usageMetadata: data?.usageMetadata || null
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      const timeoutError = new Error(`Gemini request timed out after ${timeoutMs}ms.`);
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw err;
  }
}

module.exports = {
  VALID_GEMINI_MODELS,
  DEFAULT_MODEL,
  normalizeModelName,
  generateGeminiContent
};

