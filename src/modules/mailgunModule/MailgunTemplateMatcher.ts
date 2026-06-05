/** @format */

import Mailgun from "mailgun.js";
import { GLOBAL } from "../../globals";
import { createLogger } from "../../logger";
import { MailgunWrapper } from "./MailgunWrapper";

export class MailgunTemplateMatcher extends MailgunWrapper {
  private logger = createLogger("Maingun Template Matcher");

  async init() {
    try {
      const domains = await this.mailgun.domains.list();

      const domainId = domains.find(
        (a) => a.name == GLOBAL.config.mailgunDomain,
      )?.id;

      if (!domainId) throw new Error("Cannot initializate mailgun");

      const templates =
        await this.mailgun.domains.domainTemplates.list(domainId);

      const botTemplates = GLOBAL.botManager.getTemplateNames();

      for (const tempName of botTemplates) {
        const template = GLOBAL.botManager.getTemplate(tempName);
        const templateMailgunName = (
          "auto-" + tempName.replaceAll(" ", "_")
        ).toLowerCase();

        const mailgunTempExists = templates.items.some(
          (a) => a.name == templateMailgunName,
        );

        if (!mailgunTempExists) {
          await this.mailgun.domains.domainTemplates.create(domainId, {
            name: templateMailgunName,
            template: template.mailgunTemplateText,
            description: "Created automaticlly with mailer bot",
            comment: "auto",
          });
          this.logger.info(`Posted new template ${tempName}`);
        } else {
          const version = await this.mailgun.domains.domainTemplates.getVersion(
            domainId,
            templateMailgunName,
            "initial",
          );

          if (!version.version) throw new Error("Mismatch");

          if (
            template.mailgunTemplateText.trim().replace(/\r?\n|\s/g, "") !=
            version.version.template.trim().replace(/\r?\n|\s/g, "")
          ) {
            await this.mailgun.domains.domainTemplates.updateVersion(
              domainId,
              templateMailgunName,
              "initial",
              { template: template.mailgunTemplateText },
            );
            this.logger.info(`Updated template ${tempName}`);
          }
        }
      }

      this.logger.info("All templates matched");
    } catch (err) {
      this.logger.error((err as Error).message);
      throw err;
    }
  }
}
