import { IsEmail, IsString, IsUUID, MaxLength } from 'class-validator';

export class LoginDto {
  @IsUUID()
  tenantId: string;

  @IsEmail()
  @MaxLength(320)
  email: string;

  // Capped so an oversized body can't tie up a bcrypt comparison (bcrypt only
  // uses the first 72 bytes anyway).
  @IsString()
  @MaxLength(200)
  password: string;
}
