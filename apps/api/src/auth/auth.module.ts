import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { SessionModule } from './session/session.module';

@Module({
  imports: [PrismaModule, SessionModule],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, SessionAuthGuard],
  exports: [AuthService, SessionAuthGuard],
})
export class AuthModule {}
