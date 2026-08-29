import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTenantAdminDto {
  @IsEmail()
  @MaxLength(320)
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password: string;
}
