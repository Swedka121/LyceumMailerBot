/** @format */

import { z, type ZodObject } from "zod";
import type { $ZodLooseShape, $strip } from "zod/v4/core";
import { BaseEmailTemplate, EmailTemplate } from "./BaseEmailTemplate";
import type { ITable } from "../../utils/rewriteToTable";

@EmailTemplate("Exam Results")
class ExamResultsTemplate extends BaseEmailTemplate {
  public override descriptionOfColumns: ITable = {
    headers: ["Назва колонки", "Обов'язковий формат даних"],
    tableData: [
      ["Email", "Валідний Email (наприклад, student@gmail.com)"],
      ["FullName", "Текст (ПІБ студента повністю)"],
      ["MathScore", "Число від 0 і більше (Бал з математики)"],
      ["UkrainianScore", "Число від 0 і більше (Бал з української мови)"],
      ["EnglishScore", "Число від 0 і більше (Бал з англійської мови)"],
    ],
  };

  public override schema: ZodObject<$ZodLooseShape, $strip> = z.object({
    Email: z.email("Некоректний формат Email").trim(),
    FullName: z.string().min(1, "ПІБ обов'язкове для заповнення").trim(),
    // Валідуємо як числа або рядки, що конвертуються в числа >= 0
    MathScore: z.coerce
      .number()
      .min(0, "Бал з математики не може бути меншим за 0"),
    UkrainianScore: z.coerce
      .number()
      .min(0, "Бал з української не може бути меншим за 0"),
    EnglishScore: z.coerce
      .number()
      .min(0, "Бал з англійської не може бути меншим за 0"),
  });

  public mailgunTemplateText: string = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #2c3e50; border-bottom: 2px solid #2c3e50; padding-bottom: 10px; text-align: center;">📊 Результати вступних випробувань</h2>
      
      <p>Шановні батьки! Конкурсна комісія Ліцею №1 м. Житомира інформує Вас про результати вступних випробувань Вашої дитини.</p>
      
      <p>Роботи %recipient.FullName% успішно перевірені. Ознайомтеся, будь ласка, з отриманими балами з предметів:</p>
      
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 15px;">
        <thead>
          <tr style="background-color: #f2f4f4; border-bottom: 2px solid #bdc3c7;">
            <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Предмет</th>
            <th style="padding: 12px; border: 1px solid #ddd; text-align: center; width: 120px;">Бал</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">📐 Математика</td>
            <td style="padding: 12px; border: 1px solid #ddd; text-align: center; font-size: 16px; color: #2980b9; font-weight: bold;">%recipient.MathScore%</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">🇺🇦 Українська мова</td>
            <td style="padding: 12px; border: 1px solid #ddd; text-align: center; font-size: 16px; color: #27ae60; font-weight: bold;">%recipient.UkrainianScore%</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">🇬🇧 Англійська мова</td>
            <td style="padding: 12px; border: 1px solid #ddd; text-align: center; font-size: 16px; color: #8e44ad; font-weight: bold;">%recipient.EnglishScore%</td>
          </tr>
        </tbody>
      </table>
      
      <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
      
      <p style="font-size: 12px; color: #7f8c8d; text-align: center;">
        Цей лист сформовано автоматично. Конкурсна комісія Ліцею №1 м. Житомира
      </p>
    </div>
  `.trim();

  public subject: string = "Результати вступних випробувань";

  override formatToSend(data: unknown[]): {
    to: string[];
    data: Record<string, unknown>[];
  } {
    const dataUnk = data as z.infer<typeof this.schema>[];

    return {
      to: dataUnk.map((el) => el.Email as string),
      data: dataUnk.map((el) => ({
        FullName: el.FullName,
        MathScore: el.MathScore,
        UkrainianScore: el.UkrainianScore,
        EnglishScore: el.EnglishScore,
        Email: el.Email,
      })) as Record<string, unknown>[],
    };
  }
}
