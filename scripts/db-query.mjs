import { createClient } from '@supabase/supabase-js';
import { defaultPortfolioState, sanitizePortfolioState } from '../server/auth/portfolioState.js';
import { loadEnv } from './load-env.mjs';

loadEnv();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });
const [command, arg, extraArg] = process.argv.slice(2);

async function findUser(username) {
  if (!username) return null;

  const { data: profile, error } = await sb
    .from('profiles')
    .select('id, username')
    .eq('username_lower', username.toLowerCase())
    .maybeSingle();

  if (error) throw error;
  return profile;
}

async function listUsers() {
  const { data, error } = await sb
    .from('profiles')
    .select('id, username, created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!data?.length) {
    console.log('No users found.');
    return;
  }

  for (const row of data) {
    console.log(`${row.username}\t${row.id}\t${row.created_at}`);
  }
}

async function showPortfolio(username) {
  if (!username) {
    console.error('Usage: npm run db:portfolio -- <username>');
    process.exit(1);
  }

  const profile = await findUser(username);
  if (!profile) {
    console.error(`User not found: ${username}`);
    process.exit(1);
  }

  const { data: portfolio, error: portfolioError } = await sb
    .from('portfolios')
    .select('data, updated_at')
    .eq('user_id', profile.id)
    .maybeSingle();

  if (portfolioError) throw portfolioError;

  console.log(`User: ${profile.username}`);
  console.log(`Updated: ${portfolio?.updated_at || 'never'}`);
  console.log(JSON.stringify(portfolio?.data || {}, null, 2));
}

async function grantCash(username, amountRaw) {
  if (!username || amountRaw === undefined) {
    console.error('Usage: npm run db:grant-cash -- <username> <amount>');
    console.error('Example: npm run db:grant-cash -- anmol 50000');
    process.exit(1);
  }

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    console.error('Amount must be a positive number.');
    process.exit(1);
  }

  const profile = await findUser(username);
  if (!profile) {
    console.error(`User not found: ${username}`);
    process.exit(1);
  }

  const { data: existing, error: loadError } = await sb
    .from('portfolios')
    .select('data')
    .eq('user_id', profile.id)
    .maybeSingle();

  if (loadError) throw loadError;

  const current = sanitizePortfolioState(existing?.data || defaultPortfolioState);
  const nextCash = Math.round((current.cash + amount) * 100) / 100;
  const nextData = sanitizePortfolioState({ ...current, cash: nextCash });

  const { data: saved, error: saveError } = await sb
    .from('portfolios')
    .upsert(
      {
        user_id: profile.id,
        data: nextData,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select('updated_at')
    .single();

  if (saveError) throw saveError;

  console.log(`Granted $${amount.toLocaleString()} to ${profile.username}`);
  console.log(`Cash: $${current.cash.toLocaleString()} → $${nextCash.toLocaleString()}`);
  console.log(`Cloud updated: ${saved.updated_at}`);
  console.log('User will see this after sync (auto ~15s, or Account → Sync now).');
}

async function healthCheck() {
  const { data, error } = await sb.from('profiles').select('id').limit(1);
  if (error) throw error;
  console.log('Supabase OK', { sampleProfiles: data?.length ?? 0 });
}

const commands = {
  health: healthCheck,
  users: listUsers,
  portfolio: () => showPortfolio(arg),
  'grant-cash': () => grantCash(arg, extraArg),
};

if (!command || !commands[command]) {
  console.log(`Usage: node scripts/db-query.mjs <command>

Commands:
  health                      Ping Supabase
  users                       List accounts
  portfolio <user>            Show cloud portfolio JSON
  grant-cash <user> <amount>  Add cash to a user's cloud portfolio
`);
  process.exit(command ? 1 : 0);
}

commands[command]().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
