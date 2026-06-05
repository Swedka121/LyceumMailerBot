/** @format */

import { InlineKeyboard, InputFile } from "grammy";
import type { EntityManager } from "typeorm";
import { BaseBotConversation, Conversation } from "./BaseConversation";
import type { Context, CustomConversation } from "../bots/MainBot";
import { SpammingTaskSchema } from "../../schemas/SpammingTask.schema";
import { generateExcelTable } from "../../utils/generateExcelTable";
import { GLOBAL } from "../../globals";
import { SpammingNodeSchema } from "../../schemas/SpammingNode.schema";
import { ReadStream } from "typeorm/platform/PlatformTools.js";

const ITEMS_PER_PAGE = 4;

@Conversation("mailing_history")
export class MailingHistoryConversation extends BaseBotConversation {
  async execute(
    conversation: CustomConversation,
    ctx: Context,
    manager: EntityManager,
  ): Promise<void> {
    let currentPage = 1;
    let isNavigating = true;

    let messageInfo = await ctx.reply("⏳ Завантажую історію розсилок...", {
      reply_markup: new InlineKeyboard().text("❌ Закрити", "close_history"),
    });

    while (isNavigating) {
      const skip = (currentPage - 1) * ITEMS_PER_PAGE;

      const [tasks, totalCount] = await manager
        .getRepository(SpammingTaskSchema)
        .findAndCount({
          order: { createdAt: "DESC" },
          skip: skip,
          take: ITEMS_PER_PAGE,
        });

      const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE) || 1;

      let text = `<b>📋 Історія ваших розсилок (Сторінка ${currentPage}/${totalPages})</b>\n\n`;

      if (tasks.length === 0) {
        text += "<i>Ви ще не запускали жодної розсилки.</i>";
      } else {
        tasks.forEach((task, index) => {
          const statusIcon = task.status === "completed" ? "🟢" : "⏳";
          text += `${skip + index + 1}. ${statusIcon} Шаблон: <code>${task.templateId}</code>\n`;
          text += `   ↳ Надіслано: <b>${task.shouldBeDelivered}</b> | Дано: ${task.createdAt.toLocaleDateString("uk-UA")}\n\n`;
        });
      }

      const keyboard = new InlineKeyboard();

      if (currentPage > 1) {
        keyboard.text("⬅️ Назад", "nav_prev");
      } else {
        keyboard.text("❌", "noop");
      }

      keyboard.text(`${currentPage} / ${totalPages}`, "noop");

      if (currentPage < totalPages) {
        keyboard.text("Вперед ➡️", "nav_next");
      } else {
        keyboard.text("❌", "noop");
      }

      if (tasks.length > 0) {
        keyboard.row();
        tasks.forEach((task, idx) => {
          if (task.status === "completed") {
            keyboard.text(
              `📥 Звіт №${skip + idx + 1}`,
              `download_report:${task.id}`,
            );
          }
        });
      }

      keyboard.row().text("🛑 Закрити меню", "close_history");

      try {
        await ctx.api.editMessageText(
          ctx.chat!.id,
          messageInfo.message_id,
          text,
          {
            parse_mode: "HTML",
            reply_markup: keyboard,
          },
        );
      } catch (err) {
        // Ігноруємо помилку Telegram, якщо контент не змінився при повторному кліку
      }

      const callbackContext = await conversation.waitFor("callback_query:data");
      const action = callbackContext.callbackQuery.data;

      await callbackContext.answerCallbackQuery();

      if (action === "nav_next" && currentPage < totalPages) {
        currentPage++;
      } else if (action === "nav_prev" && currentPage > 1) {
        currentPage--;
      } else if (action === "close_history") {
        isNavigating = false;
        await ctx.api
          .deleteMessage(ctx.chat!.id, messageInfo.message_id)
          .catch(() => {});
      } else if (action.startsWith("download_report:")) {
        const taskId = action.split(":")[1];

        isNavigating = false;
        await ctx.api
          .deleteMessage(ctx.chat!.id, messageInfo.message_id)
          .catch(() => {});

        await ctx.reply(
          `📊 Запит на звіт прийнято. Формую файл для таски <code>${taskId!.slice(0, 8)}</code>...`,
          { parse_mode: "HTML" },
        );

        const nodes = await GLOBAL.datasource
          .getRepository(SpammingNodeSchema)
          .find({ where: { spammingTaskId: taskId } });

        const readStr = ReadStream.from([await generateExcelTable(nodes)]);

        await ctx.replyWithDocument(new InputFile(readStr, "report.xlsx"));
      }
    }
  }
}
