/** @format */

import type { Express, NextFunction, Request, Response } from "express";
import express, { Router } from "express";
import { GLOBAL } from "../../globals";
import { createLogger } from "../../logger";
import { randomUUIDv7 } from "bun";
import { MailgunWrapper } from "./MailgunWrapper";
import crypto from "crypto";
import type { EntityManager, QueryRunner } from "typeorm";
import {
  SpammingNodeSchema,
  SpammingNodeStatus,
} from "../../schemas/SpammingNode.schema";

type MyRequest = Request & { id: string; timestamp: Date } & {
  manager: EntityManager;
  qr: QueryRunner;
};

export class MailgunWebhookIntegration extends MailgunWrapper {
  private express: Express;
  private logger = createLogger("Mailgun Webhook Integration");

  private loggerMiddlewareStart = (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const myReq = req as MyRequest;
    const id = myReq.ip + "_" + randomUUIDv7("base64");

    myReq.id = id;
    myReq.timestamp = new Date();

    this.logger.info(
      `Webhook request from ${myReq.ip} onto ${myReq.originalUrl}`,
      { id },
    );
    next();
  };

  private loggerMiddlewareEnd = (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const myReq = req as MyRequest;
    if (myReq.timestamp) {
      const duration = Date.now() - myReq.timestamp.getTime();
      this.logger.info(
        `Webhook processed in ${duration}ms with status ${res.statusCode}`,
        { id: myReq.id },
      );
    }
    next();
  };

  private verifyMailgunSignature = (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const myReq = req as MyRequest;
    const { signature } = req.body;

    if (
      !signature ||
      !signature.timestamp ||
      !signature.token ||
      !signature.signature
    ) {
      this.logger.warn(
        `[${myReq.id}] Rejecting request: Missing Mailgun signature headers.`,
      );
      res.status(406).json({ error: "Invalid signature structure" });
      return;
    }

    const signingKey = GLOBAL.config.mailgunSigningKey;
    if (!signingKey) {
      this.logger.error(
        `[${myReq.id}] Mailgun Signing Key is not configured in GLOBAL.config`,
      );
      res.status(500).json({ error: "Server misconfiguration" });
      return;
    }

    // Хешуємо за схемою Mailgun: timestamp + token
    const value = signature.timestamp + signature.token;
    const hash = crypto
      .createHmac("sha256", signingKey)
      .update(value)
      .digest("hex");

    if (hash !== signature.signature) {
      this.logger.warn(
        `[${myReq.id}] Rejecting request: HMAC signature mismatch.`,
      );
      res.status(406).json({ error: "Signature verification failed" });
      return;
    }

    next();
  };

  private async openTransaction(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    const myReq = req as MyRequest;

    const qr = GLOBAL.datasource.createQueryRunner();
    await qr.startTransaction();

    this.logger.info(`Transaction is opened by ${myReq.id}`, { id: myReq.id });

    myReq.manager = qr.manager;
    myReq.qr = qr;

    next();
  }

  private async closeTransaction(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    const myReq = req as MyRequest;

    if (myReq.qr.isTransactionActive) {
      await myReq.qr.commitTransaction();
      await myReq.qr.release();

      this.logger.info(`Transaction is closed by ${myReq.id}`, {
        id: myReq.id,
      });
    }

    next();
  }

  private async closeTransactionWithError(
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    const myReq = req as MyRequest;

    if (myReq.qr.isTransactionActive) {
      await myReq.qr.rollbackTransaction();
      await myReq.qr.release();

      this.logger.warn(`Transaction is closed with error by ${myReq.id}`, {
        id: myReq.id,
      });
    }

    next(err);
  }

  constructor() {
    super();

    this.express = express();
    this.express.use(express.json());
    this.express.use(this.loggerMiddlewareStart);
    this.express.get("/ping", (req, res) => {
      res.json("Pong!");
    });

    const extractTaskId = (body: any): string | null => {
      const eventData = body["event-data"];
      if (!eventData) return null;

      if (
        eventData["user-variables"] &&
        eventData["user-variables"].spammingTaskId
      ) {
        return eventData["user-variables"].spammingTaskId;
      }

      if (eventData.spammingTaskId) return eventData.spammingTaskId;

      return null;
    };

    const webhooksRouter = Router();

    webhooksRouter.use(this.verifyMailgunSignature);
    webhooksRouter.use(this.openTransaction.bind(this));

    webhooksRouter.post("/temporary_fail", async (req, res, next) => {
      try {
        const myReq = req as MyRequest;
        const eventData = req.body["event-data"];

        const taskId = extractTaskId(req.body);
        if (!taskId) {
          this.logger.warn(
            `[${myReq.id}] Missing spammingTaskId in temporary_fail event`,
          );
          return res.status(200).send("OK");
        }

        const nodeRepository = myReq.manager.getRepository(SpammingNodeSchema);
        await nodeRepository.update(
          { spammingTaskId: taskId, email: eventData.recipient },
          { status: SpammingNodeStatus.failed },
        );

        res.status(200).send("OK");
        next();
      } catch (err) {
        next(err);
      }
    });

    webhooksRouter.post("/permanent_fail", async (req, res, next) => {
      try {
        const myReq = req as MyRequest;
        const eventData = req.body["event-data"];

        const taskId = extractTaskId(req.body);
        if (!taskId) {
          this.logger.warn(
            `[${myReq.id}] Missing spammingTaskId in permanent_fail event`,
          );
          return res.status(200).send("OK");
        }

        const nodeRepository = myReq.manager.getRepository(SpammingNodeSchema);
        await nodeRepository.update(
          { spammingTaskId: taskId, email: eventData.recipient },
          { status: SpammingNodeStatus.failed },
        );

        res.status(200).send("OK");
        next();
      } catch (err) {
        next(err);
      }
    });

    webhooksRouter.post("/delivered", async (req, res, next) => {
      try {
        const myReq = req as MyRequest;
        const eventData = req.body["event-data"];

        const taskId = extractTaskId(req.body);
        if (!taskId) {
          this.logger.warn(
            `[${myReq.id}] Missing spammingTaskId in delivered event`,
          );
          return res.status(200).send("OK");
        }

        const nodeRepository = myReq.manager.getRepository(SpammingNodeSchema);
        await nodeRepository.update(
          { spammingTaskId: taskId, email: eventData.recipient },
          { status: SpammingNodeStatus.successful },
        );

        res.status(200).send("OK");
        next();
      } catch (err) {
        next(err);
      }
    });

    webhooksRouter.use(this.closeTransaction.bind(this));
    webhooksRouter.use(this.closeTransactionWithError.bind(this));

    this.express.use("/webhooks", webhooksRouter);

    this.express.use(this.loggerMiddlewareEnd);

    this.express.listen(GLOBAL.config.webhookPort, () => {
      this.logger.info(
        `Webhooks are listening on port: ${GLOBAL.config.webhookPort}`,
      );
    });
  }

  public async init() {
    const webhooks = await this.mailgun.webhooks.list(
      GLOBAL.config.mailgunDomain,
      {},
    );

    const neededWebhooks = ["delivered", "temporary_fail", "permanent_fail"];

    for (let webhookId of neededWebhooks) {
      if (!webhooks[webhookId]) {
        this.logger.info(`Creating ${webhookId} webhook`);
        await this.mailgun.webhooks.create(
          GLOBAL.config.mailgunDomain,
          webhookId,
          GLOBAL.config.webhookBaseUrl + webhookId,
          false,
        );
      } else {
        if (
          !webhooks[webhookId].urls.includes(
            GLOBAL.config.webhookBaseUrl + webhookId,
          )
        ) {
          this.logger.info(`Updating ${webhookId} webhook`);
          await this.mailgun.webhooks.update(
            GLOBAL.config.mailgunDomain,
            webhookId,
            GLOBAL.config.webhookBaseUrl + webhookId,
          );
        }
      }
    }

    this.logger.info("Webhooks up to date");
  }
}
