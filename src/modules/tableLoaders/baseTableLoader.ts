/** @format */

import type z from "zod";
import type { BaseEmailTemplate } from "../emailTemplates/BaseEmailTemplate";
import { GLOBAL } from "../../globals";

export interface IAnalyse {
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
}

export abstract class BaseTableLoader {
  protected readonly template: BaseEmailTemplate;
  public readonly instruction: string =
    "Надішліть файл або посилання до своєї таблиці";
  protected abstract checkIfSourceStrIsValid(source: string): void; //check if this is url or smth else
  protected async hasAccess(source: string): Promise<void> {} // only for google sheets
  protected abstract checkValidOfTable(source: string): Promise<void>; // Here we are loading and validate table format
  protected abstract parseDataWithTemplate(): Promise<{
    analyse: IAnalyse;
    data: unknown[];
  }>; // data it is only successfully parsed data

  public async flow(source: string) {
    this.checkIfSourceStrIsValid(source);
    await this.checkValidOfTable(source);
    return await this.parseDataWithTemplate();
  }

  constructor(template: BaseEmailTemplate) {
    this.template = template;
  }
}

export function TableLoader(name: string) {
  return (
    target: new (template: BaseEmailTemplate) => BaseTableLoader,
    ...args: unknown[]
  ) => {
    GLOBAL.botManager.addTableLoader(name, target);
  };
}
