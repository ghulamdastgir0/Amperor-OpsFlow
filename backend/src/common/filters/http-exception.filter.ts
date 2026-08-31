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

// body-parser / raw-body throw plain `http-errors` (not Nest HttpExceptions):
// a `.type` string plus a numeric `.status`. Map the two we actually hit —
// an over-limit body and unparseable JSON — to a clean status + message
// instead of letting them fall through to a 500 / a raw parser string.
const BODY_ERROR: Record<string, { status: number; message: string }> = {
  'entity.too.large': {
    status: HttpStatus.PAYLOAD_TOO_LARGE,
    message: 'Request body is too large',
  },
  'entity.parse.failed': {
    status: HttpStatus.BAD_REQUEST,
    message: 'Malformed JSON body',
  },
};

function bodyErrorType(exception: unknown): string | undefined {
  const type = (exception as { type?: unknown } | null)?.type;
  return typeof type === 'string' && type in BODY_ERROR ? type : undefined;
}

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
    const bodyErrType = bodyErrorType(exception);

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : bodyErrType
          ? BODY_ERROR[bodyErrType].status
          : prismaCode && PRISMA_STATUS[prismaCode]
            ? PRISMA_STATUS[prismaCode]
            : HttpStatus.INTERNAL_SERVER_ERROR;

    // Unhandled (non-HttpException) errors were previously swallowed with no
    // server-side trace at all — only a generic "Internal server error" ever
    // reached the client or the logs, making 500s unreproducible from logs
    // alone. Mapped Prisma client-errors are logged at warn (they're expected
    // bad input, not a fault); everything else unhandled stays at error.
    if (!(exception instanceof HttpException)) {
      const mappedClientError =
        (prismaCode && PRISMA_STATUS[prismaCode]) || bodyErrType;
      const level = mappedClientError ? 'warn' : 'error';
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
        : bodyErrType
          ? BODY_ERROR[bodyErrType].message
          : prismaCode && PRISMA_MESSAGE[prismaCode]
            ? PRISMA_MESSAGE[prismaCode]
            : 'Internal server error';
    let message: string | string[] =
      typeof body === 'string'
        ? body
        : ((body as { message?: string | string[] })?.message ??
          'Internal server error');

    // body-parser's JSON parse failure often reaches here already wrapped as a
    // BadRequestException carrying the raw V8 parser text ("Expected property
    // name or '}' in JSON at position 1 …"). Normalise it to a stable,
    // non-leaky message.
    const looksLikeJsonParseError =
      typeof message === 'string' &&
      /\bin JSON\b|JSON at position|Unexpected (token|end) .*JSON/i.test(
        message,
      );
    if (status === 400 && looksLikeJsonParseError) {
      message = 'Malformed JSON body';
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
