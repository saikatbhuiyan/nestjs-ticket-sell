import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  type JetStreamManager,
  type StreamConfig,
  type ConsumerConfig,
  StorageType,
  RetentionPolicy,
  AckPolicy,
  DeliverPolicy,
  DiscardPolicy,
  ReplayPolicy,
} from 'nats';

@Injectable()
export class JetStreamBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(JetStreamBootstrapService.name);

  constructor(private readonly jsm: JetStreamManager) {}

  async onModuleInit() {
    const stream = process.env.JS_STREAM_ORDERS!;
    const subject = process.env.JS_SUBJECT_ORDERS!;
    const consumer = process.env.JS_CONSUMER_ORDERS!;

    const sc: StreamConfig = {
      name: stream,
      subjects: [subject],
      retention: RetentionPolicy.Limits,
      storage: StorageType.File,
      max_consumers: 3,
      num_replicas: 3,
      sealed: false,
      first_seq: 0,
      max_msgs_per_subject: 0,
      max_msgs: 0,
      max_age: 0,
      max_bytes: 0,
      max_msg_size: 0,
      discard: DiscardPolicy.Old,
      discard_new_per_subject: false,
      duplicate_window: 0,
      allow_rollup_hdrs: false,
      deny_delete: false,
      deny_purge: false,
      allow_direct: false,
      mirror_direct: false,
    };

    try {
      await this.jsm.streams.info(stream);
      this.logger.log(`Stream ${stream} exists`);
    } catch {
      await this.jsm.streams.add(sc);
      this.logger.log(`Stream ${stream} created`);
    }

    const cc: ConsumerConfig = {
      durable_name: consumer,
      ack_policy: AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.All,
      ack_wait: 30000000000, // 30s
      max_deliver: 5,
      replay_policy: ReplayPolicy.Instant,
    };

    try {
      await this.jsm.consumers.info(stream, consumer);
      this.logger.log(`Consumer ${consumer} exists`);
    } catch {
      await this.jsm.consumers.add(stream, cc);
      this.logger.log(`Consumer ${consumer} created`);
    }
  }
}
