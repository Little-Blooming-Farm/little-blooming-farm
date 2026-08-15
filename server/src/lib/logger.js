import env from '../config/env.js';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const threshold = env.isProduction ? LEVELS.info : LEVELS.debug;

// Keys whose values must never reach the logs, at any nesting depth.
const REDACT = new Set([
  'password',
  'passwordhash',
  'passwordHash',
  'token',
  'cancellationtoken',
  'cancellationToken',
  'authorization',
  'cookie',
  'jwt',
  'secret',
  'stripe_signature',
  'client_secret',
  'apikey',
  'api_key',
]);

function redact(value, depth = 0) {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = REDACT.has(k.toLowerCase()) ? '[redacted]' : redact(v, depth + 1);
  }
  return out;
}

function emit(level, message, meta) {
  if (LEVELS[level] > threshold) return;
  const line = {
    t: new Date().toISOString(),
    level,
    msg: message,
    ...(meta ? redact(meta) : {}),
  };
  const target = level === 'error' ? console.error : console.log;
  target(env.isProduction ? JSON.stringify(line) : formatPretty(line));
}

function formatPretty({ t, level, msg, ...rest }) {
  const tag = { error: 'ERR ', warn: 'WARN', info: 'INFO', debug: 'DBG ' }[level];
  const extra = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
  return `${t.slice(11, 19)} ${tag} ${msg}${extra}`;
}

export const logger = {
  error: (msg, meta) => emit('error', msg, meta),
  warn: (msg, meta) => emit('warn', msg, meta),
  info: (msg, meta) => emit('info', msg, meta),
  debug: (msg, meta) => emit('debug', msg, meta),
};

export default logger;
