import { EventEmitter } from 'events';
import http from 'http';
import Debug from 'debug';
import Deprecate from 'depd';
import isGeneratorFunction from 'is-generator-function';
import convert from 'koa-convert';
import compose from 'koa-compose';
import onFinished from 'on-finished';
import statuses from 'statuses';
import Stream from 'stream';
import util from 'util';
import { HttpError, HttpErrorConstructor } from 'http-errors';
import Keygrip from 'keygrip';

import Context from './context';
import Request from './request';
import Response from './response';

import only from 'only';
import isError from './utils/isError';

const debug = Debug('koa:application');
const deprecate = Deprecate('koa');

export class KoaError extends Error {
  expose?: boolean;
  status?: number;
  statusCode?: number;
  code?: string;
};

type Options = {
  proxy?: boolean;
  subdomainOffset?: number;
  proxyIpHeader?: string;
  maxIpsCount?: number;
  env?: string;
  keys?: string[] | Keygrip;
};

export type ApplicationJSON = {
  subdomainOffset?: number;
  proxy?: boolean;
  env?: string;
};

type HandleRequestFn = (req: http.IncomingMessage, res: http.ServerResponse) => HandleRequestFn;

export default class Application extends EventEmitter {
  public silent: boolean;

  public proxy: boolean;
  public proxyIpHeader: string;
  public maxIpsCount: number;
  public subdomainOffset: number;
  public keys: any;
  public env: string;
  public middleware: any[];
  public static HttpError: HttpErrorConstructor = HttpError;

  public context: Context;
  public request: Request;
  public response: Response;

  constructor(options: Options = {}) {
    super();
    this.proxy = options.proxy || false;
    this.subdomainOffset = options.subdomainOffset || 2;
    this.proxyIpHeader = options.proxyIpHeader || 'X-Forwarded-For';
    this.maxIpsCount = options.maxIpsCount || 0;
    this.env = options.env || process.env.NODE_ENV || 'development';
    if (options.keys) this.keys = options.keys;
    this.middleware = [];

    this.context = new Context();
    this.request = new Request();
    this.response = new Response();

    if (util.inspect.custom) {
      this[util.inspect.custom] = this.inspect;
    }
  }

  listen(...args: any[]): http.Server {
    debug('listen');
    const server = http.createServer(this.callback());
    return server.listen(...args);
  }

  toJSON(): ApplicationJSON {
    return only(this, [
      'subdomainOffset',
      'proxy',
      'env'
    ]);
  }

  inspect(): ApplicationJSON {
    return this.toJSON();
  }

  use(fn: Function): Application {
    if (typeof fn !== 'function') throw new TypeError('middleware must be a function!');
    if (isGeneratorFunction(fn)) {
      deprecate('Support for generators will be removed in v3. ' +
                'See the documentation for examples of how to convert old middleware ' +
                'https://github.com/koajs/koa/blob/master/docs/migration.md');
      fn = convert(fn);
    }
    debug('use %s', fn.name || '-');
    this.middleware.push(fn);
    return this;
  }

  callback(): HandleRequestFn {
    const fn = compose(this.middleware);

    if (!this.listenerCount('error')) this.on('error', this.onerror);

    const handleRequest = (req: http.IncomingMessage, res: http.ServerResponse) => {
      const ctx = this.createContext(req, res);
      return this.handleRequest(ctx, fn);
    };

    return handleRequest;
  }

  handleRequest(ctx: Context, fnMiddleware: Function): HandleRequestFn {
    const res = ctx.res;
    res.statusCode = 404;
    const onerror = (err: any) => ctx.onerror(err);
    const handleResponse = () => respond(ctx);
    onFinished(res, onerror);
    return fnMiddleware(ctx).then(handleResponse).catch(onerror);
  }

  createContext(req: http.IncomingMessage, res: http.ServerResponse): Context {
    const context = Object.create(this.context);
    const request = context.request = Object.create(this.request);
    const response = context.response = Object.create(this.response);
    context.app = request.app = response.app = this;
    context.req = request.req = response.req = req;
    context.res = request.res = response.res = res;
    request.ctx = response.ctx = context;
    request.response = response;
    response.request = request;
    context.originalUrl = request.originalUrl = req.url;
    context.state = {};
    return context;
  }

  onerror(err: any) {
    if (!isError(err)) {
      throw new TypeError(util.format('non-error thrown: %j', err));
    }

    // not sure what err.expose is
    if (404 === err.status || err.expose) return;
    if (this.silent) return;

    const msg = err.stack || err.toString();
    console.error();
    console.error(msg.replace(/^/gm, '  '));
    console.error();
  }
}

function respond(ctx: Context) {
  // allow bypassing koa
  if (false === ctx.respond) return;

  if (!ctx.writable) return;

  const res = ctx.res;
  let body = ctx.body;
  const code = ctx.status;

  // ignore body
  if (statuses.empty[code]) {
    // strip headers
    ctx.body = null;
    return res.end();
  }

  if ('HEAD' === ctx.method) {
    if (!res.headersSent && !ctx.response.has('Content-Length')) {
      const { length } = ctx.response;
      if (Number.isInteger(length)) ctx.length = length;
    }
    return res.end();
  }

  // status body
  if (null == body) {
    if (ctx.response._explicitNullBody) {
      ctx.response.remove('Content-Type');
      ctx.response.remove('Transfer-Encoding');
      return res.end();
    }
    if (ctx.req.httpVersionMajor >= 2) {
      body = String(code);
    } else {
      body = ctx.message || statuses.message[code] || String(code);
    }
    if (!res.headersSent) {
      ctx.type = 'text';
      ctx.length = Buffer.byteLength(body);
    }
    return res.end(body);
  }

  // responses
  if (Buffer.isBuffer(body)) return res.end(body);
  if ('string' === typeof body) return res.end(body);
  if (body instanceof Stream) return body.pipe(res);

  // body: json
  body = JSON.stringify(body);
  if (!res.headersSent) {
    ctx.length = Buffer.byteLength(body);
  }
  res.end(body);
}
