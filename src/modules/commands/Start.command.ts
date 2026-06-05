/** @format */

import { BaseBotCommand, Command, type BotCommand } from "./BaseCommand";
import type { EntityManager } from "typeorm";
import type { UserSchema } from "../../schemas/User.schema";
import type { Context } from "../bots/MainBot";
import { MainMenu } from "../menus/MainMenu.menu";

@Command("start", "Starts a bot")
class StartCommand extends BaseBotCommand {
  override async execute(ctx: Context, manager: EntityManager): Promise<void> {
    const userSch = manager.getRepository<UserSchema>("user");

    const telegramUser = ctx.from;
    if (!telegramUser || telegramUser.is_bot) throw new Error("");

    const user = await userSch.findOne({
      where: { id: String(telegramUser.id) },
    });

    if (!user) {
      this.logger.info("New user redirecting to master code input");
      await ctx.conversation.enter("masterCode");
      return;
    }

    this.logger.info("User started a bot", { userId: user.id });

    await ctx.reply(
      `👋 <b>Радий вітати знову, ${user.username}!</b>\n\n` +
        "Система готова до роботи. Оберіть потрібну дію на панелі меню нижче, щоб розпочати налаштування або запуск розсилки: 👇",
      {
        parse_mode: "HTML",
        reply_markup: MainMenu,
      },
    );
  }
}
