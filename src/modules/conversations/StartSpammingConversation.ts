/** @format */

import type { EntityManager } from "typeorm";
import type { CustomConversation, Context } from "../bots/MainBot";
import { BaseBotConversation, Conversation } from "./BaseConversation";
import { GLOBAL } from "../../globals";
import { rewriteToTable } from "../../utils/rewriteToTable";

@Conversation("startSpamming")
class startSpammingConversation extends BaseBotConversation {
  override async execute(
    conversation: CustomConversation,
    ctx: Context,
    manager: EntityManager,
  ): Promise<void> {
    const session = await conversation.external((ctx) => ctx.session);
    const authorId = await conversation.external((ctx) => ctx.from?.id);
    if (
      !session ||
      !session.idOfTemplate ||
      !session.typeOfLoadedTable ||
      !authorId
    )
      throw new Error();

    const template = GLOBAL.botManager.getTemplate(session.idOfTemplate!);
    const loaderConst = GLOBAL.botManager.getTableLoader(
      session.typeOfLoadedTable,
    );

    const loader = new loaderConst(template);

    this.logger.info(
      `User prepared to start conversation with params: ${session.idOfTemplate}, ${session.typeOfLoadedTable}`,
      { user: ctx.from?.id },
    );

    await ctx.reply(
      `⚙️ <b>НАЛАШТУВАННЯ РОЗСИЛКИ</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📊 <b>Параметри конфігурації:</b>\n` +
        `• Джерело даних: <code>${session.typeOfLoadedTable || "Не обрано"}</code>\n` +
        `• ID Шаблону: <code>${session.idOfTemplate || "Не обрано"}</code>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `${loader.instruction}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📋 <b>Специфікація колонок шаблону:</b>\n` +
        `<i>Переконайся, що структура файлу відповідає цим вимогам:</i>\n\n` +
        rewriteToTable(template.descriptionOfColumns),
      { parse_mode: "HTML" },
    );

    await ctx.reply("Очікую на посилання або файл");

    const check1 = conversation.checkpoint();

    let url: string;

    if (session.typeOfLoadedTable == "google") {
      const inputCtx = await conversation.waitFor("message:text");
      url = inputCtx.msg.text;
    } else {
      const inputCtx = await conversation.waitFor("message:document");

      const file = await inputCtx.getFile();
      if (!file.file_path) {
        throw new Error(
          "❌ Не вдалося отримати шлях до файлу з серверів Telegram. Спробуйте ще раз.",
        );
      }
      url = file.file_path;
    }

    this.logger.info(`User sends source to bot: ${url}`, {
      user: ctx.from?.id,
    });

    let analyse;

    try {
      analyse = await loader.flow(url);
    } catch (err) {
      this.logger.error(
        `Table analysed with errors: ${(err as Error).message}`,
        { user: ctx.from?.id },
      );
      await ctx.reply(`Помилка: ${(err as Error).message}`);

      await conversation.rewind(check1);
      return;
    }

    this.logger.info(
      `Table analysed sucessful total: ${analyse.analyse.totalRows} success: ${analyse.analyse.validRowsCount} error: ${analyse.analyse.invalidRowsCount}`,
      { user: ctx.from?.id },
    );

    await ctx.reply(
      `📊 <b>РЕЗУЛЬТАТИ АНАЛІЗУ ТАБЛИЦІ</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `✅ Таблиця успішно оброблена та перевірена.\n\n` +
        `📈 <b>Статистика рядків:</b>\n` +
        `• Всього знайдено: <code>${analyse.analyse.totalRows}</code>\n` +
        `• Готові до відправки: <code>${analyse.analyse.validRowsCount}</code> ✨\n` +
        `• Містять помилки: <code>${analyse.analyse.invalidRowsCount}</code> ⚠️\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━`,
      { parse_mode: "HTML" },
    );

    const prepare = template.formatToSend(analyse.data);
    await GLOBAL.sender.send(
      prepare.to,
      prepare.data,
      template,
      session.typeOfLoadedTable,
      authorId.toString(),
    );

    await ctx.reply(`✅ РОЗСИЛКА УСПІШНО ВІДПРАВЛЕНА В СЕРВІС`, {
      parse_mode: "HTML",
    });
  }
}
