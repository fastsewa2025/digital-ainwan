import pino from 'pino';

export function makeLogger(config) {
  return pino({
    level: config.logLevel,
    redact: {
      paths: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
      censor: '[redacted]',
    },
    transport: config.env === 'development' ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
  });
}
