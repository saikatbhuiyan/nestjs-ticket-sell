import { MsgHdrs } from 'nats';

export const CID = 'x-correlation-id';

export const withCid = (cid?: string) =>
  cid ? new Headers([[CID, cid]]) : undefined;

// In your correlation.ts file
export function getCid(msg: { headers?: MsgHdrs }): string | null {
  try {
    if (msg.headers) {
      return (
        msg.headers.get('correlation-id') ||
        msg.headers.get('x-correlation-id') ||
        msg.headers.get('cid') ||
        null
      );
    }
    return null;
  } catch (error) {
    console.error(error);
    return null;
  }
}
