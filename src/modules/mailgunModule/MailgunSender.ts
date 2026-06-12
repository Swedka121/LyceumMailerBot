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

export class MailgunTemplateSender extends MailgunWrapper {
  private logger = createLogger("Mailgun Sender");

  constructor() {
    super();
    new CronJob("0 0 * * * *", this.cronJob.bind(this), null, true);
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
        const nodeIds = val.map((node) => node.id);

        const task = await repo.findOne({ where: { id: key } });
        if (!task) throw Error("Meow");

        const template = GLOBAL.botManager.getTemplate(task.templateId);

        try {
          const templateMailgunName = (
            "auto-" + template.name.replaceAll(" ", "_")
          ).toLowerCase();

          const toChunks = val.map((node) => node.email);
          const dataChunks = val.map((node) => node.vars);

          const recipientVariables: Record<
            string,
            Record<string, unknown>
          > = {};

          toChunks.forEach((email, index) => {
            recipientVariables[email] = dataChunks[index] || {};
          });

          if (toChunks.length === 0) throw new Error("");

          await this.mailgun.messages.create(GLOBAL.config.mailgunDomain, {
            to: toChunks,
            from: `${GLOBAL.config.mailgunEmailName} <mailer@${GLOBAL.config.mailgunDomain}>`,
            subject: template.subject,
            template: templateMailgunName,
            "recipient-variables": JSON.stringify(recipientVariables),
            "t:version": "initial",
            "h:X-Sended-By": "lyceum1mailerbot",
            "v:spammingTaskId": task.id,
          });

          await repo.save(task);
        } catch (error) {
          const err = error as Error & { status: string; details: string };
          this.logger.error(
            `Mailgun Error: ${err.message} | Status: ${err.status} | Details: ${JSON.stringify(err.details || err)}`,
          );

          await repoNode.update(
            { id: In(nodeIds) },
            { status: SpammingNodeStatus.failed },
          );
        }
      }
    } catch (error) {
      const err = error as Error & { status: string; details: string };
      this.logger.error(err.message);
    }
  }
}
