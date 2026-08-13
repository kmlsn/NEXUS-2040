import { Catch, HttpException } from "@nestjs/common";
import type { ArgumentsHost } from "@nestjs/common";

type ResponseLike = { status(code: number): ResponseLike; json(body: unknown): void; getHeader(name: string): unknown };
@Catch()
export class PublicErrorFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<ResponseLike>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const requestId = String(response.getHeader("X-Request-Id") ?? "unknown");
    const code = status === 404 ? "NOT_FOUND" : "INTERNAL_ERROR";
    response.status(status).json({ error: { code, message: status === 404 ? "Route not found." : "An unexpected error occurred.", requestId } });
  }
}
