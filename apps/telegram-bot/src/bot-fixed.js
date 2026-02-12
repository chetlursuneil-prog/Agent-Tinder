// Force Node HTTPS to use IPv4 by default
const https = require('https');
https.globalAgent = new https.Agent({ family: 4, keepAlive: true });

const { Telegraf } = require('telegraf');

const token = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_TOKEN || '';
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN not set');
  process.exit(1);
}

const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://127.0.0.1:3001';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';

const bot = new Telegraf(token);

bot.start((ctx) => ctx.reply('AgentTinder Developer Bot online.\n\nCommands:\n/plan <prompt> — plan a feature\n/build <prompt> — build a feature\n/fix <prompt> — fix a bug'));

// Developer-agent commands: enqueue to backend /tasks
bot.command('plan', async (ctx) => {
  const parts = ctx.message.text.split(' ').slice(1);
  if (!parts.length) return ctx.reply('Usage: /plan <question or roadmap prompt>');
  const prompt = parts.join(' ');
  await ctx.reply('Enqueuing plan task...');
  try {
    const userId = String(ctx.chat.id);
    const payload = { type: 'plan', userId, body: { prompt } };
    const headers = { 'Content-Type': 'application/json' };
    if (ADMIN_API_KEY) headers['x-admin-key'] = ADMIN_API_KEY;
    
    const res = await fetch(`${BACKEND_API_URL}/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const txt = await res.text();
      console.error('POST /tasks failed', res.status, txt);
      return ctx.reply(`Failed to enqueue plan task: ${res.status}`);
    }
    
    const data = await res.json();
    await ctx.reply(`Plan task enqueued: ${data.task?.id || 'OK'}. You'll receive results shortly.`);
  } catch (err) {
    console.error('plan command error:', err?.message || err);
    await ctx.reply('Failed to enqueue plan task');
  }
});

bot.command('build', async (ctx) => {
  const parts = ctx.message.text.split(' ').slice(1);
  if (!parts.length) return ctx.reply('Usage: /build <feature request description>');
  const prompt = parts.join(' ');
  await ctx.reply('Enqueuing build task...');
  try {
    const userId = String(ctx.chat.id);
    const payload = { type: 'build', userId, body: { prompt } };
    const headers = { 'Content-Type': 'application/json' };
    if (ADMIN_API_KEY) headers['x-admin-key'] = ADMIN_API_KEY;
    
    const res = await fetch(`${BACKEND_API_URL}/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const txt = await res.text();
      console.error('POST /tasks failed', res.status, txt);
      return ctx.reply(`Failed to enqueue build task: ${res.status}`);
    }
    
    const data = await res.json();
    await ctx.reply(`Build task enqueued: ${data.task?.id || 'OK'}. You'll receive results shortly.`);
  } catch (err) {
    console.error('build command error:', err?.message || err);
    await ctx.reply('Failed to enqueue build task');
  }
});

bot.command('fix', async (ctx) => {
  const parts = ctx.message.text.split(' ').slice(1);
  if (!parts.length) return ctx.reply('Usage: /fix <bug description>');
  const prompt = parts.join(' ');
  await ctx.reply('Enqueuing fix task...');
  try {
    const userId = String(ctx.chat.id);
    const payload = { type: 'fix', userId, body: { prompt } };
    const headers = { 'Content-Type': 'application/json' };
    if (ADMIN_API_KEY) headers['x-admin-key'] = ADMIN_API_KEY;
    
    const res = await fetch(`${BACKEND_API_URL}/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const txt = await res.text();
      console.error('POST /tasks failed', res.status, txt);
      return ctx.reply(`Failed to enqueue fix task: ${res.status}`);
    }
    
    const data = await res.json();
    await ctx.reply(`Fix task enqueued: ${data.task?.id || 'OK'}. You'll receive results shortly.`);
  } catch (err) {
    console.error('fix command error:', err?.message || err);
    await ctx.reply('Failed to enqueue fix task');
  }
});

bot.launch().then(() => {
  console.log('Telegram bot started', new Date().toISOString());
}).catch((err) => {
  console.error('Failed to start bot', err);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
