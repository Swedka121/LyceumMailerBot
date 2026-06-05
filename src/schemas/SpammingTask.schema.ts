/** @format */

import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { UserSchema } from "./User.schema";

export enum SpammingTaskStatus {
  inProgress = "inProgress",
  completed = "completed",
}

@Entity("spamming_task")
export class SpammingTaskSchema {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "template_id" })
  templateId!: string;

  @Column({ name: "table_loader" })
  tableLoader!: string;

  @ManyToOne(() => UserSchema)
  @JoinColumn({ name: "user_id" })
  user!: UserSchema;

  @Column({ name: "user_id" })
  userId!: string;

  @Column("int")
  shouldBeDelivered!: number;

  @Column({
    type: "enum",
    enum: SpammingTaskStatus,
    enumName: "spamming_task_status",
  })
  status!: SpammingTaskStatus;

  @CreateDateColumn()
  createdAt!: Date;
}
