/** @format */

import z from "zod";
import { BaseTableLoader, TableLoader, type IAnalyse } from "./baseTableLoader";
import { GLOBAL } from "../../globals";
import fs from "fs";
import path from "path";
import os from "os";
import * as XLSX from "xlsx";

@TableLoader("excel")
export class ExcelTableLoader extends BaseTableLoader {
  private tempFilePath: string = "";
  public override instruction: string =
    "Відправте файл розширення .xlsx або .xls";

  protected override checkIfSourceStrIsValid(source: string): void {
    try {
      z.object({ source: z.string().trim().min(1) }).parse({ source });
    } catch (err) {
      throw new Error("❌ Очікується валідний ID файлу Excel");
    }
  }

  public override async hasAccess(source: string): Promise<void> {
    this.checkIfSourceStrIsValid(source);
  }

  public override async checkValidOfTable(source: string): Promise<void> {
    try {
      const response = await fetch(
        `https://api.telegram.org/file/bot${GLOBAL.config.botToken}/${source}`,
        { method: "GET" },
      );

      if (!response.ok)
        throw new Error("Не вдалося завантажити файл з Telegram");

      const tempDir = path.join(os.tmpdir(), "lyceumMailerBot");
      fs.mkdirSync(tempDir, { recursive: true });

      this.tempFilePath = path.join(tempDir, `${Date.now()}_data.xlsx`);

      const arrayBuffer = await response.arrayBuffer();
      fs.writeFileSync(this.tempFilePath, Buffer.from(arrayBuffer));

      const workbook = XLSX.readFile(this.tempFilePath);
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName)
        throw new Error("У цьому Excel файлі немає жодного листа.");

      const worksheet = workbook.Sheets[firstSheetName];

      const headers = XLSX.utils.sheet_to_json<string[]>(worksheet!, {
        header: 1,
      })[0];
      if (!headers || !Array.isArray(headers)) {
        throw new Error("Не вдалося прочитати заголовки таблиці.");
      }

      const expectedFields = Object.keys(
        (this.template.schema as z.ZodObject<any>).shape,
      );
      const missingFields = expectedFields.filter(
        (field) => !headers.includes(field),
      );

      if (missingFields.length > 0) {
        throw new Error(
          `❌ Структура таблиці не відповідає шаблону.\n` +
            `Відсутні обов'язкові колонки: <b>${missingFields.join(", ")}</b>`,
        );
      }
    } catch (err) {
      if (this.tempFilePath && fs.existsSync(this.tempFilePath)) {
        fs.unlinkSync(this.tempFilePath);
      }
      throw new Error(`❌ Помилка перевірки файлу: ${(err as Error).message}`);
    }
  }

  protected override async parseDataWithTemplate(): Promise<{
    analyse: IAnalyse;
    data: unknown[];
  }> {
    if (!this.tempFilePath || !fs.existsSync(this.tempFilePath)) {
      throw new Error("❌ Файл не знайдено або він не був завантажений");
    }

    try {
      const workbook = XLSX.readFile(this.tempFilePath);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName!];

      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        worksheet!,
        { defval: "" },
      );

      const validData: unknown[] = [];
      let invalidRowsCount = 0;

      const expectedFields = Object.keys(
        (this.template.schema as z.ZodObject<any>).shape,
      );

      rawRows.forEach((rawRow: Record<string, unknown>) => {
        const rowData: Record<string, unknown> = {};

        expectedFields.forEach((field) => {
          rowData[field] =
            rawRow[field] !== undefined ? String(rawRow[field]).trim() : "";
        });

        const result = this.template.schema.safeParse(rowData);

        if (result.success) {
          validData.push(result.data);
        } else {
          invalidRowsCount++;
        }
      });

      if (validData.length === 0) {
        throw new Error(
          "❌ Файл не містить жодного валідного рядка для розсилки.",
        );
      }

      return {
        analyse: {
          totalRows: rawRows.length,
          validRowsCount: validData.length,
          invalidRowsCount: invalidRowsCount,
        },
        data: validData,
      };
    } catch (err) {
      throw new Error(
        `❌ Не вдалося розпарсити Excel файл: ${(err as Error).message}`,
      );
    } finally {
      if (fs.existsSync(this.tempFilePath)) {
        fs.unlinkSync(this.tempFilePath);
      }
    }
  }
}
