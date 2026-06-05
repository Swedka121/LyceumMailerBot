/** @format */

import z from "zod";
import { BaseTableLoader, TableLoader, type IAnalyse } from "./baseTableLoader";
import { GLOBAL } from "../../globals";
import type { BaseEmailTemplate } from "../emailTemplates/BaseEmailTemplate";
import { GoogleSpreadsheet, GoogleSpreadsheetRow } from "google-spreadsheet";
import { JWT } from "google-auth-library";

@TableLoader("google")
class GoogleSheetsTableLoader extends BaseTableLoader {
  private googleSheetsClient?: GoogleSpreadsheet;
  private auth: JWT;
  private cachedRows: GoogleSpreadsheetRow[] = [];

  constructor(template: BaseEmailTemplate) {
    super(template);

    this.auth = new JWT({
      email: GLOBAL.config.googleServiceAccountKey.client_email as string,
      key: GLOBAL.config.googleServiceAccountKey.private_key as string,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  }
  public override instruction: string =
    `<i>Як підготувати Google Таблицю для розсилки через бота</i>\n\n` +
    `───────────────────\n\n` +
    `📋 <b>Крок 1. Налаштування колонок</b>\n` +
    `Переконайся, що <u>найперший рядок</u> містить точні назви колонок як наведено нижче у описі шаблону\n` +
    `⚠️ <b>Важливо:</b> Назви колонок мають бути строго у першому рядку.\n\n` +
    `───────────────────\n\n` +
    `🔑 <b>Крок 2. Надання доступу боту</b>\n` +
    `1. Скопіюй технічний email бота:\n` +
    `<code>${GLOBAL.config.googleServiceAccountKey.client_email}</code>\n\n` +
    `2. У Google Таблиці натисни кнопку <b>"Поділитися" (Share)</b>.\n` +
    `3. Встав скопійовану пошту бота, обери роль <b>"Переглядач"</b> та натисни <b>"Надіслати"</b>.\n\n` +
    `───────────────────\n\n` +
    `🚀 <b>Крок 3. Запуск розсилки</b>\n` +
    `1. Скопіюй посилання на таблицю з браузера.\n` +
    `2. У боті натисни <b>"🚀 Запустити розсилку"</b> ➡️ <b>"🌐 Google Sheets"</b>.\n` +
    `3. Надішли посилання в чат.\n\n` +
    `🎉 <b>Готово!</b> Бот автоматично перевірить файл та почне відправку.`;

  private extractSpreadsheetId(url: string): string {
    const matches = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!matches || !matches[1]) {
      throw new Error(
        "❌ Некоректне посилання на Google Таблицю. Перевірте URL-адресу.",
      );
    }
    return matches[1];
  }

  protected override checkIfSourceStrIsValid(source: string): void {
    try {
      z.object({ source: z.url().trim() }).parse({ source });
    } catch (err) {
      throw new Error("❌ Очікується посилання на гугл таблицю");
    }
  }

  // Змінюємо на public, щоб викликати з Conversation
  protected override async hasAccess(source: string): Promise<void> {
    try {
      this.checkIfSourceStrIsValid(source);
      const spreadsheetId = this.extractSpreadsheetId(source);

      this.googleSheetsClient = new GoogleSpreadsheet(spreadsheetId, this.auth);
      await this.googleSheetsClient.loadInfo();
    } catch {
      throw new Error(
        "⚠️ Немає доступу до таблиці. Перевірте, чи відкрили ви доступ для Email бота.",
      );
    }
  }

  // Змінюємо на public для зовнішнього виклику
  protected override async checkValidOfTable(source: string): Promise<void> {
    if (!this.googleSheetsClient) {
      await this.hasAccess(source);
    }

    const sheet = this.googleSheetsClient!.sheetsByIndex[0];
    if (!sheet) throw new Error("❌ У цій Google Таблиці немає жодного листа.");

    await sheet.loadHeaderRow();
    const tableHeaders = sheet.headerValues;

    const expectedFields = Object.keys(this.template.schema.shape);

    const missingFields = expectedFields.filter(
      (field) => !tableHeaders.includes(field),
    );
    if (missingFields.length > 0) {
      throw new Error(
        `❌ Структура таблиці не відповідає шаблону.\n` +
          `Відсутні обов'язкові колонки: <b>${missingFields.join(", ")}</b>`,
      );
    }

    this.cachedRows = await sheet.getRows();
  }

  protected override async parseDataWithTemplate(): Promise<{
    analyse: IAnalyse;
    data: unknown[];
  }> {
    const validData: unknown[] = [];
    let invalidRowsCount = 0;

    this.cachedRows.forEach((row) => {
      const rowData = row.toObject();

      const result = this.template.schema.safeParse(rowData);

      if (result.success) {
        validData.push(result.data);
      } else {
        invalidRowsCount++;
      }
    });

    if (validData.length == 0)
      throw new Error("❌ Таблиця не має валідних даних для розсилки");

    return {
      analyse: {
        totalRows: this.cachedRows.length,
        validRowsCount: validData.length,
        invalidRowsCount: invalidRowsCount,
      },
      data: validData,
    };
  }
}
