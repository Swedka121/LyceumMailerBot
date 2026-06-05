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

export class MailgunTemplateSender extends MailgunWrapper {
  private logger = createLogger("Mailgun Sender");

  async send(
    to: string[],
    data: Record<string, unknown>[],
    template: BaseEmailTemplate,
    tableLoader: string,
    author: string,
  ) {
    try {
      const templateMailgunName = (
        "auto-" + template.name.replaceAll(" ", "_")
      ).toLowerCase();

      const recipientVariables: Record<string, Record<string, unknown>> = {};

      to.forEach((email, index) => {
        recipientVariables[email] = data[index] || {};
      });

      const repo = GLOBAL.datasource.getRepository(SpammingTaskSchema);

      const task = repo.create({
        shouldBeDelivered: to.length,
        tableLoader: tableLoader,
        userId: author,
        templateId: template.name,
        status: SpammingTaskStatus.inProgress,
      });

      await repo.save(task);

      await this.mailgun.messages.create(GLOBAL.config.mailgunDomain, {
        to,
        from: `${GLOBAL.config.mailgunEmailName} <mailer@${GLOBAL.config.mailgunDomain}>`,
        subject: template.subject,
        template: templateMailgunName,
        "recipient-variables": JSON.stringify(recipientVariables),
        "t:version": "initial",
        "h:X-Sended-By": "lyceum1mailerbot",
        "v:spammingTaskId": task.id,
      });
      this.logger.info("Spamming is started");
    } catch (err) {
      this.logger.error((err as Error).message);
      throw new Error("Не вдалося розпочати розсилку");
    }
  }
}
