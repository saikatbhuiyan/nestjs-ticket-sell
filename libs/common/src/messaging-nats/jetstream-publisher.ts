import { Logger } from '@nestjs/common';
import { JetStreamClient, NatsConnection, JSONCodec } from 'nats';

export abstract class JetStreamPublisher<T> {
  protected readonly logger = new Logger(this.constructor.name);

  /** Subject to publish to (e.g., "orders.created") */
  abstract subject: string;

  /** Stream name (should match subject mapping in JetStream) */
  abstract stream: string;

  constructor(
    protected readonly nc: NatsConnection,
    protected readonly js: JetStreamClient,
  ) {}

  async publish(data: T): Promise<void> {
    const jc = JSONCodec<T>();
    try {
      const ack = await this.js.publish(this.subject, jc.encode(data));
      this.logger.debug(
        `Published event ${this.subject} seq=${ack.seq} stream=${this.stream}`,
      );
    } catch (err) {
      this.logger.error(`Failed to publish ${this.subject}: ${err}`);
      throw err;
    }
  }
}
