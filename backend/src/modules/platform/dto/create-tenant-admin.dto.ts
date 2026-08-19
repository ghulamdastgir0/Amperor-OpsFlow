import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateTenantAdminDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsString()
  @MinLength(8)
  password: string;
}
