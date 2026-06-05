/** @format */

import winston from "winston";

// Колірні коди для стилізації NestJS (ANSI-кольори)
const clc = {
  green: (text: string) => `\x1B[32m${text}\x1B[39m`,
  yellow: (text: string) => `\x1B[33m${text}\x1B[39m`,
  red: (text: string) => `\x1B[31m${text}\x1B[39m`,
  magentaBright: (text: string) => `\x1B[95m${text}\x1B[39m`,
  cyanBright: (text: string) => `\x1B[96m${text}\x1B[39m`,
};

// Функція для підсвічування рівнів логів
const getLevelColor = (level: string) => {
  switch (level) {
    case "info":
      return clc.green(level.toUpperCase());
    case "error":
      return clc.red(level.toUpperCase());
    case "warn":
      return clc.yellow(level.toUpperCase());
    default:
      return clc.cyanBright(level.toUpperCase());
  }
};

// 💡 Головний кастомний формат а-ля NestJS
const nestLikeFormat = winston.format.printf(
  ({ level, message, timestamp, context, ...meta }) => {
    const appPid = clc.green(`[BunBot] ${process.pid}  - `);
    const formattedTimestamp = timestamp
      ? new Date(timestamp as number).toLocaleString()
      : "";
    const coloredLevel = getLevelColor(level);
    const coloredContext = context ? clc.yellow(`[${context}] `) : "";

    // Якщо передано об'єкт помилки або додаткові мета-дані, гарно форматуємо їх у JSON
    const metaString = Object.keys(meta).length
      ? clc.magentaBright(
          ` ${Array.from(Object.entries(meta))
            .map((el) => `[${el[0]}:${JSON.stringify(el[1])}]`)
            .join(" ")}`,
        )
      : "";

    return `${appPid}${formattedTimestamp}     ${coloredLevel} ${coloredContext}${message}${metaString}`;
  },
);

// Створюємо інстанс глобального логера
export const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    process.env.NODE_ENV === "production"
      ? winston.format.json() // Для продакшну (наприклад, Docker + ELK/Loki) краще JSON
      : nestLikeFormat, // Для локальної розробки — красивий Nest-style
  ),
  transports: [new winston.transports.Console()],
});

/**
 * Хелпер для створення логера з прив'язаним контекстом (модулем)
 */
export function createLogger(context: string) {
  return {
    info: (msg: string, meta?: object) =>
      logger.info(msg, { context, ...meta }),
    error: (msg: string, meta?: object) =>
      logger.error(msg, { context, ...meta }),
    warn: (msg: string, meta?: object) =>
      logger.warn(msg, { context, ...meta }),
    debug: (msg: string, meta?: object) =>
      logger.debug(msg, { context, ...meta }),
  };
}
