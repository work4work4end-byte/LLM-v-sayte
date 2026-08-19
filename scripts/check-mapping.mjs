#!/usr/bin/env node
import { loadTelegramUsers, resolveSiteUser } from '../client/site-api-client.mjs';

const users = loadTelegramUsers();
const entries = Object.entries(users);

console.log(`Telegram users configured: ${entries.length}`);
for (const [tgId, entry] of entries) {
  const resolved = resolveSiteUser(tgId, users);
  console.log(`  ${tgId} → site_user_id=${resolved.site_user_id} (${resolved.display_name}, @${resolved.username || '?'})`);
}
