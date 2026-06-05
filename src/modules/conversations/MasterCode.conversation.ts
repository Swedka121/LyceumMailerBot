/** @format */

import type { Conversation as GConversation } from "@grammyjs/conversations";
import type { EntityManager } from "typeorm";
import type { Context, CustomConversation } from "../bots/MainBot";
import { BaseBotConversation, Conversation } from "./BaseConversation";
import { GLOBAL } from "../../globals";
import { UserSchema } from "../../schemas/User.schema";

@Conversation("masterCode")
class MasterCodeConversation extends BaseBotConversation {
  override async execute(
    conversation: CustomConversation,
    ctx: Context,
    manager: EntityManager,
  ): Promise<void> {
    await ctx.reply(
      "👋 <b>Вітаємо у системі розсилки!</b>\n\n" +
        "Ви ще не зареєстровані у нашій базі даних. Для верифікації акаунту, будь ласка, <b>введіть майстер-пароль:</b>",
      { parse_mode: "HTML" },
    );
    const check = conversation.checkpoint();
    const msgCtx = await conversation.waitFor("msg:text");

    if (GLOBAL.config.adminCode !== msgCtx.msg.text) {
      this.logger.warn("Entered code is wrong", { userId: ctx.from?.id });
      await ctx.reply(
        "❌ <b>Невірний пароль!</b>\n\n" +
          "Будь ласка, перевірте правильність ключа та <b>спробуйте ще раз:</b>",
        { parse_mode: "HTML" },
      );
      await conversation.rewind(check);
    }

    const sch = manager.getRepository<UserSchema>("user");
    const user = new UserSchema();
    user.id = String(ctx.from!.id);
    user.username = ctx.from!.last_name ?? ctx.from!.first_name;

    await sch.save(user);

    await conversation.external(async (ctx) => {
      await ctx.reply(
        "🎉 <b>Авторизація успішна!</b>\n\n" +
          `Користувача <b>${user.username}</b> успішно додано до системи.\n` +
          "Тепер ви маєте повний доступ до функціоналу розсилок. \n" +
          "Введіть команду <code>/start</code> ще раз",
        { parse_mode: "HTML" },
      );
    });

    this.logger.info("New user added", { userId: user.id });
  }
}
