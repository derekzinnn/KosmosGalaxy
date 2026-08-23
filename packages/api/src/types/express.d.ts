import type { RequestContext, RequestMetadata } from './request-context.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** Present only after the authenticate middleware has run. */
    context?: RequestContext;
    /** Always present: set by requestMetadata, before authentication. */
    metadata: RequestMetadata;
  }
}

export {};
