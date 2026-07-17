const Groq = require('groq-sdk');
const logger = require('../../../common/utils/logger');
const groupRepository = require('../../group/repositories/groupRepository');
const courseOfferingService = require('../../courseOffering/services/courseOfferingService');
const {
  ServiceUnavailableError, BadGatewayError, BadRequestError, NotFoundError,
} = require('../../../common/errors');

const MODEL = 'llama-3.3-70b-versatile';
const MAX_GROUPS = 20;

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

// Returns the parsed value, or undefined if the response isn't valid JSON
// even after repairing unescaped control characters.
function parseJsonLenient(raw) {
  const cleaned = stripFences(raw);
  try {
    return JSON.parse(cleaned);
  } catch {
    try {
      return JSON.parse(escapeControlCharsInStrings(cleaned));
    } catch {
      return undefined;
    }
  }
}

function buildVariationsSystemPrompt(n) {
  return `You are an assistant helping a university instructor create
   group assignments. Generate exactly ${n} variations of the
   same task — one per group. Every variation MUST have the
   same difficulty and the same learning objective, but a
   different scenario, domain, or dataset so groups cannot
   copy from each other. Respond ONLY with a valid JSON array
   of exactly ${n} objects, no markdown fences, no extra text:
   [{ "title": "...", "description": "..." }, ...]
   Titles max 80 chars. Descriptions are plain text with line
   breaks, no markdown headers.`;
}

// Calls Groq once and returns an array of { title, description } of exactly
// groupNames.length items, or null if the response didn't satisfy that shape
// (wrong count, missing fields, unparseable). Never throws for shape issues —
// only for actual API/network failures, which become a BadGatewayError.
async function callGroqForVariations(prompt, groupNames) {
  const n = groupNames.length;
  const userMessage = `Assign one task variation to each of these ${n} groups, in this exact order: `
    + `${groupNames.join(', ')}. The group names are only for ordering — each variation's "title" must `
    + `be a short descriptive title for that task's scenario, never the group's name.\n\n`
    + `Instructor's request: ${prompt}`;

  let completion;
  try {
    completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.8,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: buildVariationsSystemPrompt(n) },
        { role: 'user', content: userMessage },
      ],
    });
  } catch (err) {
    logger.error('Groq API request failed', { message: err.message });
    throw new BadGatewayError('AI generation failed. Please try again.');
  }

  const raw = completion.choices?.[0]?.message?.content ?? '';
  const parsed = parseJsonLenient(raw);

  if (!Array.isArray(parsed) || parsed.length !== n) return null;

  const cleanItems = [];
  for (const item of parsed) {
    if (
      !item ||
      typeof item.title !== 'string' || !item.title.trim() ||
      typeof item.description !== 'string' || !item.description.trim()
    ) {
      return null;
    }
    cleanItems.push({
      title: item.title.trim().slice(0, 120),
      description: item.description.trim(),
    });
  }
  return cleanItems;
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
    const parsed = parseJsonLenient(raw);

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

  // Returns [{ groupName, title, description }] in the same order as groupNames.
  // Retries once if the model returns the wrong shape/count before giving up.
  async generateTaskVariations(prompt, groupNames) {
    if (!client) {
      throw new ServiceUnavailableError('AI feature is not configured');
    }
    if (!groupNames?.length) {
      throw new BadRequestError('At least one group is required');
    }
    if (groupNames.length > MAX_GROUPS) {
      throw new BadRequestError(`Cannot generate variations for more than ${MAX_GROUPS} groups`);
    }

    let variations = await callGroqForVariations(prompt, groupNames);
    if (!variations) variations = await callGroqForVariations(prompt, groupNames);
    if (!variations) {
      throw new BadGatewayError('AI could not generate enough unique variations. Please try again.');
    }

    return groupNames.map((groupName, i) => ({ groupName, ...variations[i] }));
  },

  // Orchestrates the HTTP-facing flow: resolve groupIds -> group docs, verify
  // they all belong to one course offering the caller has access to, then
  // generate variations. Returns [{ groupId, groupName, title, description }]
  // in the same order the caller supplied groupIds.
  async generateVariationsForGroups(prompt, groupIds, context) {
    const groups = await groupRepository.findByIds(groupIds);

    if (groups.length !== groupIds.length) {
      const foundIds = new Set(groups.map((g) => String(g._id)));
      const missing = groupIds.filter((id) => !foundIds.has(String(id)));
      throw new NotFoundError(`Group(s) not found: ${missing.join(', ')}`);
    }

    const offeringIds = new Set(groups.map((g) => String(g.courseOfferingId?._id ?? g.courseOfferingId)));
    if (offeringIds.size > 1) {
      throw new BadRequestError('All selected groups must belong to the same course offering');
    }
    const [offeringId] = offeringIds;
    // Throws NotFoundError/ForbiddenError if the offering doesn't exist or
    // this instructor doesn't own it — same check used by task creation.
    await courseOfferingService.getById(offeringId, context);

    const byId = new Map(groups.map((g) => [String(g._id), g]));
    const orderedGroups = groupIds.map((id) => byId.get(String(id)));

    const variations = await aiService.generateTaskVariations(prompt, orderedGroups.map((g) => g.name));

    return orderedGroups.map((g, i) => ({
      groupId:   String(g._id),
      groupName: g.name,
      title:     variations[i].title,
      description: variations[i].description,
    }));
  },
};

module.exports = aiService;
