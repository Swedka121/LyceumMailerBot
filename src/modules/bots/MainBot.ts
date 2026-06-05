/** @format */

import { Bot, Context as GContext, session, type SessionFlavor } from "grammy";
import { GLOBAL } from "../../globals";
import type { BotCommand } from "../commands/BaseCommand";
import { Glob, pathToFileURL } from "bun";
import path from "path";
import {
  Conversation,
  conversations,
  createConversation,
  type ConversationFlavor,
} from "@grammyjs/conversations";
import type { BotConversation } from "../conversations/BaseConversation";
import { createLogger } from "../../logger";
import type { BaseEmailTemplate } from "../emailTemplates/BaseEmailTemplate";
import type { BaseTableLoader } from "../tableLoaders/baseTableLoader";

interface ISession {
  typeOfLoadedTable?: "google" | "excel" | "csv";
  idOfTemplate?: string;
  showMenuAfterAuth?: boolean;
}

type BaseContext = GContext & SessionFlavor<ISession>;
export type Context = BaseContext & ConversationFlavor<BaseContext>;
export type CustomConversation = Conversation<Context, Context>;

const logger = createLogger("MainBot");

export class MainBot {
  public telegraf: Bot<Context>;

  private commands: BotCommand[] = [];
  private conversation: BotConversation[] = [];
  private templates: Map<string, BaseEmailTemplate> = new Map();
  private tableLoaders: Map<
    string,
    new (template: BaseEmailTemplate) => BaseTableLoader
  > = new Map();

  constructor() {
    this.telegraf = new Bot<Context>(GLOBAL.config.botToken);
  }

  private async loadSomethingFromFolder(folder: string) {
    const conversationsDir = path.join(
      process.cwd(),
      `/src/modules/${folder}s`,
    );
    const glob = new Glob(`!(*).${folder}.{ts,js}`);
    const conversationFiles = glob.scanSync({ cwd: conversationsDir });

    for (const fileName of conversationFiles) {
      const absolutePath = path.resolve(conversationsDir, fileName);
      logger.info(`📦 Auto-loading ${folder} file: ${fileName}`);

      const fileUrl = pathToFileURL(absolutePath).href;

      await import(fileUrl);
    }
  }

  private async loadCommandsFromFolder() {
    await this.loadSomethingFromFolder("command");
  }

  private async loadConversationsFromFolder() {
    await this.loadSomethingFromFolder("conversation");
  }

  private async loadEmailTemplatesFromFolder() {
    await this.loadSomethingFromFolder("emailTemplate");
  }

  private async loadTableLoadersFromFolder() {
    await this.loadSomethingFromFolder("tableLoader");
  }

  public async start() {
    await this.loadConversationsFromFolder();
    await this.loadCommandsFromFolder();
    await this.loadEmailTemplatesFromFolder();
    await this.loadTableLoadersFromFolder();

    this.telegraf.use(
      session({
        initial: (): ISession => ({}),
      }),
    );

    this.telegraf.use(conversations());

    this.conversation.forEach((cv) => {
      logger.info(`📡 Registering conversation: ${cv.name}`);
      this.telegraf.use(createConversation(cv.execute, { id: cv.name }));
    });

    const { MainMenu } = await import("../menus/MainMenu.menu");
    this.telegraf.use(MainMenu);

    this.telegraf.use(async (ctx, next) => {
      if (ctx.session?.showMenuAfterAuth) {
        ctx.session.showMenuAfterAuth = false;
        await ctx.reply("Оберіть дію на панелі управління нижче: 👇", {
          reply_markup: MainMenu,
        });
        return;
      }
      await next();
    });

    for (let template of this.templates.keys()) {
      logger.info(`📡 Registering email template: ${template}`);
    }

    for (let loader of this.tableLoaders.keys()) {
      logger.info(`📡 Registering table loaders: ${loader}`);
    }

    this.commands.forEach((cm) => {
      logger.info(`📡 Registering listener: /${cm.name}`);
      this.telegraf.command(cm.name, cm.execute);
    });

    await this.telegraf.api.setMyCommands(
      this.commands.map((cm) => ({
        command: cm.name,
        description: cm.description,
      })),
    );

    this.telegraf.start();

    logger.info("------------ BOT LAUNCHED ------------");
  }
  public addCommand(command: BotCommand) {
    this.commands.push(command);
  }

  public addConversation(conversation: BotConversation) {
    this.conversation.push(conversation);
  }

  public addEmailTemplate(templateId: string, template: BaseEmailTemplate) {
    this.templates.set(templateId, template);
  }

  public addTableLoader(
    name: string,
    loaderConstructor: new (template: BaseEmailTemplate) => BaseTableLoader,
  ) {
    this.tableLoaders.set(name, loaderConstructor);
  }

  public getTemplate(templateId: string) {
    const template = this.templates.get(templateId);
    if (!template) throw new Error("This template is undefined!");
    return template;
  }

  public getTableLoader(name: string) {
    const loader = this.tableLoaders.get(name);
    if (!loader) throw new Error("This loader is undefined!");
    return loader;
  }

  getTemplateNames() {
    return Array.from(this.templates.keys());
  }

  get asObject() {
    return { bot: this.telegraf };
  }
}
