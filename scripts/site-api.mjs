#!/usr/bin/env node
/**
 * CLI для Hermes: read-only запросы к сайту «Контроль материалов».
 *
 * Примеры:
 *   node scripts/site-api.mjs health
 *   node scripts/site-api.mjs summary --telegram-id 123456789
 *   node scripts/site-api.mjs projects --site-user-id 3
 *   node scripts/site-api.mjs project-overview --telegram-id 123456789 --project-id 5
 */

import { callSiteApi, resolveSiteUser } from '../client/site-api-client.mjs';

function parseArgs(argv) {
  const args = { _: [] };
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
  node scripts/site-api.mjs summary --telegram-id <id> | --site-user-id <id>
  node scripts/site-api.mjs projects --telegram-id <id> | --site-user-id <id>
  node scripts/site-api.mjs project-overview --project-id <id> [--telegram-id <id> | --site-user-id <id>]
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  if (!cmd) usage();

  try {
    if (cmd === 'health') {
      const data = await callSiteApi('health');
      console.log(JSON.stringify(data, null, 2));
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
      if (!args['project-id']) {
        console.error('Нужен --project-id');
        usage();
      }
      console.log(JSON.stringify(
        await callSiteApi('project_overview', {
          siteUserId,
          projectId: args['project-id'],
        }),
        null,
        2,
      ));
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
