const Groq = require('groq-sdk');
const logger = require('../../../common/utils/logger');
const { ServiceUnavailableError, BadGatewayError } = require('../../../common/errors');

const MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `You are an assistant that helps university instructors
   create student group assignments. Given the instructor's
   request, respond ONLY with valid JSON in this exact shape,
   no markdown fences, no extra text:
   {
     "title": "short clear task title, max 80 chars",
     "description": "full task description with clear
     instructions, deliverables, and expectations for a
     student group. Use plain text with line breaks,
     no markdown headers."
   }`;

const apiKey = process.env.GROQ_API_KEY;
let client = null;

if (apiKey) {
  client = new Groq({ apiKey });
} else {
  logger.warn('GROQ_API_KEY not set — AI task generation disabled');
}

function stripFences(text) {
  return text.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
}

// The model often emits literal newlines inside JSON string values (e.g. in
// "description") instead of escaping them as \n, which JSON.parse rejects.
// Escape control characters that appear *inside* string literals only,
// leaving whitespace between tokens untouched.
function escapeControlCharsInStrings(text) {
  let result = '';
  let inString = false;
  let escaped = false;
  for (const ch of text) {
    if (inString) {
      if (escaped) {
        result += ch;
        escaped = false;
      } else if (ch === '\\') {
        result += ch;
        escaped = true;
      } else if (ch === '"') {
        result += ch;
        inString = false;
      } else if (ch === '\n') {
        result += '\\n';
      } else if (ch === '\r') {
        result += '\\r';
      } else if (ch === '\t') {
        result += '\\t';
      } else {
        result += ch;
      }
    } else {
      if (ch === '"') inString = true;
      result += ch;
    }
  }
  return result;
}

const aiService = {
  isConfigured() {
    return !!client;
  },

  async generateTask(prompt) {
    if (!client) {
      throw new ServiceUnavailableError('AI feature is not configured');
    }

    let completion;
    try {
      completion = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.7,
        max_tokens: 1024,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
      });
    } catch (err) {
      logger.error('Groq API request failed', { message: err.message });
      throw new BadGatewayError('AI generation failed. Please try again.');
    }

    const raw = completion.choices?.[0]?.message?.content ?? '';
    const cleaned = stripFences(raw);

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      try {
        parsed = JSON.parse(escapeControlCharsInStrings(cleaned));
      } catch {
        throw new BadGatewayError('AI returned an invalid response, please try again.');
      }
    }

    const { title, description } = parsed ?? {};
    if (
      typeof title !== 'string' || !title.trim() ||
      typeof description !== 'string' || !description.trim()
    ) {
      throw new BadGatewayError('AI returned an invalid response, please try again.');
    }

    return {
      title: title.trim().slice(0, 120),
      description: description.trim(),
    };
  },
};

module.exports = aiService;
