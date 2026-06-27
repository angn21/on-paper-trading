import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './load-env.mjs';

loadEnv();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });
const [command, arg] = process.argv.slice(2);

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

  const { data: profile, error: profileError } = await sb
    .from('profiles')
    .select('id, username')
    .eq('username_lower', username.toLowerCase())
    .maybeSingle();

  if (profileError) throw profileError;
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

async function healthCheck() {
  const { data, error } = await sb.from('profiles').select('id').limit(1);
  if (error) throw error;
  console.log('Supabase OK', { sampleProfiles: data?.length ?? 0 });
}

const commands = {
  users: listUsers,
  portfolio: () => showPortfolio(arg),
  health: healthCheck,
};

if (!command || !commands[command]) {
  console.log(`Usage: node scripts/db-query.mjs <command>

Commands:
  health              Ping Supabase
  users               List accounts
  portfolio <user>    Show cloud portfolio JSON
`);
  process.exit(command ? 1 : 0);
}

commands[command]().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
