const { Telegraf } = require('telegraf');
const axios = require('axios');
const OpenAI = require('openai');

const token = process.env.TELEGRAM_TOKEN || 'REPLACE_WITH_TOKEN';
const ADMIN_IDS = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').filter(Boolean).map(x => parseInt(x, 10));
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3001';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';
const OPENCLAW_API_URL = process.env.OPENCLAW_API_URL || 'http://127.0.0.1:8080';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_REPO = process.env.GITHUB_REPO || 'chetlursuneil-prog/Agent-Tinder';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const bot = new Telegraf(token);

// Store user conversation context
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

function isAdmin(ctx) {
  if (!ADMIN_IDS || ADMIN_IDS.length === 0) return true;
  return ADMIN_IDS.includes(ctx.from.id);
}

// Escape special Markdown characters for Telegram
function escapeMarkdown(text) {
  if (!text) return '';
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/>/g, '\\>')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/=/g, '\\=')
    .replace(/\|/g, '\\|')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\./g, '\\.')
    .replace(/!/g, '\\!');
}

// Safe reply function that handles markdown errors
async function safeReply(ctx, message, useMarkdown = false) {
  try {
    if (useMarkdown) {
      await ctx.replyWithMarkdown(message);
    } else {
      await ctx.reply(message);
    }
  } catch (err) {
    // If markdown parsing fails, send as plain text
    console.error('Markdown error:', err.message);
    try {
      await ctx.reply(message.replace(/[*_`\[\]()~>#+=|{}.!-]/g, ''));
    } catch (e) {
      console.error('Failed to send message:', e);
    }
  }
}

// Execute OpenClaw task
async function executeTask(taskType, prompt, userId) {
  const response = await axios.post(`${OPENCLAW_API_URL}/process`, {
    type: taskType,
    body: {
      prompt: prompt,
      target: 'pr'
    }
  }, { timeout: 300000 });

  const result = response.data;
  if (result.pr_url) {
    const prNumber = result.pr_url.split('/pull/')[1];
    const userContext = getUserContext(userId);
    userContext.recentPRs.unshift({ number: prNumber, url: result.pr_url, prompt: prompt });
    if (userContext.recentPRs.length > 5) userContext.recentPRs.pop();
  }

  return result;
}

// Fetch PR content from GitHub
async function fetchPRContent(prNumber) {
  if (!GITHUB_TOKEN) return null;
  
  try {
    const prUrl = `https://api.github.com/repos/${GITHUB_REPO}/pulls/${prNumber}`;
    const response = await axios.get(prUrl, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    const pr = response.data;
    return {
      title: pr.title,
      body: pr.body,
      state: pr.state,
      url: pr.html_url,
      number: pr.number
    };
  } catch (err) {
    console.error('Failed to fetch PR:', err.message);
    return null;
  }
}

// AI-powered intent detection with improved prompts
async function detectIntentWithAI(userMessage, userContext) {
  const conversationHistory = userContext.conversationHistory.slice(-10).map(msg => 
    `${msg.role}: ${msg.content}`
  ).join('\n');

  const systemPrompt = `You are an AI assistant for a Telegram bot that helps with code development tasks.

Analyze the user's message and classify it into ONE of these categories:

1. **conversation** - User wants to discuss, brainstorm, get ideas, advice, or have a chat. They are NOT asking you to write code or create anything yet.
   Examples:
   - "Can you give me ideas on enhancing the application?"
   - "What features should I add?"
   - "How can I improve this?"
   - "Tell me about best practices for X"
   - "What do you think about Y?"
   - "Give me suggestions"

2. **task** - User explicitly wants you to CREATE, IMPLEMENT, BUILD, or WRITE code. They want code changes made and a PR created.
   Examples:
   - "Create a feature that does X"
   - "Implement Y functionality"
   - "Build a component for Z"
   - "Add support for W"
   - "Write code to handle V"
   - "Fix the bug in X"
   - "Make this change: [specific change]"

3. **query_pr** - User asking about existing PRs, status of PRs, or code review
   Examples:
   - "What's the status of PR #15?"
   - "Show me the latest PR"
   - "What PRs did we create?"

4. **admin_query** - User asking about platform statistics, users, data, or system status
   Examples:
   - "How many users are on the platform?"
   - "Show me user statistics"
   - "Get me a report on matches"

5. **user_search** - User asking if a specific user exists or searching for a user by name
   Examples:
   - "Does agent tinder have a user called suneil?"
   - "Is there a user named John?"
   - "Find user smith"
   - "Search for user with email test@example.com"

6. **create_user_profile** - Admin requesting to create a new user with profile
   Examples:
   - "Create a user named suneil che with node.js and python skills and 100 usd per hour rate"
   - "Add user John Smith with java skills"
   - "Create user test@example.com with AI expertise"

7. **greeting** - Simple greetings or thank you messages

8. **help** - User asking how to use the bot or what commands are available

IMPORTANT DISTINCTION:
- "Give me ideas" = conversation (just answer, don't code)
- "Implement this idea" = task (create PR)
- "What if we add X?" = conversation (discussing)
- "Add X" = task (doing it)

Context from recent conversation:
${conversationHistory}

User message: "${userMessage}"

Respond with JSON only:
{
  "category": "conversation|task|query_pr|admin_query|user_search|create_user_profile|greeting|help",
  "taskType": "plan|build|fix|null",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "searchQuery": "extracted user name or email if user_search, else null",
  "userData": {
    "name": "extracted name if create_user_profile",
    "email": "extracted email if create_user_profile",
    "skills": ["array of extracted skills if create_user_profile"],
    "price": "extracted hourly rate as number if create_user_profile",
    "about": "extracted bio/description if create_user_profile"
  }
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

    const result = JSON.parse(completion.choices[0].message.content);
    console.log('Intent detection:', result);
    return result;
  } catch (error) {
    console.error('OpenAI intent detection failed:', error.message);
    // Fallback to simple detection
    const lower = userMessage.toLowerCase();
    if (lower.includes('idea') || lower.includes('suggest') || lower.includes('think') || lower.includes('advice')) {
      return { category: 'conversation', taskType: null, confidence: 0.6, reasoning: 'Fallback: requesting ideas' };
    }
    if (lower.includes('create') || lower.includes('implement') || lower.includes('build') || lower.includes('add') || lower.includes('fix')) {
      return { category: 'task', taskType: 'plan', confidence: 0.6, reasoning: 'Fallback: action words detected' };
    }
    return { category: 'greeting', taskType: null, confidence: 0.5, reasoning: 'Fallback: unclear' };
  }
}

// Generate conversational response using OpenAI
async function generateConversationalResponse(userMessage, userContext) {
  const conversationHistory = userContext.conversationHistory.slice(-10);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: `You are a helpful AI assistant for AgentTinder, a platform that connects AI agents with tasks. You help users brainstorm ideas, discuss features, and provide advice about development. Be concise but informative. When discussing features, consider: agent matching algorithms, task management, user experience, AI agent capabilities, payment systems, and review mechanisms. Keep responses under 400 characters when possible.`
        },
        ...conversationHistory,
        { role: 'user', content: userMessage }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI conversation failed:', error.message);
    return "I'd be happy to discuss that with you! However, I'm having trouble connecting to my AI service right now. Could you try again in a moment?";
  }
}

bot.start((ctx) => {
  const welcomeMsg = `*Master Agent online!*\n\nSend me natural language requests and I'll help you with:\n\n• Code creation (PRs)\n• Platform statistics\n• PR status queries\n• General advice and ideas\n\nJust chat naturally!`;
  safeReply(ctx, welcomeMsg, true);
});

bot.command('summary', async (ctx) => {
  if (!isAdmin(ctx)) return safeReply(ctx, 'Not authorized');
  try {
    const res = await axios.get(BACKEND_API_URL + '/admin/summary', { 
      headers: ADMIN_API_KEY ? { 'x-admin-key': ADMIN_API_KEY } : {} 
    });
    
    const msg = `*AgentTinder Summary*\n\nUsers: ${res.data.users}\nProfiles: ${res.data.profiles}\nMatches: ${res.data.matches}\nContracts: ${res.data.contracts}\nDisputes: ${res.data.disputes}\n\n_Time: ${res.data.time}_`;
    await safeReply(ctx, msg, true);
  } catch (err) {
    console.error(err?.response?.data || err.message);
    await safeReply(ctx, 'Summary not available — backend not configured or error.');
  }
});

bot.command('matches', async (ctx) => {
  if (!isAdmin(ctx)) return safeReply(ctx, 'Not authorized');
  try {
    const res = await axios.get(BACKEND_API_URL + '/matches');
    const list = res.data.slice(0, 10);
    if (!list.length) return safeReply(ctx, 'No matches yet');
    const lines = list.map(m => `${m.id} — ${m.a} ↔ ${m.b} (${m.created_at || '?'})`);
    await safeReply(ctx, lines.join('\n'));
  } catch (err) {
    console.error(err?.response?.data || err.message);
    await safeReply(ctx, 'Could not fetch matches');
  }
});

bot.command('agent', async (ctx) => {
  if (!isAdmin(ctx)) return safeReply(ctx, 'Not authorized');
  const parts = ctx.message.text.split(' ').filter(Boolean);
  if (parts.length < 2) return safeReply(ctx, 'Usage: /agent <profileId>');
  const id = parts[1];
  try {
    const res = await axios.get(`${BACKEND_API_URL}/profiles/${id}`);
    const p = res.data;
    let user = null;
    try { 
      const ru = await axios.get(`${BACKEND_API_URL}/users/${p.user_id}`, { 
        headers: ADMIN_API_KEY ? { 'x-admin-key': ADMIN_API_KEY } : {} 
      }); 
      user = ru.data; 
    } catch (e) {}
    
    const msg = `*Profile*: ${p.id}\n*User*: ${user ? user.email : p.user_id}\n*Skills*: ${p.skills ? p.skills.join(', ') : ''}\n*About*: ${p.about || ''}\n*Price*: ${p.price || ''}`;
    await safeReply(ctx, msg, true);
  } catch (err) {
    console.error(err?.response?.data || err.message);
    await safeReply(ctx, 'Profile not found');
  }
});

const { Markup } = require('telegraf');

bot.command('nudge', async (ctx) => {
  if (!isAdmin(ctx)) return safeReply(ctx, 'Not authorized');
  const parts = ctx.message.text.split(' ').filter(Boolean);
  if (parts.length < 2) return safeReply(ctx, 'Usage: /nudge <userId> [message]');
  const userId = parts[1];
  const message = parts.slice(2).join(' ') || 'Please respond to your match.';
  try {
    await axios.post(BACKEND_API_URL + '/admin/nudge', { userId, message }, { 
      headers: ADMIN_API_KEY ? { 
        'x-admin-key': ADMIN_API_KEY, 
        'x-admin-id': ctx.from.username || ctx.from.id 
      } : { 
        'x-admin-id': ctx.from.username || ctx.from.id 
      } 
    });
    await safeReply(ctx, `Nudge sent to ${userId}`);
  } catch (err) {
    console.error(err?.response?.data || err.message);
    await safeReply(ctx, 'Failed to send nudge');
  }
});

bot.command('suspend', async (ctx) => {
  if (!isAdmin(ctx)) return safeReply(ctx, 'Not authorized');
  const parts = ctx.message.text.split(' ').filter(Boolean);
  if (parts.length < 2) return safeReply(ctx, 'Usage: /suspend <userId>');
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
        await axios.post(`${BACKEND_API_URL}/admin/suspend/${userId}`, { suspend: true }, { 
          headers: ADMIN_API_KEY ? { 'x-admin-key': ADMIN_API_KEY } : {} 
        });
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

// Natural language handler with improved intent detection
bot.on('text', async (ctx) => {
  if (!isAdmin(ctx)) return;
  if (ctx.message.text.startsWith('/')) return; // Skip commands

  const userMessage = ctx.message.text;
  const userId = ctx.from.id;
  const userContext = getUserContext(userId);

  // Update conversation history
  userContext.conversationHistory.push({ role: 'user', content: userMessage });
  if (userContext.conversationHistory.length > 20) {
    userContext.conversationHistory = userContext.conversationHistory.slice(-20);
  }

  try {
    // Detect intent with AI
    const intent = await detectIntentWithAI(userMessage, userContext);
    userContext.lastIntent = intent;

    // Handle conversation (ideas, advice, discussion)
    if (intent.category === 'conversation') {
      await safeReply(ctx, '💬 Let me think about that...');
      const response = await generateConversationalResponse(userMessage, userContext);
      userContext.conversationHistory.push({ role: 'assistant', content: response });
      await safeReply(ctx, response);
      return;
    }

    // Handle task (create PR)
    if (intent.category === 'task') {
      const taskType = intent.taskType || 'plan';
      await safeReply(ctx, `🔍 Detected: ${taskType}\n\nProcessing with OpenClaw + OpenAI...`, true);
      
      userContext.lastPrompt = userMessage;
      const result = await executeTask(taskType, userMessage, userId);

      if (result.pr_url) {
        const prNumber = result.pr_url.split('/pull/')[1];
        const msg = `✅ *${taskType.toUpperCase()} Complete*\n\n` +
                   `PR: [#${prNumber}](${result.pr_url})\n` +
                   `Branch: \`${result.branch || 'N/A'}\`\n\n` +
                   `_You can ask me about this PR anytime!_`;
        await safeReply(ctx, msg, true);
        userContext.conversationHistory.push({ 
          role: 'assistant', 
          content: `Created PR #${prNumber} for: ${userMessage}` 
        });
      } else {
        await safeReply(ctx, `Task processed but no PR URL returned. Raw: ${JSON.stringify(result).substring(0, 200)}`);
      }
      return;
    }

    // Handle PR query
    if (intent.category === 'query_pr') {
      const prMatch = userMessage.match(/#?(\d+)/);
      let prNumber = prMatch ? prMatch[1] : null;

      if (!prNumber && userContext.recentPRs.length > 0) {
        prNumber = userContext.recentPRs[0].number;
      }

      if (!prNumber) {
        await safeReply(ctx, 'No recent PRs found. Specify a PR number like "#15"');
        return;
      }

      await safeReply(ctx, `🔍 Fetching PR #${prNumber}...`);
      const prData = await fetchPRContent(prNumber);

      if (prData) {
        // Don't escape - send as natural text with line breaks
        const title = prData.title || 'No title';
        const body = (prData.body || 'No description').substring(0, 500);
        const msg = `📝 PR #${prNumber}\n\n${title}\n\nStatus: ${prData.state}\n\n${body}\n\nView on GitHub: ${prData.url}`;
        await safeReply(ctx, msg);
      } else {
        await safeReply(ctx, `Could not fetch PR #${prNumber}. Check the number or GitHub token.`);
      }
      return;
    }

    // Handle admin query (platform stats)
    if (intent.category === 'admin_query') {
      await safeReply(ctx, '📊 Fetching platform data...');
      try {
        const res = await axios.get(BACKEND_API_URL + '/admin/summary', { 
          headers: ADMIN_API_KEY ? { 'x-admin-key': ADMIN_API_KEY } : {} 
        });
        
        const msg = `*Platform Statistics*\n\n👥 Users: ${res.data.users}\n📋 Profiles: ${res.data.profiles}\n🤝 Matches: ${res.data.matches}\n📄 Contracts: ${res.data.contracts}\n⚠️ Disputes: ${res.data.disputes}\n\n_Updated: ${new Date(res.data.time).toLocaleString()}_`;
        await safeReply(ctx, msg, true);
      } catch (err) {
        console.error(err?.response?.data || err.message);
        await safeReply(ctx, 'Could not fetch platform statistics.');
      }
      return;
    }

    // Handle user search
    if (intent.category === 'user_search') {
      const searchQuery = intent.searchQuery || userMessage.replace(/does agent tinder have a user (called|named)?|is there a user|find user|search for user/gi, '').trim();
      if (!searchQuery || searchQuery.length < 2) {
        await safeReply(ctx, 'Please provide a name or email to search for.');
        return;
      }

      await safeReply(ctx, `🔍 Searching for user: ${searchQuery}...`);
      try {
        const res = await axios.get(`${BACKEND_API_URL}/admin/search-users`, {
          params: { q: searchQuery },
          headers: ADMIN_API_KEY ? { 'x-admin-key': ADMIN_API_KEY } : {}
        });

        if (res.data.users && res.data.users.length > 0) {
          const users = res.data.users.slice(0, 5); // Show max 5 results
          let msg = `✅ Found ${res.data.count} user(s):\n\n`;
          users.forEach(user => {
            const suspendedTag = user.suspended ? ' [SUSPENDED]' : '';
            msg += `👤 ${user.name || 'No name'}\n`;
            msg += `   📧 ${user.email}\n`;
            msg += `   🆔 ${user.id}${suspendedTag}\n`;
            msg += `   📅 Joined: ${new Date(user.created_at).toLocaleDateString()}\n\n`;
          });
          if (res.data.count > 5) {
            msg += `_...and ${res.data.count - 5} more results_`;
          }
          await safeReply(ctx, msg);
        } else {
          await safeReply(ctx, `❌ No users found matching "${searchQuery}"`);
        }
      } catch (err) {
        console.error(err?.response?.data || err.message);
        await safeReply(ctx, 'Could not search users. Check if the backend is running.');
      }
      return;
    }

    // Handle create user with profile
    if (intent.category === 'create_user_profile') {
      const userData = intent.userData || {};
      const extractedName = userData.name || null;
      const extractedEmail = userData.email || null;
      const extractedSkills = Array.isArray(userData.skills) ? userData.skills : [];
      const extractedPrice = userData.price || null;
      const extractedAbout = userData.about || '';

      // Check for mandatory field: email
      if (!extractedEmail) {
        await safeReply(ctx, `📝 I need more information to create this user.\n\nPlease provide an email address.\n\nExample: "Create user suneil@example.com with python skills"`);
        return;
      }

      // Generate confirmation message
      let confirmMsg = `📋 *User Creation Request*\n\n`;
      confirmMsg += `Name: ${extractedName || '(not provided)'}\n`;
      confirmMsg += `Email: ${extractedEmail}\n`;
      if (extractedSkills.length > 0) {
        confirmMsg += `Skills: ${extractedSkills.join(', ')}\n`;
      }
      if (extractedPrice) {
        confirmMsg += `Rate: $${extractedPrice}/hour\n`;
      }
      if (extractedAbout) {
        confirmMsg += `About: ${extractedAbout}\n`;
      }
      confirmMsg += `\n✅ Creating user and profile...`;

      await safeReply(ctx, confirmMsg, true);

      try {
        // Step 1: Create user
        const userPayload = {
          email: extractedEmail,
          name: extractedName || extractedEmail.split('@')[0]
        };

        const userRes = await axios.post(
          `${BACKEND_API_URL}/admin/users`,
          userPayload,
          { headers: ADMIN_API_KEY ? { 'x-admin-key': ADMIN_API_KEY } : {} }
        );

        const createdUser = userRes.data;
        const userId = createdUser.id;

        // Step 2: Create profile if skills or price provided
        let profileMsg = '';
        if (extractedSkills.length > 0 || extractedPrice || extractedAbout) {
          const profilePayload = {
            userId: userId,
            skills: extractedSkills,
            about: extractedAbout,
            price: extractedPrice
          };

          const profileRes = await axios.post(
            `${BACKEND_API_URL}/admin/profiles`,
            profilePayload,
            { headers: ADMIN_API_KEY ? { 'x-admin-key': ADMIN_API_KEY } : {} }
          );

          profileMsg = `\n\n📋 Profile created: \`${profileRes.data.id}\``;
        }

        const successMsg = `✅ *User Created Successfully!*\n\n` +
                          `👤 Name: ${createdUser.name}\n` +
                          `📧 Email: ${createdUser.email}\n` +
                          `🆔 User ID: \`${userId}\`${profileMsg}\n\n` +
                          `_User can now access the platform_`;
        
        await safeReply(ctx, successMsg, true);
      } catch (err) {
        console.error('Create user error:', err?.response?.data || err.message);
        const errorDetail = err?.response?.data?.error || err.message;
        if (errorDetail.includes('duplicate') || errorDetail.includes('unique')) {
          await safeReply(ctx, `❌ User with email ${extractedEmail} already exists. Try searching for them first.`);
        } else {
          await safeReply(ctx, `❌ Failed to create user: ${errorDetail}`);
        }
      }
      return;
    }

    // Handle greeting
    if (intent.category === 'greeting') {
      await safeReply(ctx, "Hello! I'm your OpenAI-powered development assistant. How can I help you today?");
      return;
    }

    // Handle help
    if (intent.category === 'help') {
      const helpMsg = `*AgentTinder Telegram Bot*\n\nI can help you with:\n\n💬 *Discuss ideas* - Just ask me for suggestions or advice\n🔧 *Create code* - Tell me to implement/build/fix something\n📊 *Platform stats* - Ask about users, matches, etc.\n📝 *PR queries* - Ask about specific PRs\n\nCommands:\n/summary - Quick platform overview\n/matches - Recent matches\n/agent <id> - Profile details\n\n_Just chat naturally!_`;
      await safeReply(ctx, helpMsg, true);
      return;
    }

    // Fallback
    await safeReply(ctx, "I'm not sure how to help with that. Try asking me for ideas, requesting a feature, or checking platform stats!");

  } catch (error) {
    console.error('Error processing message:', error);
    const errorMsg = error.message || 'Unknown error';
    await safeReply(ctx, `❌ Something went wrong: ${errorMsg.substring(0, 200)}`);
  }
});

// Launch bot
bot.launch().then(() => console.log('Telegram Master Agent running with OpenAI'));

function gracefulStop(signal) {
  console.log(`Shutting down Telegram bot (signal: ${signal})`);
  bot.stop(signal);
  process.exit(0);
}

process.once('SIGINT', () => gracefulStop('SIGINT'));
process.once('SIGTERM', () => gracefulStop('SIGTERM'));
