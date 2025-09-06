import { NestFactory } from '@nestjs/core';
import { AuthModule } from './auth.module';
import { CorrelationIdInterceptor, GlobalExceptionFilter } from '@app/common';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AuthModule);

  const logger = new Logger('Bootstrap');

  const port = 3000;

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new CorrelationIdInterceptor());

  try {
    await app.listen(port);
    logger.log(`Application virtual is running on: http://localhost:${port}`);
  } catch (error) {
    logger.error('Error starting the application', error);
  }
}
bootstrap();
