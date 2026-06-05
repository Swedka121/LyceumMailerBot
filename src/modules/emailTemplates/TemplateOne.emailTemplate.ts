/** @format */

import { z, type ZodObject } from "zod";
import type { $ZodLooseShape, $strip } from "zod/v4/core";
import { BaseEmailTemplate, EmailTemplate } from "./BaseEmailTemplate";
import type { ITable } from "../../utils/rewriteToTable";

@EmailTemplate("Test template")
class Template extends BaseEmailTemplate {
  public override descriptionOfColumns: ITable = {
    headers: ["Назва колонки", "Обов'язковий формат даних"],
    tableData: [
      ["Email", "Валідний Email (наприклад, user@gmail.com)"],
      ["FirstName", "Текст (Ім'я отримувача)"],
      ["LastName", "Текст (Прізвище отримувача)"],
      ["ContractNumber", "Текст або число (Номер договору, наприклад: 123/A)"],
      ["SigningDate", "Текст у форматі ДД.ММ.РРРР (Дата підписання)"],
    ],
  };

  public override schema: ZodObject<$ZodLooseShape, $strip> = z.object({
    Email: z.email("Некоректний формат Email").trim(),
    FirstName: z.string().min(1, "Ім'я обов'язкове для заповнення").trim(),
    LastName: z.string().min(1, "Прізвище обов'язкове для заповнення").trim(),
    ContractNumber: z.string().min(1, "Номер договору обов'язковий").trim(),
    SigningDate: z.string().min(1, "Дата підписання обов'язкова").trim(),
  });

  public mailgunTemplateText: string = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #1a73e8; border-bottom: 2px solid #1a73e8; padding-bottom: 10px;">Тестове сповіщення</h2>
      
      <p>Вітаємо, <strong>%recipient.FirstName% %recipient.LastName%</strong>!</p>
      
      <p>Це інформаційне повідомлення щодо вашого договору. Будь ласка, ознайомтеся з деталями нижче:</p>
      
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background-color: #f8f9fa;">
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Параметр</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Значення</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Номер договору</td>
            <td style="padding: 10px; border: 1px solid #ddd;">%recipient.ContractNumber%</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Дата підписання</td>
            <td style="padding: 10px; border: 1px solid #ddd;">%recipient.SigningDate%</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Email для зв'язку</td>
            <td style="padding: 10px; border: 1px solid #ddd;">%recipient.Email%</td>
          </tr>
        </tbody>
      </table>
      
      <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
      
      <p style="font-size: 12px; color: #666; text-align: center;">
        Лист згенеровано автоматично для системи тестування. Якщо ви отримали його помилково, просто проігноруйте.
      </p>
    </div>
  `.trim();

  public subject: string = "Тест";

  override formatToSend(data: unknown[]): {
    to: string[];
    data: Record<string, unknown>[];
  } {
    const dataUnk = data as z.infer<typeof this.schema>[];

    return {
      to: dataUnk.map((el) => el.Email as string),
      data: dataUnk.map((el) => ({
        FirstName: el.FirstName,
        LastName: el.LastName,
        ContractNumber: el.ContractNumber,
        SigningDate: el.SigningDate,
        Email: el.Email,
      })) as Record<string, unknown>[],
    };
  }
}
