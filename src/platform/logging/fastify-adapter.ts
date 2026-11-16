import type { IncomingMessage } from 'node:http';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { IdGenerator } from '../clock-and-ids/index.js';
import { REQUEST_ID_HEADER, resolveRequestId } from './request-id.js';

/**
 * Adaptador HTTP do processo api. O Fastify é a fonte do requestId: o hook copia o id para a
 * requisição crua, que o pino-http reaproveita, e devolve o mesmo valor em X-Request-Id.
 */
export function createFastifyAdapter(ids: IdGenerator): FastifyAdapter {
  const adapter = new FastifyAdapter({
    requestIdHeader: false,
    genReqId: (req: IncomingMessage) => resolveRequestId(req.headers[REQUEST_ID_HEADER], ids),
  });
  adapter.getInstance().addHook('onRequest', (request, reply, done) => {
    (request.raw as { id?: string }).id = request.id;
    void reply.header('X-Request-Id', request.id);
    done();
  });
  return adapter;
}
