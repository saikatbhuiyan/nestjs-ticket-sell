/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { tap } from 'rxjs/operators';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const rpcCtx = context.switchToRpc();
    const message = rpcCtx.getData();
    const metadata = rpcCtx.getContext();

    // Extract or generate correlationId
    const correlationId =
      metadata?.correlationId || message?.correlationId || uuid();

    // Attach correlationId back into context (so filters can use it)
    metadata.correlationId = correlationId;

    return next.handle().pipe(
      tap(() => {
        // Optional: log after successful request
        console.log(`[${correlationId}] Successfully handled request`);
      }),
    );
  }
}
