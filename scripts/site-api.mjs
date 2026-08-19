#!/usr/bin/env node
import { callSiteApi, resolveSiteUser } from '../client/site-api-client.mjs';

function parseArgs(argv) {
  const args = { _: [], query: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i += 1;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

function usage() {
  console.error(`Usage:
  node scripts/site-api.mjs health
  node scripts/site-api.mjs summary --telegram-id <id>
  node scripts/site-api.mjs projects --telegram-id <id>
  node scripts/site-api.mjs project-overview --telegram-id <id> --project-id <id>
  node scripts/site-api.mjs materials --telegram-id <id> [--search X] [--section X] [--period week|month] [--offset 0|1] [--aggregate]
  node scripts/site-api.mjs deliveries --telegram-id <id> [--section X] [--period week] [--offset 1]
  node scripts/site-api.mjs suppliers --telegram-id <id> [--search X]
  node scripts/site-api.mjs supplier-materials --telegram-id <id> --supplier-id <id>
  node scripts/site-api.mjs problems --telegram-id <id> [--project-id X] [--type X]
`);
  process.exit(1);
}

function resolveUserId(args) {
  if (args['site-user-id']) return Number(args['site-user-id']);
  if (args['telegram-id']) {
    const user = resolveSiteUser(args['telegram-id']);
    if (!user) {
      const err = new Error('ACCESS_DENIED');
      err.code = 'ACCESS_DENIED';
      err.telegramId = args['telegram-id'];
      throw err;
    }
    return user.site_user_id;
  }
  return null;
}

function pickQuery(args, keys) {
  const query = {};
  for (const key of keys) {
    if (args[key] != null && args[key] !== true) query[key] = args[key];
  }
  if (args.aggregate) query.aggregate = '1';
  return query;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  if (!cmd) usage();

  try {
    if (cmd === 'health') {
      console.log(JSON.stringify(await callSiteApi('health'), null, 2));
      return;
    }

    const siteUserId = resolveUserId(args);
    if (!siteUserId) {
      console.error('Укажите --telegram-id или --site-user-id');
      usage();
    }

    if (cmd === 'summary') {
      console.log(JSON.stringify(await callSiteApi('summary', { siteUserId }), null, 2));
      return;
    }
    if (cmd === 'projects') {
      console.log(JSON.stringify(await callSiteApi('projects', { siteUserId }), null, 2));
      return;
    }
    if (cmd === 'project-overview') {
      if (!args['project-id']) usage();
      console.log(JSON.stringify(await callSiteApi('project_overview', {
        siteUserId,
        projectId: args['project-id'],
      }), null, 2));
      return;
    }
    if (cmd === 'materials') {
      const query = pickQuery(args, [
        'search', 'section', 'supplier', 'status', 'project_id',
        'period', 'offset', 'delivery_from', 'delivery_to', 'order_from', 'order_to',
      ]);
      console.log(JSON.stringify(await callSiteApi('materials', { siteUserId, query }), null, 2));
      return;
    }
    if (cmd === 'deliveries') {
      const query = pickQuery(args, ['section', 'project_id', 'period', 'offset', 'delivery_from', 'delivery_to']);
      if (!query.period && !query.delivery_from) {
        query.period = 'week';
        query.offset = query.offset ?? '1';
      }
      console.log(JSON.stringify(await callSiteApi('deliveries', { siteUserId, query }), null, 2));
      return;
    }
    if (cmd === 'suppliers') {
      const query = pickQuery(args, ['search', 'active']);
      console.log(JSON.stringify(await callSiteApi('suppliers', { siteUserId, query }), null, 2));
      return;
    }
    if (cmd === 'supplier-materials') {
      if (!args['supplier-id']) usage();
      const query = pickQuery(args, ['search', 'period', 'offset']);
      console.log(JSON.stringify(await callSiteApi('supplier_materials', {
        siteUserId,
        supplierId: args['supplier-id'],
        query,
      }), null, 2));
      return;
    }
    if (cmd === 'problems') {
      const query = pickQuery(args, ['project_id', 'severity', 'type']);
      console.log(JSON.stringify(await callSiteApi('problems', { siteUserId, query }), null, 2));
      return;
    }

    usage();
  } catch (err) {
    if (err.code === 'ACCESS_DENIED') {
      console.error(JSON.stringify({
        error: 'access_denied',
        message: 'У вас нет доступа к системе «Контроль материалов».',
        telegram_id: err.telegramId,
      }));
      process.exit(2);
    }
    console.error(JSON.stringify({
      error: 'api_error',
      message: err.message,
      status: err.status ?? null,
    }));
    process.exit(1);
  }
}

main();
