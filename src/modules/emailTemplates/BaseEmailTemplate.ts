/** @format */

import type z from "zod";
import { GLOBAL } from "../../globals";
import type { ITable } from "../../utils/rewriteToTable";

export abstract class BaseEmailTemplate {
  public name!: string;
  public abstract descriptionOfColumns: ITable;
  public abstract schema: z.ZodObject;
  public abstract mailgunTemplateText: string;
  public abstract subject: string;

  abstract formatToSend(data: unknown[]): {
    to: string[];
    data: Record<string, unknown>[];
  };
}

export function EmailTemplate(name: string) {
  return (target: new () => BaseEmailTemplate) => {
    target.prototype.name = name;

    const instance = new target();
    instance.name = name;

    GLOBAL.botManager.addEmailTemplate(name, instance);
  };
}
