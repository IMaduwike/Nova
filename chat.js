const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MODEL = 'llama-3.3-70b-versatile';

// How many messages before we trigger a summary
const SUMMARY_THRESHOLD = 10;
// How many recent messages to always keep after summarizing
const RECENT_KEEP = 4;

const NOVA_SYSTEM_PROMPT = `You are Nova, an AI coding assistant.

Your personality:
- You think before you speak. You don't rush to give an answer.
- You're direct and honest. If you don't know something, you say so.
- You talk like a senior dev — calm, experienced, no fluff.
- You're helpful but not sycophantic. No "Great question!" or "Certainly!".
- You push back when something is wrong, but you're not arrogant about it.
- You write clean, well-explained code with short comments where needed.
- You keep responses concise unless depth is actually needed.

You are not an assistant that tries to please — you're a collaborator that tries to help.`;

const SUMMARY_PROMPT = `You are a conversation summarizer. 
Summarize the key points of this conversation into concise bullet points.
Focus on: what the user is building, decisions made, problems solved, preferences shown, important context.
Be brief. Max 8 bullet points. Start each with "•".
Return ONLY the bullet points, nothing else.`;

async function callGroq(messages, systemPrompt) {
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 2048
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Groq API error');
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function summarizeHistory(messages) {
  // Format conversation for summarization
  const formatted = messages.map(m =>
    `${m.role === 'user' ? 'User' : 'Nova'}: ${m.content}`
  ).join('\n\n');

  const summary = await callGroq(
    [{ role: 'user', content: `Conversation to summarize:\n\n${formatted}` }],
    SUMMARY_PROMPT
  );

  return summary;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, summary } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  try {
    let contextMessages = messages;
    let newSummary = summary || null;
    let didSummarize = false;

    // Check if we need to summarize
    // We summarize all messages EXCEPT the last RECENT_KEEP
    if (messages.length >= SUMMARY_THRESHOLD) {
      const toSummarize = messages.slice(0, messages.length - RECENT_KEEP);
      const recent = messages.slice(messages.length - RECENT_KEEP);

      // Generate new summary (merging with old if exists)
      const historyToSummarize = summary
        ? [{ role: 'user', content: `Previous summary:\n${summary}\n\nNew conversation to merge in:` }, ...toSummarize]
        : toSummarize;

      newSummary = await summarizeHistory(historyToSummarize);
      didSummarize = true;

      // Build compressed context: summary as system note + recent messages
      contextMessages = [
        {
          role: 'user',
          content: `[Conversation context so far]\n${newSummary}\n\n[End of context — continuing from here]`
        },
        {
          role: 'assistant',
          content: 'Got it, I have context from our earlier conversation.'
        },
        ...recent
      ];
    } else if (summary) {
      // We have a summary from before but not enough new messages to re-summarize yet
      // Prepend it as context
      contextMessages = [
        {
          role: 'user',
          content: `[Conversation context so far]\n${summary}\n\n[End of context — continuing from here]`
        },
        {
          role: 'assistant',
          content: 'Got it, I have context from our earlier conversation.'
        },
        ...messages
      ];
    }

    // Get Nova's reply
    const reply = await callGroq(contextMessages, NOVA_SYSTEM_PROMPT);

    res.json({
      reply,
      summary: newSummary,
      didSummarize,
      messageCount: messages.length
    });

  } catch (err) {
    console.error('Nova error:', err);
    res.status(500).json({ error: err.message || 'Something went wrong' });
  }
}
