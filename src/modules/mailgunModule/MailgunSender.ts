/** @format */

import Mailgun from "mailgun.js";
import { GLOBAL } from "../../globals";
import { createLogger } from "../../logger";
import type { BaseEmailTemplate } from "../emailTemplates/BaseEmailTemplate";
import { randomUUIDv5, randomUUIDv7 } from "bun";
import { MailgunWrapper } from "./MailgunWrapper";
import {
  SpammingTaskSchema,
  SpammingTaskStatus,
} from "../../schemas/SpammingTask.schema";

const chunkArray = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class MailgunTemplateSender extends MailgunWrapper {
  private logger = createLogger("Mailgun Sender");

  async send(
    to: string[],
    data: Record<string, unknown>[],
    template: BaseEmailTemplate,
    tableLoader: string,
    author: string,
  ) {
    const repo = GLOBAL.datasource.getRepository(SpammingTaskSchema);

    const task = repo.create({
      shouldBeDelivered: to.length,
      tableLoader: tableLoader,
      userId: author,
      templateId: template.name,
      status: SpammingTaskStatus.inProgress,
    });
    await repo.save(task);

    try {
      const templateMailgunName = (
        "auto-" + template.name.replaceAll(" ", "_")
      ).toLowerCase();

      const batchSize = 5;
      const toChunks = chunkArray(to, batchSize);
      const dataChunks = chunkArray(data, batchSize);

      for (let i = 0; i < toChunks.length; i++) {
        const currentTo = toChunks[i] || [];
        const currentData = dataChunks[i] || [];

        const recipientVariables: Record<string, Record<string, unknown>> = {};

        currentTo.forEach((email, index) => {
          recipientVariables[email] = currentData[index] || {};
        });

        if (currentTo.length === 0) continue;

        await this.mailgun.messages.create(GLOBAL.config.mailgunDomain, {
          to: currentTo,
          from: `${GLOBAL.config.mailgunEmailName} <mailer@${GLOBAL.config.mailgunDomain}>`,
          subject: template.subject,
          template: templateMailgunName,
          "recipient-variables": JSON.stringify(recipientVariables),
          "t:version": "initial",
          "h:X-Sended-By": "lyceum1mailerbot",
          "v:spammingTaskId": task.id,
        });

        if (i < toChunks.length - 1) {
          this.logger.info(`Waiting 60000ms before next batch...`);
          await delay(60000);
        }
      }

      task.status = SpammingTaskStatus.completed;
      await repo.save(task);

      this.logger.info("Spamming is started successfully for all batches");
    } catch (error) {
      const err = error as Error & { status: string; details: string };
      this.logger.error(
        `Mailgun Error: ${err.message} | Status: ${err.status} | Details: ${JSON.stringify(err.details || err)}`,
      );

      await repo
        .save(task)
        .catch((dbErr) =>
          this.logger.error("DB Update failed: " + dbErr.message),
        );

      throw new Error("Не вдалося розпочати розсилку");
    }
  }
}
