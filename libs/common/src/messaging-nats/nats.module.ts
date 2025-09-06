import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  NatsConnectionProvider,
  JetStreamProvider,
  JetStreamManagerProvider,
} from './nats.providers';
import { JetStreamBootstrapService } from './jetstream-bootstrap.service';

@Global()
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [
    NatsConnectionProvider,
    JetStreamProvider,
    JetStreamManagerProvider,
    JetStreamBootstrapService,
  ],
  exports: [
    NatsConnectionProvider,
    JetStreamProvider,
    JetStreamManagerProvider,
  ],
})
export class NatsModule {}
