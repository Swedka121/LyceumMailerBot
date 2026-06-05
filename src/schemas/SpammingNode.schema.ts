/** @format */

import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { SpammingTaskSchema } from "./SpammingTask.schema";

export enum SpammingNodeStatus {
  failed = "failed",
  successful = "successful",
}

@Entity("spamming_node")
export class SpammingNodeSchema {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => SpammingTaskSchema)
  @JoinColumn({ name: "spamming_task_id" })
  spammingTask!: SpammingTaskSchema;

  @Column({ name: "spamming_task_id" })
  spammingTaskId!: string;

  @Column()
  email!: string;

  @Column({
    type: "enum",
    enum: SpammingNodeStatus,
    enumName: "spamming_node_status",
  })
  status!: SpammingNodeStatus;

  @CreateDateColumn()
  createdAt!: Date;
}
