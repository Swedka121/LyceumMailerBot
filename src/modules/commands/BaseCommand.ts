/** @format */

import type { Context } from "../bots/MainBot";
import { GLOBAL } from "../../globals";
import type { EntityManager } from "typeorm";
import { createLogger } from "../../logger";
import type { Logger } from "winston";

export abstract class BaseBotCommand {
  public name: string = "";
  public description: string = "";
  protected logger = createLogger("Command");
  abstract execute(ctx: Context, manager: EntityManager): Promise<void>;
  public run = async (ctx: Context) => {
    const manager = GLOBAL.datasource.createQueryRunner();
    await manager.startTransaction();
    try {
      await this.execute(ctx, manager.manager);
      await manager.commitTransaction();
    } catch (err) {
      console.error(err);
      await manager.rollbackTransaction();
    } finally {
      manager.release();
    }
  };

  setLogger(logger: ReturnType<typeof createLogger>) {
    this.logger = logger;
  }
}

export interface BotCommand {
  name: string;
  description: string;
  execute: (ctx: Context) => Promise<void>;
}

type CommandConstructor = new () => BaseBotCommand;

export function Command(name: string, description: string) {
  return (target: CommandConstructor, ...args: unknown[]) => {
    target.prototype.name = name;
    target.prototype.description = description;

    const commandInstance = new target();

    commandInstance.setLogger(createLogger(commandInstance.name));

    GLOBAL.botManager.addCommand({
      name,
      description,
      execute: commandInstance.run,
    });
  };
}
