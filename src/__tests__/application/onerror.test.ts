import Koa, { KoaError } from '../../application';

const spy = jest.spyOn(global.console, 'error').mockImplementationOnce(() => {});

describe('app.onerror(err)', () => {
  afterEach(() => {
    spy.mockReset();
  });

  it('should throw an error if a non-error is given', () => {
    const app = new Koa();

    expect(() => {
      app.onerror('foo');
    }).toThrow(new TypeError('non-error thrown: "foo"'));
  });

  it('should do nothing if status is 404', () => {
    const app = new Koa();
    const err = new KoaError();

    err.status = 404;

    app.onerror(err);
    expect(spy).not.toHaveBeenCalled();
  });

  it('should do nothing if .silent', () => {
    const app = new Koa();
    app.silent = true;
    const err = new Error();

    app.onerror(err);
    expect(spy).not.toHaveBeenCalled();
  });

  it('should log the error to stderr', () => {
    const app = new Koa();
    app.env = 'dev';

    const err = new Error();
    err.stack = 'Foo';

    app.onerror(err);
    expect(spy).toHaveBeenCalledWith('  Foo');
  });

  it('should use err.toString() instead of err.stack', () => {
    const app = new Koa();
    app.env = 'dev';

    const err = new Error('mock stack null');
    err.stack = null;

    app.onerror(err);
    expect(spy).toHaveBeenCalledWith();
    expect(spy).toHaveBeenCalledWith('  Error: mock stack null');
    expect(spy).toHaveBeenCalledWith();
  });
});
