import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { PrismaService } from './common/prisma/prisma.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());
  // Cookies are the auth mechanism, so the browser origin must be explicit —
  // a wildcard would not be allowed to send credentials anyway.
  app.enableCors({
    origin: [config.get<string>('frontendUrl', 'http://localhost:3000')],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.get(PrismaService).enableShutdownHooks(app);
  app.enableShutdownHooks();

  if (config.get<string>('nodeEnv') !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Kosvia API')
        .setDescription('AI Beauty Shopper — REST API')
        .setVersion('0.1.0')
        .addCookieAuth('kosvia_at')
        .build(),
    );
    SwaggerModule.setup('docs', app, document);
  }

  const port = config.get<number>('port', 3001);
  await app.listen(port);
  logger.log(`Kosvia API listening on http://localhost:${port}`);
  if (config.get<string>('nodeEnv') !== 'production') {
    logger.log(`API reference at http://localhost:${port}/docs`);
  }
}

void bootstrap();
