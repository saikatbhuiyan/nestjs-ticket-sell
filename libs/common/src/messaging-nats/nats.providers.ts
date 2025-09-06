import { Provider } from '@nestjs/common';
import {
  connect,
  type NatsConnection,
  type JetStreamClient,
  type JetStreamManager,
} from 'nats';

export const NATS_CONN = Symbol('NATS_CONN');
export const NATS_JS = Symbol('NATS_JS');
export const NATS_JSM = Symbol('NATS_JSM');

export const NatsConnectionProvider: Provider = {
  provide: NATS_CONN,
  useFactory: async (): Promise<NatsConnection> => {
    const servers = process.env.NATS_SERVERS?.split(',') ?? [
      'nats://localhost:4222',
    ];
    const name =
      process.env.NATS_NAME ?? `nest-${Math.random().toString(36).slice(2)}`;
    return connect({ servers, name });
  },
};

export const JetStreamProvider: Provider = {
  provide: NATS_JS,
  useFactory: (nc: NatsConnection): JetStreamClient => nc.jetstream(),
  inject: [NATS_CONN],
};

export const JetStreamManagerProvider: Provider = {
  provide: NATS_JSM,
  useFactory: async (nc: NatsConnection): Promise<JetStreamManager> =>
    nc.jetstreamManager(),
  inject: [NATS_CONN],
};
