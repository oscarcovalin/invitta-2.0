'use strict';

function publicationSupabaseOrigin(config) {
  if (!config || typeof config.url !== 'string' || typeof config.secretKey !== 'string'
      || !config.secretKey.startsWith('sb_secret_')
      || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.url)) return null;
  return config.url.replace(/\/$/, '');
}

module.exports = { publicationSupabaseOrigin };
