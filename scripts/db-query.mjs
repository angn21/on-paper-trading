import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import {
  STARTING_CASH,
  defaultPortfolioState,
  displayUsername,
  normalizeUsername,
  sanitizePortfolioState,
  validatePin,
  validateUsername,
} from '../server/auth/portfolioState.js';
import { hashPin } from '../server/auth/pin.js';
import { loadEnv } from './load-env.mjs';

loadEnv();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });
const argv = process.argv.slice(2);
const [command, arg, extraArg, fourthArg] = argv;
const flags = new Set(argv.filter((a) => a.startsWith('--')));

function usage() {
  console.log(`Usage: node scripts/db-query.mjs <command> [args]

Commands:
  health                           Ping Supabase
  users                            List accounts
  recent                           Users sorted by last cloud save
  inspect <user>                   Summary (cash, positions, watchlist…)
  portfolio <user>                 Full cloud portfolio JSON
  grant-cash <user> <amount>       Add cash
  set-cash <user> <amount>         Set cash to exact amount
  grant-shares <user> <sym> <qty> [avgCost]  Add paper shares (no cash deducted)
  reset-portfolio <user> --yes     Reset to $100k empty portfolio
  delete-user <user> --yes         Delete account + portfolio
  export <user> [file]             Save portfolio JSON to backups/
  import <user> <file> --yes       Restore portfolio from JSON file
  create-user <user> <pin> [cash]  Create account (default cash $100,000)
`);
}

function requireYes(flagName) {
  if (!flags.has('--yes')) {
    console.error(`Destructive action — re-run with ${flagName} to confirm.`);
    process.exit(1);
  }
}

function syncNote() {
  console.log('User picks this up on next sync (~15s) or Account → Sync now.');
}

async function findUser(username) {
  if (!username) return null;

  const { data: profile, error } = await sb
    .from('profiles')
    .select('id, username, created_at')
    .eq('username_lower', username.toLowerCase())
    .maybeSingle();

  if (error) throw error;
  return profile;
}

async function loadPortfolioRow(userId) {
  const { data, error } = await sb
    .from('portfolios')
    .select('data, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function savePortfolio(userId, data) {
  const { data: saved, error } = await sb
    .from('portfolios')
    .upsert(
      {
        user_id: userId,
        data: sanitizePortfolioState(data),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select('updated_at')
    .single();

  if (error) throw error;
  return saved;
}

function buildInitialPortfolio(cash = STARTING_CASH) {
  const now = Date.now();
  const amount = Math.round(Number(cash) * 100) / 100;
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Cash must be zero or a positive number.');
  }
  return sanitizePortfolioState({
    ...defaultPortfolioState,
    cash: amount,
    portfolioHistory: [{ ts: now, totalValue: amount }],
    benchmarkHistory: [{ ts: now, spyPrice: null, portfolioValue: amount }],
  });
}

function buildFreshPortfolio() {
  return buildInitialPortfolio(STARTING_CASH);
}

function summarizePortfolio(data) {
  const p = sanitizePortfolioState(data);
  const symbols = Object.keys(p.positions || {});
  let holdingsBasis = 0;

  for (const sym of symbols) {
    const pos = p.positions[sym];
    holdingsBasis += (Number(pos.shares) || 0) * (Number(pos.avgCost) || 0);
  }

  const positionLines = symbols.map((sym) => {
    const pos = p.positions[sym];
    return `    ${sym}: ${pos.shares} @ $${Number(pos.avgCost).toFixed(2)}`;
  });

  return {
    cash: p.cash,
    positionCount: symbols.length,
    positionLines,
    options: p.options.length,
    watchlist: p.watchlist,
    pendingOrders: p.pendingOrders.length,
    transactions: p.transactions.length,
    estimatedValue: Math.round((p.cash + holdingsBasis) * 100) / 100,
  };
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

async function listRecent() {
  const { data, error } = await sb
    .from('portfolios')
    .select('updated_at, data, profiles(username)')
    .order('updated_at', { ascending: false, nullsFirst: false });

  if (error) throw error;
  if (!data?.length) {
    console.log('No portfolio saves yet.');
    return;
  }

  console.log('USERNAME\tLAST SAVE\t\t\tCASH\t\tPOSITIONS');
  for (const row of data) {
    const username = row.profiles?.username || '?';
    const summary = summarizePortfolio(row.data || {});
    const updated = row.updated_at ? new Date(row.updated_at).toLocaleString() : 'never';
    console.log(
      `${username}\t${updated}\t$${summary.cash.toLocaleString()}\t${summary.positionCount}`,
    );
  }
}

async function inspectUser(username) {
  if (!username) {
    console.error('Usage: npm run db:inspect -- <username>');
    process.exit(1);
  }

  const profile = await findUser(username);
  if (!profile) {
    console.error(`User not found: ${username}`);
    process.exit(1);
  }

  const portfolio = await loadPortfolioRow(profile.id);
  const summary = summarizePortfolio(portfolio?.data || defaultPortfolioState);

  console.log(`User:      ${profile.username}`);
  console.log(`Joined:    ${new Date(profile.created_at).toLocaleString()}`);
  console.log(`Last save: ${portfolio?.updated_at ? new Date(portfolio.updated_at).toLocaleString() : 'never'}`);
  console.log(`Cash:      $${summary.cash.toLocaleString()}`);
  console.log(`Est. value $${summary.estimatedValue.toLocaleString()} (cash + cost basis)`);
  console.log(`Positions: ${summary.positionCount}`);
  if (summary.positionLines.length) {
    console.log(summary.positionLines.join('\n'));
  }
  console.log(`Options:   ${summary.options}`);
  console.log(`Watchlist: ${summary.watchlist.length ? summary.watchlist.join(', ') : '(empty)'}`);
  console.log(`Pending:   ${summary.pendingOrders}`);
  console.log(`Trades:    ${summary.transactions}`);
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

  const portfolio = await loadPortfolioRow(profile.id);

  console.log(`User: ${profile.username}`);
  console.log(`Updated: ${portfolio?.updated_at || 'never'}`);
  console.log(JSON.stringify(portfolio?.data || {}, null, 2));
}

async function grantCash(username, amountRaw) {
  if (!username || amountRaw === undefined) {
    console.error('Usage: npm run db:grant-cash -- <username> <amount>');
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

  const existing = await loadPortfolioRow(profile.id);
  const current = sanitizePortfolioState(existing?.data || defaultPortfolioState);
  const nextCash = Math.round((current.cash + amount) * 100) / 100;
  const saved = await savePortfolio(profile.id, { ...current, cash: nextCash });

  console.log(`Granted $${amount.toLocaleString()} to ${profile.username}`);
  console.log(`Cash: $${current.cash.toLocaleString()} → $${nextCash.toLocaleString()}`);
  console.log(`Cloud updated: ${saved.updated_at}`);
  syncNote();
}

async function setCash(username, amountRaw) {
  if (!username || amountRaw === undefined) {
    console.error('Usage: npm run db:set-cash -- <username> <amount>');
    process.exit(1);
  }

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount < 0) {
    console.error('Amount must be zero or a positive number.');
    process.exit(1);
  }

  const profile = await findUser(username);
  if (!profile) {
    console.error(`User not found: ${username}`);
    process.exit(1);
  }

  const existing = await loadPortfolioRow(profile.id);
  const current = sanitizePortfolioState(existing?.data || defaultPortfolioState);
  const nextCash = Math.round(amount * 100) / 100;
  const saved = await savePortfolio(profile.id, { ...current, cash: nextCash });

  console.log(`Set cash for ${profile.username}`);
  console.log(`Cash: $${current.cash.toLocaleString()} → $${nextCash.toLocaleString()}`);
  console.log(`Cloud updated: ${saved.updated_at}`);
  syncNote();
}

async function grantShares(username, symbolRaw, qtyRaw, avgCostRaw) {
  if (!username || !symbolRaw || qtyRaw === undefined) {
    console.error('Usage: npm run db:grant-shares -- <username> <SYMBOL> <shares> [avgCost]');
    process.exit(1);
  }

  const symbol = symbolRaw.toUpperCase();
  const shares = Number(qtyRaw);
  const avgCost = avgCostRaw !== undefined ? Number(avgCostRaw) : 0;

  if (!Number.isFinite(shares) || shares <= 0) {
    console.error('Share count must be a positive number.');
    process.exit(1);
  }
  if (!Number.isFinite(avgCost) || avgCost < 0) {
    console.error('avgCost must be zero or a positive number.');
    process.exit(1);
  }

  const profile = await findUser(username);
  if (!profile) {
    console.error(`User not found: ${username}`);
    process.exit(1);
  }

  const existing = await loadPortfolioRow(profile.id);
  const current = sanitizePortfolioState(existing?.data || defaultPortfolioState);
  const prev = current.positions[symbol] || { shares: 0, avgCost: 0 };
  const totalShares = prev.shares + shares;
  const blendedCost = totalShares
    ? ((prev.shares * prev.avgCost) + (shares * avgCost)) / totalShares
    : avgCost;

  const nextPositions = {
    ...current.positions,
    [symbol]: {
      shares: totalShares,
      avgCost: Math.round(blendedCost * 100) / 100,
    },
  };

  const saved = await savePortfolio(profile.id, { ...current, positions: nextPositions });

  console.log(`Granted ${shares} ${symbol} to ${profile.username} (avg ~$${blendedCost.toFixed(2)})`);
  console.log(`Position: ${prev.shares} → ${totalShares} shares`);
  console.log(`Cash unchanged: $${current.cash.toLocaleString()}`);
  console.log(`Cloud updated: ${saved.updated_at}`);
  syncNote();
}

async function resetPortfolio(username) {
  if (!username) {
    console.error('Usage: npm run db:reset-portfolio -- <username> --yes');
    process.exit(1);
  }
  requireYes('--yes');

  const profile = await findUser(username);
  if (!profile) {
    console.error(`User not found: ${username}`);
    process.exit(1);
  }

  const fresh = buildFreshPortfolio();
  const saved = await savePortfolio(profile.id, fresh);

  console.log(`Reset portfolio for ${profile.username}`);
  console.log(`Cash: $${STARTING_CASH.toLocaleString()}, no positions/watchlist/trades`);
  console.log(`Cloud updated: ${saved.updated_at}`);
  syncNote();
}

async function deleteUser(username) {
  if (!username) {
    console.error('Usage: npm run db:delete-user -- <username> --yes');
    process.exit(1);
  }
  requireYes('--yes');

  const profile = await findUser(username);
  if (!profile) {
    console.error(`User not found: ${username}`);
    process.exit(1);
  }

  const { error } = await sb.from('profiles').delete().eq('id', profile.id);
  if (error) throw error;

  console.log(`Deleted account: ${profile.username} (portfolio cascades automatically)`);
}

async function exportPortfolio(username, fileArg) {
  if (!username) {
    console.error('Usage: npm run db:export -- <username> [file.json]');
    process.exit(1);
  }

  const profile = await findUser(username);
  if (!profile) {
    console.error(`User not found: ${username}`);
    process.exit(1);
  }

  const portfolio = await loadPortfolioRow(profile.id);
  const payload = {
    username: profile.username,
    exportedAt: new Date().toISOString(),
    updatedAt: portfolio?.updated_at || null,
    data: sanitizePortfolioState(portfolio?.data || defaultPortfolioState),
  };

  const backupsDir = resolve(import.meta.dirname, '../backups');
  mkdirSync(backupsDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = fileArg
    ? resolve(process.cwd(), fileArg)
    : resolve(backupsDir, `${profile.username}-${stamp}.json`);

  writeFileSync(outPath, JSON.stringify(payload, null, 2));

  console.log(`Exported ${profile.username} → ${outPath}`);
}

async function importPortfolio(username, fileArg) {
  if (!username || !fileArg) {
    console.error('Usage: npm run db:import -- <username> <file.json> --yes');
    process.exit(1);
  }
  requireYes('--yes');

  const profile = await findUser(username);
  if (!profile) {
    console.error(`User not found: ${username}`);
    process.exit(1);
  }

  const filePath = resolve(process.cwd(), fileArg);
  if (!existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    console.error('Invalid JSON file.');
    process.exit(1);
  }

  const data = sanitizePortfolioState(parsed.data || parsed);
  const saved = await savePortfolio(profile.id, data);

  console.log(`Imported portfolio into ${profile.username} from ${filePath}`);
  console.log(`Cloud updated: ${saved.updated_at}`);
  syncNote();
}

async function createUser(usernameRaw, pin, cashRaw) {
  if (!usernameRaw || !pin) {
    console.error('Usage: npm run db:create-user -- <username> <pin> [cash]');
    console.error('Example: npm run db:create-user -- friend 1234 250000');
    process.exit(1);
  }

  const username = displayUsername(usernameRaw);
  if (!validateUsername(username)) {
    console.error('Username must be 3–20 characters (letters, numbers, underscore only).');
    process.exit(1);
  }

  if (!validatePin(pin)) {
    console.error('PIN must be 4–6 digits.');
    process.exit(1);
  }

  const existing = await findUser(username);
  if (existing) {
    console.error(`Username already taken: ${username}`);
    process.exit(1);
  }

  const cash = cashRaw === undefined ? STARTING_CASH : Number(cashRaw);
  if (!Number.isFinite(cash) || cash < 0) {
    console.error('Cash must be zero or a positive number.');
    process.exit(1);
  }

  const pinHash = await hashPin(pin);
  const usernameLower = normalizeUsername(username);

  const { data: profile, error: profileError } = await sb
    .from('profiles')
    .insert({
      username,
      username_lower: usernameLower,
      pin_hash: pinHash,
    })
    .select('id, username, created_at')
    .single();

  if (profileError) {
    if (profileError.code === '23505') {
      console.error(`Username already taken: ${username}`);
      process.exit(1);
    }
    throw profileError;
  }

  const portfolioData = buildInitialPortfolio(cash);
  const { error: portfolioError } = await sb.from('portfolios').insert({
    user_id: profile.id,
    data: portfolioData,
  });

  if (portfolioError) {
    await sb.from('profiles').delete().eq('id', profile.id);
    throw portfolioError;
  }

  console.log(`Created account: ${profile.username}`);
  console.log(`User ID:   ${profile.id}`);
  console.log(`Joined:    ${new Date(profile.created_at).toLocaleString()}`);
  console.log(`Starting cash: $${portfolioData.cash.toLocaleString()}`);
  console.log('They can sign in at Account → Sign in with this username + PIN.');
}

async function healthCheck() {
  const { data, error } = await sb.from('profiles').select('id').limit(1);
  if (error) throw error;
  console.log('Supabase OK', { sampleProfiles: data?.length ?? 0 });
}

const commands = {
  health: healthCheck,
  users: listUsers,
  recent: listRecent,
  inspect: () => inspectUser(arg),
  portfolio: () => showPortfolio(arg),
  'grant-cash': () => grantCash(arg, extraArg),
  'set-cash': () => setCash(arg, extraArg),
  'grant-shares': () => grantShares(arg, extraArg, fourthArg, argv[4]),
  'reset-portfolio': () => resetPortfolio(arg),
  'delete-user': () => deleteUser(arg),
  export: () => exportPortfolio(arg, extraArg),
  import: () => importPortfolio(arg, extraArg),
  'create-user': () => createUser(arg, extraArg, fourthArg),
};

if (!command || !commands[command]) {
  usage();
  process.exit(command ? 1 : 0);
}

commands[command]().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
