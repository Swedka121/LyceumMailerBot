/** @format */

import { DataSource } from "typeorm";
import { GLOBAL } from "./globals";
import { UserSchema } from "./schemas/User.schema";
import { createLogger } from "./logger";
import { SpammingTaskSchema } from "./schemas/SpammingTask.schema";
import { SpammingNodeSchema } from "./schemas/SpammingNode.schema";

const logger = createLogger("Datasource");

export async function initDatasource() {
  const datasource = new DataSource({
    type: "postgres",
    host: GLOBAL.config.databaseHost,
    port: GLOBAL.config.databasePort,
    username: GLOBAL.config.databaseUser,
    password: GLOBAL.config.databasePassword,
    database: GLOBAL.config.databaseName,
    synchronize: true,
    applicationName: "LyceumMailerBot",
    entities: [UserSchema, SpammingTaskSchema, SpammingNodeSchema],
  });

  await datasource.initialize();

  logger.info("DB is connected!");

  return datasource;
}
