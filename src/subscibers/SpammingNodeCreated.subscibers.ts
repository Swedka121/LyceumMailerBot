/** @format */

import { EventSubscriber } from "typeorm";
import type { EntitySubscriberInterface, InsertEvent } from "typeorm";
import { SpammingNodeSchema } from "../schemas/SpammingNode.schema";
import {
  SpammingTaskSchema,
  SpammingTaskStatus,
} from "../schemas/SpammingTask.schema";
import { GLOBAL } from "../globals";
import { createLogger } from "../logger";

@EventSubscriber()
export class SpammingNodeCreatedSubsriber implements EntitySubscriberInterface<SpammingNodeSchema> {
  private logger = createLogger("Spamming Node Created Subsriber");
  listenTo(): Function | string {
    return SpammingNodeSchema;
  }

  async afterInsert(event: InsertEvent<SpammingNodeSchema>): Promise<any> {
    try {
      if (!event.entity || !event.entity.spammingTaskId) return;

      const spammingTask = await event.manager
        .getRepository(SpammingTaskSchema)
        .findOne({ where: { id: event.entity.spammingTaskId } });

      if (!spammingTask) return;

      const processedNodesCount = await event.manager
        .getRepository(SpammingNodeSchema)
        .count({
          where: { spammingTaskId: spammingTask!.id },
        });

      if (
        spammingTask.status === SpammingTaskStatus.inProgress &&
        spammingTask.shouldBeDelivered == processedNodesCount
      ) {
        spammingTask.status = SpammingTaskStatus.completed;
        await event.manager
          .getRepository(SpammingTaskSchema)
          .save(spammingTask);

        setImmediate(async () => {
          try {
            await GLOBAL.bot.api.sendMessage(
              spammingTask.userId,
              `🎉 <b>Розсилку успішно завершено!</b>\n Ви можете завантажити звіт в <i>історії розсилок</i>`,
              { parse_mode: "HTML" },
            );
          } catch {
            this.logger.warn("Failed to send msg about spamming success", {
              userId: spammingTask.userId,
            });
          }
        });
      }
    } catch (err) {
      this.logger.error(`Fail: ${(err as Error).message}`);
    }
  }
}
