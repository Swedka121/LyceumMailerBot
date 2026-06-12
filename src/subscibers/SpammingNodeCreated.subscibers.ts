/** @format */

import { EventSubscriber } from "typeorm";
import type { EntitySubscriberInterface, UpdateEvent } from "typeorm";
import {
  SpammingNodeSchema,
  SpammingNodeStatus,
} from "../schemas/SpammingNode.schema";
import {
  SpammingTaskSchema,
  SpammingTaskStatus,
} from "../schemas/SpammingTask.schema";
import { GLOBAL } from "../globals";
import { createLogger } from "../logger";

@EventSubscriber()
export class SpammingNodeUpdatedSubscriber implements EntitySubscriberInterface<SpammingNodeSchema> {
  private logger = createLogger("Spamming Node Updated Subscriber");

  listenTo(): Function | string {
    return SpammingNodeSchema;
  }

  async afterUpdate(event: UpdateEvent<SpammingNodeSchema>): Promise<any> {
    try {
      const isStatusUpdated = event.updatedColumns.some(
        (col) => col.propertyName === "status",
      );
      if (!isStatusUpdated || !event.entity) return;

      const currentStatus = event.entity.status;
      if (currentStatus === SpammingNodeStatus.pending) return;

      const taskId = event.entity.spammingTaskId;
      if (!taskId) return;

      const taskRepo = event.manager.getRepository(SpammingTaskSchema);
      const spammingTask = await taskRepo.findOne({ where: { id: taskId } });

      if (!spammingTask || spammingTask.status === SpammingTaskStatus.completed)
        return;

      const nodeRepo = event.manager.getRepository(SpammingNodeSchema);
      const remainingNodesCount = await nodeRepo.count({
        where: {
          spammingTaskId: taskId,
          status: SpammingNodeStatus.pending,
        },
      });

      if (remainingNodesCount === 0) {
        spammingTask.status = SpammingTaskStatus.completed;
        await taskRepo.save(spammingTask);

        setImmediate(async () => {
          try {
            await GLOBAL.bot.api.sendMessage(
              spammingTask.userId,
              `🎉 <b>Розсилку повністю завершено!</b>\nУсі вебхуки від Mailgun оброблено. Ви можете завантажити фінальний звіт в <i>історії розсилок</i>`,
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
