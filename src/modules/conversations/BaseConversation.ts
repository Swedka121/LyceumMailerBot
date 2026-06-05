/** @format */

import type { EntityManager } from "typeorm";
import { GLOBAL } from "../../globals";
import type { Context, CustomConversation } from "../bots/MainBot";
import { createLogger } from "../../logger";

export abstract class BaseBotConversation {
  public name: string = "";
  protected logger = createLogger("Conversation");
  abstract execute(
    conversation: CustomConversation,
    ctx: Context,
    manager: EntityManager,
  ): Promise<void>;
  public run = async (conversation: CustomConversation, ctx: Context) => {
    const manager = GLOBAL.datasource.createQueryRunner();
    await manager.startTransaction();
    try {
      await this.execute(conversation, ctx, manager.manager);
      await manager.commitTransaction();
    } catch (err) {
      if (manager.isTransactionActive) {
        await manager.rollbackTransaction();
      }
      if (
        err instanceof Error &&
        (err.message?.includes("interrupted") || "op" in err)
      ) {
        throw err;
      }

      this.logger.error(JSON.stringify(Object.entries(err as Error)));
      console.log(err);
    } finally {
      manager.release();
    }
  };
}

export interface BotConversation {
  name: string;
  execute: (conversation: CustomConversation, ctx: Context) => Promise<void>;
}

type ConversationConstructor = new () => BaseBotConversation;

export function Conversation(name: string) {
  return (target: ConversationConstructor, ...args: unknown[]) => {
    target.prototype.name = name;

    const conversationInstance = new target();

    GLOBAL.botManager.addConversation({
      name,
      execute: conversationInstance.run,
    });
  };
}
