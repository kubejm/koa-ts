import context from '../helpers/context';

describe('ctx.is(type)', () => {
  it('should ignore params', () => {
    const ctx = context();
    ctx.header['content-type'] = 'text/html; charset=utf-8';
    ctx.header['transfer-encoding'] = 'chunked';

    expect(ctx.is('text/*')).toBe('text/html');
  });

  describe('when no body is given', () => {
    it('should return null', () => {
      const ctx = context();

      expect(ctx.is()).toBeNull();
      expect(ctx.is('image/*')).toBeNull();
      expect(ctx.is('image/*', 'text/*')).toBeNull();
    });
  });

  describe('when no content type is given', () => {
    it('should return false', () => {
      const ctx = context();
      ctx.header['transfer-encoding'] = 'chunked';

      expect(ctx.is()).toBeFalsy();
      expect(ctx.is('image/*')).toBeFalsy();
      expect(ctx.is('text/*', 'image/*')).toBeFalsy();
    });
  });

  describe('give no types', () => {
    it('should return the mime type', () => {
      const ctx = context();
      ctx.header['content-type'] = 'image/png';
      ctx.header['transfer-encoding'] = 'chunked';

      expect(ctx.is()).toBe('image/png');
    });
  });

  describe('given one type', () => {
    it('should return the type or false', () => {
      const ctx = context();
      ctx.header['content-type'] = 'image/png';
      ctx.header['transfer-encoding'] = 'chunked';

      expect(ctx.is('png')).toBe('png');
      expect(ctx.is('.png')).toBe('.png');
      expect(ctx.is('image/png')).toBe('image/png');
      expect(ctx.is('image/*')).toBe('image/png');
      expect(ctx.is('*/png')).toBe('image/png');

      expect(ctx.is('jpeg')).toBeFalsy();
      expect(ctx.is('.jpeg')).toBeFalsy();
      expect(ctx.is('image/jpeg')).toBeFalsy();
      expect(ctx.is('text/*')).toBeFalsy();
      expect(ctx.is('*/jpeg')).toBeFalsy();
    });
  });

  describe('given multiple types', () => {
    it('should return the first match or false', () => {
      const ctx = context();
      ctx.header['content-type'] = 'image/png';
      ctx.header['transfer-encoding'] = 'chunked';

      expect(ctx.is('png')).toBe('png');
      expect(ctx.is('.png')).toBe('.png');
      expect(ctx.is('text/*', 'image/*')).toBe('image/png');
      expect(ctx.is('image/*', 'text/*')).toBe('image/png');
      expect(ctx.is('image/*', 'image/png')).toBe('image/png');
      expect(ctx.is('image/png', 'image/*')).toBe('image/png');

      expect(ctx.is(['text/*', 'image/*'])).toBe('image/png');
      expect(ctx.is(['image/*', 'text/*'])).toBe('image/png');
      expect(ctx.is(['image/*', 'image/png'])).toBe('image/png');
      expect(ctx.is(['image/png', 'image/*'])).toBe('image/png');

      expect(ctx.is('jpeg')).toBeFalsy();
      expect(ctx.is('.jpeg')).toBeFalsy();
      expect(ctx.is('text/*', 'application/*')).toBeFalsy();
      expect(ctx.is('text/html', 'text/plain', 'application/json; charset=utf-8')).toBeFalsy();
    });
  });

  describe('when Content-Type: application/x-www-form-urlencoded', () => {
    it('should match "urlencoded"', () => {
      const ctx = context();
      ctx.header['content-type'] = 'application/x-www-form-urlencoded';
      ctx.header['transfer-encoding'] = 'chunked';

      expect(ctx.is('urlencoded')).toBe('urlencoded');
      expect(ctx.is('json', 'urlencoded')).toBe('urlencoded');
      expect(ctx.is('urlencoded', 'json')).toBe('urlencoded');
    });
  });
});
