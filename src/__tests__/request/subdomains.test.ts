import { request } from '../helpers/context';

describe('req.subdomains', () => {
  it('should return subdomain array', () => {
    const req = request();
    req.header.host = 'tobi.ferrets.example.com';
    req.app.subdomainOffset = 2;
    expect(req.subdomains).toStrictEqual(['ferrets', 'tobi']);

    req.app.subdomainOffset = 3;
    expect(req.subdomains).toStrictEqual(['tobi']);
  });

  it('should work with no host present', () => {
    const req = request();
    expect(req.subdomains).toStrictEqual([]);
  });

  it('should check if the host is an ip address, even with a port', () => {
    const req = request();
    req.header.host = '127.0.0.1:3000';
    expect(req.subdomains).toStrictEqual([]);
  });
});
