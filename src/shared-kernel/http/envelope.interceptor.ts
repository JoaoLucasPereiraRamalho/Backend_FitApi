import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import { isEnveloped } from './envelope.js';

/**
 * Embrulha o retorno dos controllers em `{ "data": ... }`. Listas paginadas (paged/buildPage)
 * já saem no formato final, e retorno vazio (204) continua sem corpo.
 */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next
      .handle()
      .pipe(
        map((body: unknown) => (body === undefined || isEnveloped(body) ? body : { data: body })),
      );
  }
}
