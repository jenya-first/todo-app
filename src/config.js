import 'dotenv/config';

function required(name) {
  const v = process.env[name];
  if (!v || !v.trim()) {
    console.error(`Missing required env variable ${name}`);
    process.exit(1);
  }
  return v.trim();
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  databaseUrl: required('DATABASE_URL'),
  databaseSsl: process.env.DATABASE_SSL === 'true',
  apiToken: required('API_TOKEN'),
  authorLogin: required('AUTHOR_LOGIN'),
  authorFullName: required('AUTHOR_FULLNAME'),
  corsOrigins: (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};
