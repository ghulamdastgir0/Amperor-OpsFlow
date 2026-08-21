import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Unhandled (non-HttpException) errors were previously swallowed with no
    // server-side trace at all — only a generic "Internal server error" ever
    // reached the client or the logs, making 500s unreproducible from logs
    // alone.
    if (!(exception instanceof HttpException)) {
      this.logger.error(
        exception instanceof Error ? exception.message : String(exception),
        exception instanceof Error ? exception.stack : undefined,
      );
    }
    // HttpException.getResponse() for a string/array-constructed exception
    // (the common case: `throw new BadRequestException('some message')`) is
    // itself an object shaped {message, error, statusCode} — putting that
    // whole object into this response's `message` field double-wraps it, so
    // callers reading response.data.message always get the wrapper instead
    // of the actual text. Unwrap it so `message` is always the plain
    // string/string[] every frontend error handler already expects.
    const body =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';
    const message =
      typeof body === 'string'
        ? body
        : ((body as { message?: string | string[] })?.message ?? 'Internal server error');

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
