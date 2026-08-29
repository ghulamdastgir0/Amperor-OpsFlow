import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

// Known Prisma error codes that are really client mistakes (a malformed UUID in
// the path, a row that doesn't exist, a unique-constraint clash) rather than
// server faults — without this they all surfaced as an opaque 500.
const PRISMA_STATUS: Record<string, number> = {
  P2023: HttpStatus.BAD_REQUEST, // malformed value, e.g. a non-UUID :id param
  P2000: HttpStatus.BAD_REQUEST, // value too long for the column
  P2025: HttpStatus.NOT_FOUND, // record required for the operation not found
  P2002: HttpStatus.CONFLICT, // unique constraint violation
  P2003: HttpStatus.BAD_REQUEST, // foreign-key constraint failed
};

const PRISMA_MESSAGE: Record<string, string> = {
  P2023: 'Malformed identifier in the request',
  P2000: 'A provided value is too long',
  P2025: 'The requested record was not found',
  P2002: 'That value is already in use',
  P2003: 'Referenced record does not exist',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const prismaCode =
      exception instanceof Prisma.PrismaClientKnownRequestError
        ? exception.code
        : undefined;

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : prismaCode && PRISMA_STATUS[prismaCode]
          ? PRISMA_STATUS[prismaCode]
          : HttpStatus.INTERNAL_SERVER_ERROR;

    // Unhandled (non-HttpException) errors were previously swallowed with no
    // server-side trace at all — only a generic "Internal server error" ever
    // reached the client or the logs, making 500s unreproducible from logs
    // alone. Mapped Prisma client-errors are logged at warn (they're expected
    // bad input, not a fault); everything else unhandled stays at error.
    if (!(exception instanceof HttpException)) {
      const level = prismaCode && PRISMA_STATUS[prismaCode] ? 'warn' : 'error';
      this.logger[level](
        exception instanceof Error ? exception.message : String(exception),
        level === 'error' && exception instanceof Error
          ? exception.stack
          : undefined,
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
        : prismaCode && PRISMA_MESSAGE[prismaCode]
          ? PRISMA_MESSAGE[prismaCode]
          : 'Internal server error';
    const message =
      typeof body === 'string'
        ? body
        : ((body as { message?: string | string[] })?.message ??
          'Internal server error');

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
