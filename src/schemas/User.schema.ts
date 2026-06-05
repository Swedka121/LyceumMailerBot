/** @format */

import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("user")
export class UserSchema {
  @PrimaryColumn()
  id!: string;

  @Column()
  username!: string;
}
