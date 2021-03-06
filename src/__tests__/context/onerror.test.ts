import request from 'supertest';
import Koa, { KoaError } from '../../application';
import context from '../helpers/context';
import Context from '../../context';

// silence console.error during tests
jest.spyOn(global.console, 'error').mockImplementation(() => {});

describe('ctx.onerror(err)', () => {
  it('should respond', async() => {
    const app = new Koa();

    app.use((ctx: Context) => {
      ctx.body = 'something else';

      ctx.throw(418, 'boom');
    });

    const server = app.listen();

    const response = await request(server).get('/');
    expect(response.status).toBe(418);
    expect(response.headers['content-type']).toBe('text/plain; charset=utf-8');
    expect(response.headers['content-length']).toBe('4');
  });

  it('should unset all headers', async() => {
    const app = new Koa();

    app.use((ctx: Context) => {
      ctx.set('Vary', 'Accept-Encoding');
      ctx.set('X-CSRF-Token', 'asdf');
      ctx.body = 'response';

      ctx.throw(418, 'boom');
    });

    const server = app.listen();

    const response = await request(server).get('/');
    expect(response.status).toBe(418);
    expect(response.headers['content-type']).toBe('text/plain; charset=utf-8');
    expect(response.headers['content-length']).toBe('4');
    expect(Object.prototype.hasOwnProperty.call(response.headers, 'vary')).toBeFalsy();
    expect(Object.prototype.hasOwnProperty.call(response.headers, 'x-csrf-token')).toBeFalsy();
  });

  it('should set headers specified in the error', async() => {
    const app = new Koa();

    app.use((ctx: Context) => {
      ctx.set('Vary', 'Accept-Encoding');
      ctx.set('X-CSRF-Token', 'asdf');
      ctx.body = 'response';

      throw Object.assign(new Error('boom'), {
        status: 418,
        expose: true,
        headers: {
          'X-New-Header': 'Value'
        }
      });
    });

    const server = app.listen();

    const response = await request(server).get('/');
    expect(response.status).toBe(418);
    expect(response.headers['content-type']).toBe('text/plain; charset=utf-8');
    expect(response.headers['x-new-header']).toBe('Value');
    expect(Object.prototype.hasOwnProperty.call(response.headers, 'vary')).toBeFalsy();
    expect(Object.prototype.hasOwnProperty.call(response.headers, 'x-csrf-token')).toBeFalsy();
  });

  it('should ignore error after headerSent', () => {
    return new Promise(resolve => {
      const app = new Koa();

      app.on('error', err => {
        expect(err.message).toBe('mock error');
        expect(err.headerSent).toBeTruthy();
        resolve();
      });

      app.use(async(ctx: Context) => {
        ctx.status = 200;
        ctx.set('X-Foo', 'Bar');
        ctx.flushHeaders();
        await Promise.reject(new Error('mock error'));
        ctx.body = 'response';
      });

      request(app.callback())
        .get('/')
        .expect('X-Foo', 'Bar')
        .expect(200, () => {});
    });
  });

  it('should set status specified in the error using statusCode', async() => {
    const app = new Koa();

    app.use((ctx: Context) => {
      ctx.body = 'something else';
      const err = new KoaError('Not found');
      err.statusCode = 404;
      throw err;
    });

    const server = app.listen();

    const response = await request(server).get('/');
    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toBe('text/plain; charset=utf-8');
    expect(response.text).toBe('Not Found');
  });

  describe('when invalid err.statusCode', () => {
    describe('not number', () => {
      it('should respond 500', async() => {
        const app = new Koa();

        app.use((ctx: Context) => {
          ctx.body = 'something else';
          const err = new KoaError('some error');
          (err as any).statusCode = 'notnumber';
          throw err;
        });

        const server = app.listen();

        const response = await request(server).get('/');
        expect(response.status).toBe(500);
        expect(response.headers['content-type']).toBe('text/plain; charset=utf-8');
        expect(response.text).toBe('Internal Server Error');
      });
    });
  });

  describe('when invalid err.status', () => {
    describe('not number', () => {
      it('should respond 500', async() => {
        const app = new Koa();

        app.use((ctx: Context) => {
          ctx.body = 'something else';
          const err = new KoaError('some error');
          (err as any).status = 'notnumber';
          throw err;
        });

        const server = app.listen();

        const response = await request(server).get('/');
        expect(response.status).toBe(500);
        expect(response.headers['content-type']).toBe('text/plain; charset=utf-8');
        expect(response.text).toBe('Internal Server Error');
      });
    });
    describe('when ENOENT error', () => {
      it('should respond 404', async() => {
        const app = new Koa();

        app.use((ctx: Context) => {
          ctx.body = 'something else';
          const err = new KoaError('test for ENOENT');
          err.code = 'ENOENT';
          throw err;
        });

        const server = app.listen();

        const response = await request(server).get('/');
        expect(response.status).toBe(404);
        expect(response.headers['content-type']).toBe('text/plain; charset=utf-8');
        expect(response.text).toBe('Not Found');
      });
    });
    describe('not http status code', () => {
      it('should respond 500', async() => {
        const app = new Koa();

        app.use((ctx: Context) => {
          ctx.body = 'something else';
          const err = new KoaError('some error');
          err.status = 9999;
          throw err;
        });

        const server = app.listen();

        const response = await request(server).get('/');
        expect(response.status).toBe(500);
        expect(response.headers['content-type']).toBe('text/plain; charset=utf-8');
        expect(response.text).toBe('Internal Server Error');
      });
    });
  });

  describe('when non-error thrown', () => {
    it('should response non-error thrown message', async() => {
      const app = new Koa();

      app.use(() => {
        throw 'string error'; // eslint-disable-line no-throw-literal
      });

      const server = app.listen();

      const response = await request(server).get('/');
      expect(response.status).toBe(500);
      expect(response.headers['content-type']).toBe('text/plain; charset=utf-8');
      expect(response.text).toBe('Internal Server Error');
    });

    it('should use res.getHeaderNames() accessor when available', () => {
      let removed = 0;
      const ctx = context();

      ctx.app.emit = () => false;
      ctx.res = {
        getHeaderNames: () => ['content-type', 'content-length'],
        removeHeader: () => removed++,
        end: () => {},
        emit: () => false
      } as any;

      ctx.onerror(new Error('error'));

      expect(removed).toBe(2);
    });

    it('should stringify error if it is an object', () => {
      return new Promise(resolve => {
        const app = new Koa();

        app.on('error', err => {
          expect(err).toMatchObject(new Error('non-error thrown: {"key":"value"}'));
          resolve();
        });

        app.use(() => {
          throw { key: 'value' }; // eslint-disable-line no-throw-literal
        });

        request(app.callback())
          .get('/')
          .expect(500)
          .expect('Internal Server Error', () => {});
      });
    });
  });
});
