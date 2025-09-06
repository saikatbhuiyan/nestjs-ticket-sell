import {
  JetStreamClient,
  JsMsg,
  NatsConnection,
  JetStreamPullSubscription,
  ConsumerInfo,
  AckPolicy,
  DeliverPolicy,
} from 'nats';
import { Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { getCid } from './correlation';

/**
 * Configuration options for JetStream listener
 */
export interface JetStreamListenerConfig {
  /** Maximum number of messages to fetch in one batch */
  maxMessages?: number;
  /** Fetch timeout in milliseconds */
  fetchTimeoutMs?: number;
  /** Acknowledgment wait time in milliseconds */
  ackWaitMs?: number;
  /** Maximum delivery attempts before message is discarded */
  maxDeliver?: number;
  /** Backoff delay in milliseconds for persistent errors */
  errorBackoffMs?: number;
  /** Shutdown timeout in milliseconds */
  shutdownTimeoutMs?: number;
}

/**
 * Message processing result
 */
export type MessageProcessingResult =
  | { success: true }
  | { success: false; shouldRetry: boolean; error: Error };

export abstract class JetStreamListener<T = unknown>
  implements OnModuleInit, OnModuleDestroy
{
  protected readonly logger = new Logger(this.constructor.name);
  private running = true;
  private processingPromise?: Promise<void>;

  /** Subject to subscribe to (e.g., "orders.created") */
  abstract readonly subject: string;

  /** Durable consumer name */
  abstract readonly durable: string;

  /** Stream name */
  abstract readonly stream: string;

  /** Configuration options */
  protected readonly config: Required<JetStreamListenerConfig>;

  /** Handle message */
  abstract onMessage(data: T, msg: JsMsg): Promise<void>;

  private sub?: JetStreamPullSubscription;

  constructor(
    protected readonly nc: NatsConnection,
    protected readonly js: JetStreamClient,
    config: JetStreamListenerConfig = {},
  ) {
    this.config = {
      maxMessages: 10,
      fetchTimeoutMs: 5000,
      ackWaitMs: 30000,
      maxDeliver: 3,
      errorBackoffMs: 1000,
      shutdownTimeoutMs: 5000,
      ...config,
    };
  }

  async onModuleInit(): Promise<void> {
    try {
      // Use the modern pullSubscribe API with object configuration
      this.sub = await this.js.pullSubscribe(this.subject, {
        stream: this.stream,
        config: {
          durable_name: this.durable,
          ack_policy: AckPolicy.Explicit,
          deliver_policy: DeliverPolicy.All,
          max_deliver: this.config.maxDeliver,
          ack_wait: this.config.ackWaitMs * 1_000_000, // Convert to nanoseconds
          filter_subject: this.subject,
        },
      });

      this.logger.log(
        `Started JetStream listener for ${this.subject} (durable: ${this.durable})`,
      );

      // Start message processing loop
      this.processingPromise = this.startProcessing();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to initialize JetStream listener for ${this.subject}: ${errorMessage}`,
      );
      throw error;
    }
  }

  private async startProcessing(): Promise<void> {
    while (this.running && this.sub) {
      try {
        for await (const msg of this.sub) {
          if (!this.running) break;
          await this.handleMessage(msg);
        }
      } catch (error: unknown) {
        if (this.running) {
          // Only log errors if we're still running (not shutting down)
          const isTimeoutError = this.isTimeoutError(error);

          if (isTimeoutError) {
            // Timeout is normal, just continue
            continue;
          }

          const errorMessage =
            error instanceof Error ? error.message : String(error);
          this.logger.error(`Fetch error on ${this.subject}: ${errorMessage}`);

          // Add backoff delay on persistent errors
          await this.sleep(this.config.errorBackoffMs);
        }
      }
    }
  }

  private isTimeoutError(error: unknown): boolean {
    if (error && typeof error === 'object' && 'code' in error) {
      return (error as { code: string }).code === '408';
    }
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('timeout') ||
        message.includes('no messages') ||
        message.includes('408')
      );
    }
    return false;
  }

  private async handleMessage(msg: JsMsg): Promise<void> {
    const cid = getCid(msg);
    const startTime = Date.now();

    try {
      const result = await this.processMessage(msg, cid);

      if (result.success) {
        msg.ack();
        const duration = Date.now() - startTime;
        this.logger.debug(
          `Processed ${this.subject} cid=${cid ?? '-'} in ${duration}ms`,
        );
      } else {
        if (result.shouldRetry) {
          msg.nak();
        } else {
          // For non-retriable errors, ack to prevent infinite retries
          this.logger.warn(
            `Non-retriable error for ${this.subject} cid=${cid ?? '-'}, acking message`,
          );
          msg.ack();
        }
      }
    } catch (error: unknown) {
      // This should not happen as processMessage should catch all errors
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Unexpected error in handleMessage for ${this.subject} cid=${cid ?? '-'} after ${duration}ms: ${errorMessage}`,
      );
      msg.nak();
    }
  }

  private async processMessage(
    msg: JsMsg,
    cid: string | null,
  ): Promise<MessageProcessingResult> {
    try {
      const data = this.parseMessageData(msg);

      this.logger.debug(`Processing ${this.subject} cid=${cid ?? '-'}`);

      await this.onMessage(data, msg);

      return { success: true };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Handler failed for ${this.subject} cid=${cid ?? '-'}: ${err.message}`,
      );

      return {
        success: false,
        shouldRetry: this.shouldRetry(err),
        error: err,
      };
    }
  }

  private parseMessageData(msg: JsMsg): T {
    try {
      const raw = new TextDecoder().decode(msg.data);
      return JSON.parse(raw) as T;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new Error(`JSON parse error: ${err.message}`);
    }
  }

  /**
   * Override this method to define custom retry logic
   * Return true if the message should be retried, false to ack and discard
   */
  protected shouldRetry(error: Error): boolean {
    // Default: retry all errors except validation errors
    const errorMessage = error.message.toLowerCase();
    return (
      !errorMessage.includes('validation') &&
      !errorMessage.includes('json parse error')
    );
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log(`Shutting down JetStream listener for ${this.subject}`);
    this.running = false;

    try {
      // Wait for current processing to complete with timeout
      if (this.processingPromise) {
        await Promise.race([
          this.processingPromise,
          this.sleep(this.config.shutdownTimeoutMs),
        ]);
      }

      // Unsubscribe from the consumer
      if (this.sub) {
        this.sub.unsubscribe();
        this.sub = undefined;
      }

      // Drain the connection (but don't close it as other services might be using it)
      if (this.nc && !this.nc.isClosed()) {
        await this.nc.drain();
      }

      this.logger.log(
        `JetStream listener for ${this.subject} shut down successfully`,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error during JetStream listener shutdown for ${this.subject}: ${errorMessage}`,
      );
    }
  }

  /**
   * Get subscription info for monitoring
   */
  async getSubscriptionInfo(): Promise<ConsumerInfo> {
    if (!this.sub) {
      throw new Error('Subscription not initialized');
    }
    return await this.sub.consumerInfo();
  }

  /**
   * Check if the listener is currently running
   */
  get isRunning(): boolean {
    return this.running;
  }

  /**
   * Get current configuration
   */
  get configuration(): Readonly<Required<JetStreamListenerConfig>> {
    return { ...this.config };
  }
}
