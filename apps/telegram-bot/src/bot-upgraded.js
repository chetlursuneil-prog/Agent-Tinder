// Force Node HTTPS to use IPv4 by default to avoid flaky IPv6 egress in some clouds
const https = require('https');
https.globalAgent = new https.Agent({ family: 4, keepAlive: true });

const { Telegraf } = require('telegraf');
const axios = require('axios');
const OpenAI = require('openai');

const token = process.env.TELEGRAM_TOKEN || 'REPLACE_WITH_TOKEN';
const ADMIN_IDS = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').filter(Boolean).map(x => parseInt(x, 10));
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3001';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';
const OPENCLAW_API_URL = process.env.OPENCLAW_API_URL || 'http://127.0.0.1:8080';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

const bot = new Telegraf(token);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Conversation context per user {userId: {recentPRs: [], lastIntent: '', conversationHistory: []}}
const userContexts = new Map();

function getUserContext(userId) {
  if (!userContexts.has(userId)) {
    userContexts.set(userId, {
      recentPRs: [],
      lastIntent: null,
      conversationHistory: [],
      lastPrompt: null
    });
  }
  return userContexts.get(userId);
}

function addToHistory(userId, role, content) {
  const ctx = getUserContext(userId);
  ctx.conversationHistory.push({ role, content, timestamp: Date.now() });
  // Keep only last 10 messages
  if (ctx.conversationHistory.length > 10) {
    ctx.conversationHistory = ctx.conversationHistory.slice(-10);
  }
}

function isAdmin(ctx) {
  if (!ADMIN_IDS || ADMIN_IDS.length === 0) return true;
  return ADMIN_IDS.includes(ctx.from.id);
}

bot.start((ctx) => ctx.reply('🤖 Master Agent online. I understand natural language - just tell me what you need!\n\nCommands:\n/summary - Platform overview\n/help - Show capabilities'));

bot.command('help', async (ctx) => {
  await ctx.reply(`🤖 *AI-Powered Development Assistant*\n\nI understand natural language and can:\n\n✅ Create GitHub PRs from your requests\n✅ Remember conversation context\n✅ Answer follow-up questions\n✅ Fetch and explain PR content\n\n*Examples:*\n• "Create a roadmap file"\n• "Add a search feature"\n• "Fix the login bug"\n• "Show me what you just created"\n• "What's in that PR?"\n\n*Slash Commands:*\n/plan <text> - Force plan intent\n/build <text> - Force build intent\n/fix <text> - Force fix intent\n/summary - Platform stats\n\nJust chat naturally - I'll understand! 🚀`, { parse_mode: 'Markdown' });
});

bot.command('summary', async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('Not authorized');
  try {
    const res = await axios.get(BACKEND_API_URL + '/admin/summary', { headers: ADMIN_API_KEY ? { 'x-admin-key': ADMIN_API_KEY } : {} });
    await ctx.replyWithMarkdown(`*AgentTinder Summary*\n\nUsers: ${res.data.users}\nProfiles: ${res.data.profiles}\nMatches: ${res.data.matches}\nContracts: ${res.data.contracts}\nDisputes: ${res.data.disputes}\n\n_Time: ${res.data.time}_`);
  } catch (err) {
    console.error(err?.response?.data || err.message);
    await ctx.reply('Summary not available — backend not configured or error.');
  }
});

bot.command('matches', async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('Not authorized');
  try {
    const res = await axios.get(BACKEND_API_URL + '/matches');
    const list = res.data.slice(0, 10);
    if (!list.length) return ctx.reply('No matches yet');
    const lines = list.map(m => `${m.id} — ${m.a} ↔ ${m.b} (${m.created_at || '?'})`);
    await ctx.reply(lines.join('\n'));
  } catch (err) {
    console.error(err?.response?.data || err.message);
    await ctx.reply('Could not fetch matches');
  }
});

bot.command('agent', async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('Not authorized');
  const parts = ctx.message.text.split(' ').filter(Boolean);
  if (parts.length < 2) return ctx.reply('Usage: /agent <profileId>');
  const id = parts[1];
  try {
    const res = await axios.get(`${BACKEND_API_URL}/profiles/${id}`);
    const p = res.data;
    let user = null;
    try { const ru = await axios.get(`${BACKEND_API_URL}/users/${p.user_id}`, { headers: ADMIN_API_KEY ? { 'x-admin-key': ADMIN_API_KEY } : {} }); user = ru.data; } catch (e) {}
    await ctx.replyWithMarkdown(`*Profile*: ${p.id}\n*User*: ${user ? user.email : p.user_id}\n*Skills*: ${p.skills ? p.skills.join(', ') : ''}\n*About*: ${p.about || ''}\n*Price*: ${p.price || ''}`);
  } catch (err) {
    console.error(err?.response?.data || err.message);
    await ctx.reply('Profile not found');
  }
});

const { Markup } = require('telegraf');

bot.command('nudge', async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('Not authorized');
  const parts = ctx.message.text.split(' ').filter(Boolean);
  if (parts.length < 2) return ctx.reply('Usage: /nudge <userId> [message]');
  const userId = parts[1];
  const message = parts.slice(2).join(' ') || 'Please respond to your match.';
  try {
    await axios.post(BACKEND_API_URL + '/admin/nudge', { userId, message }, { headers: ADMIN_API_KEY ? { 'x-admin-key': ADMIN_API_KEY, 'x-admin-id': ctx.from.username || ctx.from.id } : { 'x-admin-id': ctx.from.username || ctx.from.id } });
    await ctx.reply(`Nudge sent to ${userId}`);
  } catch (err) {
    console.error(err?.response?.data || err.message);
    await ctx.reply('Failed to send nudge');
  }
});

// Helper: Execute OpenClaw task
async function executeTask(intent, prompt, userId) {
  const userCtx = getUserContext(userId);
  userCtx.lastIntent = intent;
  userCtx.lastPrompt = prompt;

  const r = await axios.post(`${OPENCLAW_API_URL}/process`, { 
    type: intent, 
    body: { prompt, target: 'pr' } 
  });

  const prUrl = r.data?.pr_url || r.data?.prUrl || r.data?.pullRequestUrl;
  if (prUrl) {
    userCtx.recentPRs.unshift({ url: prUrl, intent, prompt, timestamp: Date.now() });
    if (userCtx.recentPRs.length > 5) userCtx.recentPRs = userCtx.recentPRs.slice(0, 5);
  }

  return { prUrl, data: r.data };
}

// Helper: Fetch PR content from GitHub
async function fetchPRContent(prUrl) {
  if (!GITHUB_TOKEN) return null;
  
  try {
    // Extract owner/repo/pr from URL like https://github.com/owner/repo/pull/123
    const match = prUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);
    if (!match) return null;
    
    const [, owner, repo, prNumber] = match;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
    
    const response = await axios.get(apiUrl, {
      headers: { 
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    return {
      title: response.data.title,
      body: response.data.body || '(no description)',
      state: response.data.state,
      commits: response.data.commits,
      additions: response.data.additions,
      deletions: response.data.deletions,
      changed_files: response.data.changed_files
    };
  } catch (err) {
    console.error('Failed to fetch PR:', err.message);
    return null;
  }
}

// OpenAI-based intent detection and conversation handling
async function detectIntentWithAI(userMessage, userCtx) {
  const systemPrompt = `You are an AI assistant that helps developers create GitHub PRs. Analyze the user's message and respond with JSON.

Context:
- Recent PRs: ${userCtx.recentPRs.length > 0 ? userCtx.recentPRs.map(pr => `${pr.url} (${pr.intent})`).join(', ') : 'none'}
- Last prompt: ${userCtx.lastPrompt || 'none'}

Classify the message into ONE of these categories:
1. "task" - User wants to create/plan/build/fix something (e.g., "add a feature", "fix a bug", "create roadmap")
2. "query_pr" - User asking about a PR they created (e.g., "show me", "what's in it", "explain the PR")
3. "greeting" - General chat/greeting (e.g., "hello", "how are you", "thanks")
4. "help" - User needs help/guidance

For "task", also detect sub-intent: "plan", "build", or "fix"
For "query_pr", identify which PR they're asking about (latest by default)

Response format:
{
  "category": "task|query_pr|greeting|help",
  "intent": "plan|build|fix|null",
  "needs_pr_content": true/false,
  "pr_index": 0,
  "conversational_response": "brief friendly acknowledgment or answer"
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    });

    return JSON.parse(completion.choices[0].message.content);
  } catch (err) {
    console.error('OpenAI intent detection failed:', err.message);
    // Fallback to regex
    if (/\b(plan|roadmap|design|change|modify|update)\b/i.test(userMessage)) {
      return { category: 'task', intent: 'plan', needs_pr_content: false };
    } else if (/\b(add|create|build|implement|make)\b/i.test(userMessage)) {
      return { category: 'task', intent: 'build', needs_pr_content: false };
    } else if (/\b(fix|bug|error|issue|broken)\b/i.test(userMessage)) {
      return { category: 'task', intent: 'fix', needs_pr_content: false };
    } else if (/\b(show|what|tell|explain|summary|details|pr|pull request)\b/i.test(userMessage)) {
      return { category: 'query_pr', needs_pr_content: true, pr_index: 0 };
    } else if (/\b(hello|hi|hey|thanks|thank you)\b/i.test(userMessage)) {
      return { category: 'greeting', conversational_response: '👋 Hi! What can I help you build today?' };
    }
    return { category: 'help', conversational_response: 'I can help you create PRs! Try: "add a search feature" or "fix the login bug"' };
  }
}

// Force-intent commands
bot.command('plan', async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('Not authorized');
  const parts = ctx.message.text.split(' ').slice(1);
  if (!parts.length) return ctx.reply('Usage: /plan <description>');
  const prompt = parts.join(' ');
  
  await ctx.reply('🔍 Planning with OpenClaw + OpenAI...');
  addToHistory(ctx.from.id, 'user', prompt);
  
  try {
    const result = await executeTask('plan', prompt, ctx.from.id);
    if (result.prUrl) {
      await ctx.reply(`✅ *PR Created!*\n\n${result.prUrl}\n\nAsk me "what's in the PR?" to see details!`, { parse_mode: 'Markdown' });
      addToHistory(ctx.from.id, 'assistant', `Created plan PR: ${result.prUrl}`);
    } else {
      await ctx.reply(`Response:\n${JSON.stringify(result.data, null, 2)}`);
    }
  } catch (err) {
    console.error(err?.response?.data || err?.message || err);
    await ctx.reply('❌ OpenClaw request failed: ' + (err.message || 'unknown error'));
  }
});

bot.command('build', async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('Not authorized');
  const parts = ctx.message.text.split(' ').slice(1);
  if (!parts.length) return ctx.reply('Usage: /build <description>');
  const prompt = parts.join(' ');
  
  await ctx.reply('🔨 Building with OpenClaw + OpenAI...');
  addToHistory(ctx.from.id, 'user', prompt);
  
  try {
    const result = await executeTask('build', prompt, ctx.from.id);
    if (result.prUrl) {
      await ctx.reply(`✅ *PR Created!*\n\n${result.prUrl}\n\nAsk me "what's in the PR?" to see details!`, { parse_mode: 'Markdown' });
      addToHistory(ctx.from.id, 'assistant', `Created build PR: ${result.prUrl}`);
    } else {
      await ctx.reply(`Response:\n${JSON.stringify(result.data, null, 2)}`);
    }
  } catch (err) {
    console.error(err?.response?.data || err?.message || err);
    await ctx.reply('❌ OpenClaw request failed: ' + (err.message || 'unknown error'));
  }
});

bot.command('fix', async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('Not authorized');
  const parts = ctx.message.text.split(' ').slice(1);
  if (!parts.length) return ctx.reply('Usage: /fix <description>');
  const prompt = parts.join(' ');
  
  await ctx.reply('🐛 Fixing with OpenClaw + OpenAI...');
  addToHistory(ctx.from.id, 'user', prompt);
  
  try {
    const result = await executeTask('fix', prompt, ctx.from.id);
    if (result.prUrl) {
      await ctx.reply(`✅ *PR Created!*\n\n${result.prUrl}\n\nAsk me "what's in the PR?" to see details!`, { parse_mode: 'Markdown' });
      addToHistory(ctx.from.id, 'assistant', `Created fix PR: ${result.prUrl}`);
    } else {
      await ctx.reply(`Response:\n${JSON.stringify(result.data, null, 2)}`);
    }
  } catch (err) {
    console.error(err?.response?.data || err?.message || err);
    await ctx.reply('❌ OpenClaw request failed: ' + (err.message || 'unknown error'));
  }
});

bot.command('suspend', async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('Not authorized');
  const parts = ctx.message.text.split(' ').filter(Boolean);
  if (parts.length < 2) return ctx.reply('Usage: /suspend <userId>');
  const userId = parts[1];
  await ctx.reply(`Suspend user ${userId}?`, Markup.inlineKeyboard([
    Markup.button.callback('Confirm Suspend', `suspend:${userId}:confirm`),
    Markup.button.callback('Cancel', `suspend:${userId}:cancel`)
  ]));
});

bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data || '';
  if (data.startsWith('suspend:')) {
    const [, userId, action] = data.split(':');
    if (action === 'confirm') {
      try {
        await axios.post(`${BACKEND_API_URL}/admin/suspend/${userId}`, { suspend: true }, { headers: ADMIN_API_KEY ? { 'x-admin-key': ADMIN_API_KEY } : {} });
        await ctx.editMessageText(`User ${userId} suspended.`);
      } catch (err) {
        console.error(err?.response?.data || err.message);
        await ctx.editMessageText('Failed to suspend user');
      }
    } else {
      await ctx.editMessageText('Suspend cancelled');
    }
    return ctx.answerCbQuery();
  }
  return ctx.answerCbQuery();
});

// Natural language handler with OpenAI
bot.on('text', async (ctx) => {
  if (ctx.message.text.startsWith('/')) return;
  if (!isAdmin(ctx)) return;
  
  const userId = ctx.from.id;
  const userMessage = ctx.message.text;
  const userCtx = getUserContext(userId);
  
  addToHistory(userId, 'user', userMessage);
  
  await ctx.sendChatAction('typing');
  
  try {
    const analysis = await detectIntentWithAI(userMessage, userCtx);
    
    if (analysis.category === 'greeting' || analysis.category === 'help') {
      await ctx.reply(analysis.conversational_response || '👋 Hi! How can I help you today?');
      return;
    }
    
    if (analysis.category === 'query_pr') {
      const prIndex = analysis.pr_index || 0;
      if (userCtx.recentPRs.length === 0) {
        await ctx.reply('You haven\'t created any PRs yet! Try: "create a roadmap file"');
        return;
      }
      
      const targetPR = userCtx.recentPRs[prIndex];
      if (!targetPR) {
        await ctx.reply('PR not found. Recent PRs:\n' + userCtx.recentPRs.map((pr, i) => `${i + 1}. ${pr.url}`).join('\n'));
        return;
      }
      
      await ctx.sendChatAction('typing');
      const prContent = await fetchPRContent(targetPR.url);
      
      if (prContent) {
        const summary = `📋 *PR Summary*\n\n*Title:* ${prContent.title}\n*State:* ${prContent.state}\n*Changes:* +${prContent.additions} -${prContent.deletions} (${prContent.changed_files} files)\n\n*Description:*\n${prContent.body.slice(0, 500)}${prContent.body.length > 500 ? '...' : ''}\n\n*Link:* ${targetPR.url}`;
        await ctx.reply(summary, { parse_mode: 'Markdown' });
      } else {
        await ctx.reply(`📋 *Recent PR*\n\n*URL:* ${targetPR.url}\n*Intent:* ${targetPR.intent}\n*Your prompt:* ${targetPR.prompt}\n\n(GitHub API not available for detailed content)`, { parse_mode: 'Markdown' });
      }
      
      addToHistory(userId, 'assistant', `Showed PR: ${targetPR.url}`);
      return;
    }
    
    if (analysis.category === 'task' && analysis.intent) {
      const emoji = { plan: '🔍', build: '🔨', fix: '🐛' }[analysis.intent] || '⚙️';
      await ctx.reply(`${emoji} Detected: *${analysis.intent}*\n\nProcessing with OpenClaw + OpenAI...`, { parse_mode: 'Markdown' });
      
      const result = await executeTask(analysis.intent, userMessage, userId);
      
      if (result.prUrl) {
        const prContent = await fetchPRContent(result.prUrl);
        let response = `✅ *PR Created Successfully!*\n\n${result.prUrl}\n\n`;
        
        if (prContent) {
          response += `*Title:* ${prContent.title}\n*Changes:* +${prContent.additions} -${prContent.deletions} (${prContent.changed_files} files)\n\n`;
          response += `*Description:*\n${prContent.body.slice(0, 300)}${prContent.body.length > 300 ? '...' : ''}\n\n`;
        }
        
        response += `💬 Ask me "what's in the PR?" for full details!`;
        await ctx.reply(response, { parse_mode: 'Markdown' });
        addToHistory(userId, 'assistant', `Created ${analysis.intent} PR: ${result.prUrl}`);
      } else {
        await ctx.reply(`Response:\n${JSON.stringify(result.data, null, 2)}`);
      }
      
      return;
    }
    
    // Fallback
    await ctx.reply('🤔 I\'m not sure what you want. Try:\n\n• "Create a roadmap"\n• "Add login feature"\n• "Fix the bug in auth"\n• "Show me the last PR"\n\nOr use /help for more info!');
    
  } catch (err) {
    console.error('Natural language error:', err);
    await ctx.reply('❌ Something went wrong: ' + (err.message || 'unknown error'));
  }
});

// Robust launch
let _stopResolve;
let _stopping = false;
const _stopPromise = new Promise((res) => { _stopResolve = res; });

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

async function startBotWithRetry() {
  let backoff = 1000;
  while (!_stopping) {
    try {
      await bot.launch();
      console.log('🤖 Telegram Master Agent running with OpenAI intelligence');
      await _stopPromise;
      break;
    } catch (err) {
      console.error('Bot launch failed:', err?.response?.data || err?.message || err);
      if (err?.response?.error_code === 404) {
        console.error('Telegram API returned 404 (invalid token). Aborting retries.');
        break;
      }
      console.log(`Retrying bot launch in ${backoff}ms`);
      await new Promise((res) => setTimeout(res, backoff));
      backoff = Math.min(backoff * 2, 300000);
    }
  }
}

function gracefulStop(signal) {
  if (_stopping) return;
  _stopping = true;
  console.log('Shutting down Telegram bot (signal:', signal, ')');
  bot.stop(signal).catch((e) => console.error('Error stopping bot:', e)).finally(() => _stopResolve && _stopResolve());
}

process.once('SIGINT', () => gracefulStop('SIGINT'));
process.once('SIGTERM', () => gracefulStop('SIGTERM'));

startBotWithRetry().catch((e) => console.error('Fatal start error:', e));
