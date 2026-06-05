/** @format */

import { Menu, MenuRange } from "@grammyjs/menu";
import type { Context } from "../bots/MainBot";
import { GLOBAL } from "../../globals";

// 🌐 1. МЕНЮ: Вибір типу таблиці
export const SelectTableTypeMenu = new Menu<Context>("select_table_type")
  .text("🌐 Google Sheets", async (ctx) => {
    await ctx.editMessageText(
      "📥 <b>Вибір шаблону</b>\n\n" + "Будь ласка, оберіть шаблон",
      { parse_mode: "HTML" },
    );
    ctx.session = { ...ctx.session, typeOfLoadedTable: "google" };
    ctx.menu.nav("select_template");
    await ctx.answerCallbackQuery();
  })
  .row()
  .text("📊 Excel (.xlsx)", async (ctx) => {
    await ctx.editMessageText(
      "📥 <b>Вибір шаблону</b>\n\n" + "Будь ласка, оберіть шаблон",
      { parse_mode: "HTML" },
    );
    ctx.session = { ...ctx.session, typeOfLoadedTable: "excel" };
    ctx.menu.nav("select_template");
    await ctx.answerCallbackQuery();
  })
  // .text("📄 CSV", async (ctx) => {
  //   await ctx.editMessageText(
  //     "📥 <b>Вибір шаблону</b>\n\n" + "Будь ласка, оберіть шаблон",
  //     { parse_mode: "HTML" },
  //   );
  //   ctx.session = { ...ctx.session, typeOfLoadedTable: "csv" };
  //   ctx.menu.nav("select_template");
  //   await ctx.answerCallbackQuery();
  // })
  .row()
  .text("⬅️ Назад в меню", async (ctx) => {
    await ctx.deleteMessage();
    await ctx.answerCallbackQuery();
  });

export const SelectTemplateMenu = new Menu<Context>("select_template")
  .text("⬅️ Скасувати", async (ctx) => {
    await ctx.deleteMessage();
    await ctx.answerCallbackQuery();
  })
  .row();

SelectTemplateMenu.dynamic((ctx, range) => {
  const templateNames = (() => {
    return GLOBAL.botManager.getTemplateNames();
  })();
  templateNames.forEach((name) => {
    range
      .text(`📜 ${name}`, async (ctx) => {
        await ctx.deleteMessage();
        await ctx.answerCallbackQuery();
        ctx.session = { ...ctx.session, idOfTemplate: name };

        await ctx.conversation.enter("startSpamming");
      })
      .row();
  });
});

SelectTableTypeMenu.register(SelectTemplateMenu);

// 👑 3. ГОЛОВНЕ МЕНЮ: Головна панель управління
export const MainMenu = new Menu<Context>("main")
  .text("🚀 Запустити розсилку", async (ctx) => {
    await ctx.reply(
      "📂 <b>Крок 1/2: Вибір джерела даних</b>\n\n" +
        "Оберіть формат таблиці, з якої бот зчитуватиме контакти отримувачів. " +
        "Ви можете надіслати файл або підключити хмару:",
      {
        parse_mode: "HTML",
        reply_markup: SelectTableTypeMenu,
      },
    );
    await ctx.answerCallbackQuery();
  })
  .row()
  .text("📊 Історія розсилок", async (ctx) => {
    await ctx.conversation.enter("mailing_history");
    await ctx.answerCallbackQuery();
  });
MainMenu.register(SelectTableTypeMenu);
