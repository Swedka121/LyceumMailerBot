/** @format */

import z, { ZodError } from "zod";
import { config } from "dotenv";
import { createLogger } from "./logger";
config({ path: [".env.local", ".env"] });

import { readFileSync } from "fs";
import path from "path";

const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

const configSchema = z.object(
  {
    botToken: z.string().regex(/^\d{10}:.+$/, {
      message:
        "botToken must be in the format '10 digits:symbols' (e.g., 1234567890:AbC_123)",
    }),
    nodeEnv: z.enum(["development", "production"], {
      error: "NODE_ENV must be 'development' or 'production'",
    }),
    adminCode: z.string().regex(passwordRegex, {
      message:
        "Password must be at least 8 characters long and contain an uppercase letter, a lowercase letter, a number, and a special character.",
    }),
    testSecretPass: z.string(),

    databaseUser: z.string(),
    databasePassword: z.string(),
    databaseName: z.string(),
    databasePort: z.transform((inp) => Number.parseInt(inp as string)),
    databaseHost: z.string(),

    googleServiceAccountKey: z.string(),

    mailgunApiKey: z.string(),
    mailgunDomain: z.string(),
    mailgunEmailName: z.string(),
    mailgunSigningKey: z.string(),

    webhookPort: z.transform((inp) => Number.parseInt(inp as string)),
    webhookBaseUrl: z.url(),
  },
  { error: "Config is invalid" },
);

const logger = createLogger("Config");

export class Config {
  public botToken!: string;
  public nodeEnv!: "development" | "production";
  public adminCode!: string;
  public testSecretPass!: string;

  public databaseUser!: string;
  public databaseHost!: string;
  public databaseName!: string;
  public databasePassword!: string;
  public databasePort!: number;

  public googleServiceAccountKey!: Record<string, unknown>;

  public mailgunApiKey!: string;
  public mailgunDomain!: string;
  public mailgunEmailName!: string;
  public mailgunSigningKey!: string;

  public webhookPort!: number;
  public webhookBaseUrl!: string;

  private remakeCamelToSSnake(str: string): string {
    return str.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();
  }
  constructor() {
    try {
      logger.info("Start parsing config!");
      let forZod: Record<string, unknown> = {};
      for (const key of Object.keys(configSchema.shape)) {
        const envKey = this.remakeCamelToSSnake(key);
        logger.debug(envKey);
        forZod[key] = process.env[envKey];
      }

      const validatedData = configSchema.parse(forZod);

      Object.assign(this, validatedData);

      if (validatedData.googleServiceAccountKey) {
        const pathToFile = path.join(
          process.cwd(),
          validatedData.googleServiceAccountKey,
        );
        logger.debug(pathToFile);
        const file = readFileSync(pathToFile).toString();
        this.googleServiceAccountKey = JSON.parse(file);
      }

      logger.info("Config parsed!");
    } catch (err: any) {
      const errors = Array.isArray(err) ? err : err.errors || err.issues || [];

      if (errors.length > 0) {
        const errorMessages = errors.map((e: any) => {
          const field = e.path ? e.path.join(".") : "unknown";
          return `${field}: ${e.message}`;
        });

        logger.error(
          "❌ Configuration validation failed:\n" + errorMessages.join("\n"),
        );
      } else {
        logger.error(
          "❌ Configuration validation failed:" + err.message || err,
        );
      }

      process.exit(1);
    }
  }
}
