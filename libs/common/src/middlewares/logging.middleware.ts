// src/common/middleware/logging.middleware.ts
import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { v4 as uuid } from 'uuid';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('RequestLogger');

  use(req: any, res: any, next: () => void) {
    const correlationId = req.headers['x-correlation-id'] || uuid();
    req.correlationId = correlationId;
    res.setHeader('x-correlation-id', correlationId);

    const { method, url } = req;
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      this.logger.log(
        `[${correlationId}] ${method} ${url} ${res.statusCode} - ${duration}ms`,
      );
    });

    next();
  }
}
