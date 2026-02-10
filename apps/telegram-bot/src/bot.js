const { Telegraf } = require('telegraf');
const axios = require('axios');

const token = process.env.TELEGRAM_TOKEN || 'REPLACE_WITH_TOKEN';
const ADMIN_IDS = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').filter(Boolean).map(x => parseInt(x, 10));
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3001';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';

const bot = new Telegraf(token);

function isAdmin(ctx) {
  if (!ADMIN_IDS || ADMIN_IDS.length === 0) return true; // allow if not configured
  return ADMIN_IDS.includes(ctx.from.id);
}

bot.start((ctx) => ctx.reply('Master Agent online. Use /summary to get a quick platform overview.'));

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
    // fetch user
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

// Suspend flow with confirmation buttons
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

// launch
bot.launch().then(() => console.log('Telegram Master Agent running'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
