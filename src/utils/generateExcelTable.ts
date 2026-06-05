/** @format */

import {
  SpammingNodeStatus,
  type SpammingNodeSchema,
} from "../schemas/SpammingNode.schema";
import ExcelJs from "exceljs";
import { format } from "date-fns";

export async function generateExcelTable(nodes: SpammingNodeSchema[]) {
  const workbook = new ExcelJs.Workbook();

  // Збільшено ширину колонок, щоб дані не обрізалися
  const baseHeaders: Partial<ExcelJs.Column>[] = [
    { header: "Емеїл", width: 35, key: "email" },
    { header: "Дата", width: 35, key: "createdAt" },
    { header: "Статус", width: 20, key: "status" },
  ];

  // Створюємо листи та правильно присвоюємо їм колонки
  const allSheet = workbook.addWorksheet("Всі");
  allSheet.columns = baseHeaders;

  const successSheet = workbook.addWorksheet("Успішні");
  successSheet.columns = baseHeaders;

  const errorSheet = workbook.addWorksheet("З помилкою");
  errorSheet.columns = baseHeaders;

  // Стилі для комірок
  const successFill: ExcelJs.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2EFDA" },
  };
  const successFont: Partial<ExcelJs.Font> = {
    color: { argb: "FF375623" },
    bold: true,
  };

  const errorFill: ExcelJs.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFCE4D6" },
  };
  const errorFont: Partial<ExcelJs.Font> = {
    color: { argb: "FFC65911" },
    bold: true,
  };

  // Допоміжна функція для безпечного додавання та фарбування рядка (тільки заповнених комірок)
  const addStyledRow = (
    sheet: ExcelJs.Worksheet,
    data: any,
    isSuccess: boolean,
  ) => {
    const row = sheet.addRow(data);
    for (let i = 1; i <= baseHeaders.length; i++) {
      const cell = row.getCell(i);
      cell.fill = isSuccess ? successFill : errorFill;
      cell.font = isSuccess ? successFont : errorFont;
      cell.alignment = { vertical: "middle", horizontal: "left" };
    }
  };

  nodes.forEach((el) => {
    const isSuccess = el.status === SpammingNodeStatus.successful;

    const rowData = {
      email: el.email,
      createdAt: format(
        el.createdAt instanceof Date ? el.createdAt : new Date(el.createdAt),
        "yyyy MM dd HH:mm:ss",
      ),
      status: isSuccess ? "🟢 Успішно" : "🔴 Помилка",
    };

    addStyledRow(allSheet, rowData, isSuccess);

    if (isSuccess) {
      addStyledRow(successSheet, rowData, true);
    } else {
      addStyledRow(errorSheet, rowData, false);
    }
  });

  const styleHeader = (sheet: ExcelJs.Worksheet) => {
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, size: 12 };
    headerRow.height = 25;
    headerRow.eachCell((cell) => {
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9D9D9" },
      };
    });
  };

  styleHeader(allSheet);
  styleHeader(successSheet);
  styleHeader(errorSheet);

  const buffer = await workbook.xlsx.writeBuffer({
    filename: "report.xlsx",
    useStyles: true,
  });
  return buffer;
}
