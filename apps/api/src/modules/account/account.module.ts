import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProfileModule } from '../profile/profile.module';
import { AccountController } from './account.controller';
import { AccountDeletionWorker } from './account-deletion.worker';
import { AccountService } from './account.service';
import { ConsentService } from './consent.service';

/** Global so the ConsentGuard can be applied on any controller. */
@Global()
@Module({
  imports: [AuthModule, ProfileModule],
  controllers: [AccountController],
  providers: [ConsentService, AccountService, AccountDeletionWorker],
  exports: [ConsentService, AccountService],
})
export class AccountModule {}
