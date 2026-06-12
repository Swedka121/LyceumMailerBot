/** @format */

import Mailgun from "mailgun.js";
import { GLOBAL } from "../../globals";
import { createLogger } from "../../logger";
import {
  EmailTemplate,
  type BaseEmailTemplate,
} from "../emailTemplates/BaseEmailTemplate";
import { MailgunWrapper } from "./MailgunWrapper";
import {
  SpammingTaskSchema,
  SpammingTaskStatus,
} from "../../schemas/SpammingTask.schema";
import {
  SpammingNodeSchema,
  SpammingNodeStatus,
} from "../../schemas/SpammingNode.schema";
import { In } from "typeorm";
import { CronJob } from "cron";

const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export class MailgunTemplateSender extends MailgunWrapper {
  private logger = createLogger("Mailgun Sender");

  constructor() {
    super();
    new CronJob("0 0 * * * *", this.cronJob.bind(this), null, true);
    new CronJob(
      "0 30 */2 * * *",
      this.cronJobCheckTasks.bind(this),
      null,
      true,
    );
  }

  async send(
    to: string[],
    data: Record<string, unknown>[],
    template: BaseEmailTemplate,
    tableLoader: string,
    author: string,
  ) {
    const repo = GLOBAL.datasource.getRepository(SpammingTaskSchema);
    const repoNode = GLOBAL.datasource.getRepository(SpammingNodeSchema);

    const task = repo.create({
      shouldBeDelivered: to.length,
      tableLoader: tableLoader,
      userId: author,
      templateId: template.name,
      status: SpammingTaskStatus.inProgress,
    });
    await repo.save(task);

    const nodes = [];

    for (let i = 0; i < to.length; i++) {
      nodes.push(
        repoNode.create({
          email: to[i],
          spammingTaskId: task.id,
          status: SpammingNodeStatus.pending,
          vars: data[i],
        }),
      );
    }
    await repoNode.save(nodes);
  }

  async cronJobCheckTasks() {
    try {
      const repoNode = GLOBAL.datasource.getRepository(SpammingNodeSchema);
      const repo = GLOBAL.datasource.getRepository(SpammingTaskSchema);

      const tasks = await repo.find({
        where: { status: SpammingTaskStatus.inProgress },
      });

      for (let task of tasks) {
        const successfulOrFailedNodes = await repoNode.count({
          where: {
            status: In([
              SpammingNodeStatus.failed,
              SpammingNodeStatus.successful,
            ]),
            spammingTaskId: task.id,
          },
        });

        if (task.shouldBeDelivered == successfulOrFailedNodes) {
          await repo.update(
            { id: task.id },
            { status: SpammingTaskStatus.completed },
          );
          await GLOBAL.botManager.telegraf.api.sendMessage(
            task.userId,
            `Розсилка з id: <code>${task.id}</code> успішно завершена, ви можете завантажити звіт в історії розсилок`,
            { parse_mode: "HTML" },
          );
        }
      }
    } catch (error) {
      const err = error as Error & { status: string; details: string };
      this.logger.error(err.message);
    }
  }

  async cronJob() {
    try {
      const repoNode = GLOBAL.datasource.getRepository(SpammingNodeSchema);
      const repo = GLOBAL.datasource.getRepository(SpammingTaskSchema);

      const emails = await repoNode.find({
        where: { status: SpammingNodeStatus.pending },
        take: 95,
        order: {
          createdAt: "ASC",
        },
      });

      const groups = new Map<string, SpammingNodeSchema[]>();

      emails.forEach((node) => {
        if (groups.get(node.spammingTaskId)) {
          groups.set(node.spammingTaskId, [
            ...groups.get(node.spammingTaskId)!,
            node,
          ]);
        } else {
          groups.set(node.spammingTaskId, [node]);
        }
      });

      for (let [key, val] of groups.entries()) {
        const task = await repo.findOne({ where: { id: key } });
        if (!task) {
          this.logger.error(`Таску ${key} не знайдено.`);
          continue;
        }

        const template = GLOBAL.botManager.getTemplate(task.templateId);
        if (!template) {
          this.logger.error(`Шаблон для таски ${task.id} не знайдено.`);
          const allNodeIds = val.map((node) => node.id);
          await repoNode.update(
            { id: In(allNodeIds) },
            { status: SpammingNodeStatus.failed },
          );
          continue;
        }

        const templateMailgunName = (
          "auto-" + template.name.replaceAll(" ", "_")
        ).toLowerCase();
        const chunkSize = 5;

        for (let i = 0; i < val.length; i += chunkSize) {
          const chunkNodes = val.slice(i, i + chunkSize);
          const chunkNodeIds = chunkNodes.map((n) => n.id);
          const toArr = chunkNodes.map((n) => n.email);

          const recipientVariables: Record<
            string,
            Record<string, unknown>
          > = {};
          chunkNodes.forEach((node) => {
            recipientVariables[node.email] = node.vars || {};
          });

          if (toArr.length === 0) continue;

          try {
            await this.mailgun.messages.create(GLOBAL.config.mailgunDomain, {
              to: toArr,
              from: `${GLOBAL.config.mailgunEmailName} <mailer@${GLOBAL.config.mailgunDomain}>`,
              subject: template.subject,
              template: templateMailgunName,
              "recipient-variables": JSON.stringify(recipientVariables),
              "t:version": "initial",
              "h:X-Sended-By": "lyceum1mailerbot",
              "v:spammingTaskId": task.id,
            });

            await repoNode.update(
              { id: In(chunkNodeIds) },
              { status: SpammingNodeStatus.pending },
            );

            this.logger.info(
              `Чанк із ${toArr.length} листів успішно передано в Mailgun`,
            );

            if (i + chunkSize < val.length) {
              await delay(20000);
            }
          } catch (chunkError) {
            const err = chunkError as Error & {
              status: string;
              details: string;
            };
            this.logger.error(
              `Помилка відправки конкретного чанку (Таска: ${task.id}): ${err.message}`,
            );

            await repoNode.update(
              { id: In(chunkNodeIds) },
              { status: SpammingNodeStatus.failed },
            );
          }
        }
      }
    } catch (error) {
      const err = error as Error & { status: string; details: string };
      this.logger.error(err.message);
    }
  }
}
