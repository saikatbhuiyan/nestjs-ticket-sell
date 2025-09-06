export enum OrderStatus {
  /** Order created, but the ticket is not yet reserved */
  Created = 'created',

  /** Ticket already reserved OR order cancelled/expired before payment */
  Cancelled = 'cancelled',

  /** Ticket reserved, waiting for user payment */
  AwaitingPayment = 'awaiting_payment',

  /** Payment successful, order completed */
  Complete = 'complete',
}
