/** @format */

export interface ITable {
  headers: string[];
  tableData: unknown[][];
}

export function rewriteToTable({ headers, tableData }: ITable) {
  let finalString = "";

  tableData.forEach((row) => {
    row.forEach((cellValue, index) => {
      const headerName = headers[index] || `Колонка ${index + 1}`;

      const displayValue =
        cellValue !== undefined && cellValue !== null
          ? String(cellValue)
          : "None";

      if (index === 0) {
        finalString += `📌 <b>${headerName}:</b> <code>${displayValue}</code>\n`;
      } else {
        finalString += `🔹 <b>${headerName}:</b> ${displayValue}\n`;
      }
    });

    finalString += "\n";
  });

  return finalString;
}
