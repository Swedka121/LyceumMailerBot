/** @format */

import type { Bot } from "grammy";
import { MainBot, type Context } from "./modules/bots/MainBot";
import { Config } from "./configValidator";
import { initDatasource } from "./dataSource";
import type { DataSource } from "typeorm";
import { MailgunTemplateMatcher } from "./modules/mailgunModule/MailgunTemplateMatcher";
import { MailgunTemplateSender } from "./modules/mailgunModule/MailgunSender";
import { MailgunWebhookIntegration } from "./modules/mailgunModule/MailgunWebhookIntegration";

class Global {
  public config: Config = new Config();
  public bot!: Bot<Context>;
  public botManager!: MainBot;
  public datasource!: DataSource;
  public mailgunTemplateMatcher!: MailgunTemplateMatcher;
  public sender!: MailgunTemplateSender;
  public mailgunWebhooks!: MailgunWebhookIntegration;
  constructor() {}
  async init() {
    this.datasource = await initDatasource();
    const bot = new MainBot();

    this.bot = bot.asObject.bot;
    this.botManager = bot;

    this.sender = new MailgunTemplateSender();

    await bot.start();

    this.mailgunTemplateMatcher = new MailgunTemplateMatcher();
    await this.mailgunTemplateMatcher.init();

    this.mailgunWebhooks = new MailgunWebhookIntegration();
    await this.mailgunWebhooks.init();
  }
}

export const GLOBAL = new Global();
await GLOBAL.init();
