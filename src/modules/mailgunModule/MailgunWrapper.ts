/** @format */

import Mailgun from "mailgun.js";
import { GLOBAL } from "../../globals";

export class MailgunWrapper {
  protected mailgun;
  constructor() {
    this.mailgun = new Mailgun(FormData).client({
      key: GLOBAL.config.mailgunApiKey,
      username: "api",
    });
  }
}
