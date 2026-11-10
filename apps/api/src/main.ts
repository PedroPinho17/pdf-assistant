import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

  app.use(
    helmet({
      // The web app (another origin) embeds PDFs from /documents/:id/file.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // Replace X-Frame-Options: only the web app may frame API responses.
      frameguard: false,
      // The API serves JSON and PDFs, not HTML pages, so the only CSP rule that
      // matters is who may embed it. A default-src could break the browser's
      // built-in PDF viewer, so it is left out on purpose.
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: helmet.contentSecurityPolicy.dangerouslyDisableDefaultSrc,
          frameAncestors: [webOrigin],
        },
      },
    }),
  );
  app.use(cookieParser());
  app.enableCors({ origin: webOrigin, credentials: true });
  app.disable('x-powered-by');

  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
