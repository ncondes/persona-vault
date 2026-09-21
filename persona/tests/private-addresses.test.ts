import { privateAddressReason } from '../src/infrastructure/http/private-addresses';

// Domain verification makes the API fetch a URL a developer chose, and the API
// sits on a private network beside Postgres, Redis and the platform's metadata
// service. This list is the thing standing between those two facts.
describe('privateAddressReason', () => {
  it.each([
    ['0.0.0.0', 'unspecified'],
    ['127.0.0.1', 'loopback'],
    ['127.255.255.254', 'loopback'],
    ['10.0.0.1', 'private (10/8)'],
    ['172.16.0.1', 'private (172.16/12)'],
    ['172.31.255.255', 'private (172.16/12)'],
    ['192.168.1.1', 'private (192.168/16)'],
    ['100.64.0.1', 'carrier NAT'],
    // The one that matters most on a cloud host: the metadata endpoint.
    ['169.254.169.254', 'link local'],
    ['198.18.0.1', 'benchmarking'],
    ['224.0.0.1', 'multicast'],
    ['255.255.255.255', 'reserved'],
  ])('refuses %s as %s', (address, reason) => {
    expect(privateAddressReason(address)).toBe(reason);
  });

  it.each([
    ['8.8.8.8'],
    ['1.1.1.1'],
    ['172.15.0.1'],
    ['172.32.0.1'],
    ['192.169.0.1'],
    ['100.63.255.255'],
    ['100.128.0.1'],
  ])('allows the public address %s', (address) => {
    expect(privateAddressReason(address)).toBeNull();
  });

  describe('IPv6', () => {
    it.each([
      ['::', 'unspecified'],
      ['::1', 'loopback'],
      ['fc00::1', 'unique local'],
      ['fd12:3456::1', 'unique local'],
      ['fe80::1', 'link local'],
      ['ff02::1', 'multicast'],
    ])('refuses %s as %s', (address, reason) => {
      expect(privateAddressReason(address)).toBe(reason);
    });

    // An IPv4 address wearing a hat. Missing this is the classic way a filter
    // that looks thorough lets 127.0.0.1 straight through.
    it('sees through an IPv4-mapped address', () => {
      expect(privateAddressReason('::ffff:127.0.0.1')).toBe('loopback');
      expect(privateAddressReason('::ffff:169.254.169.254')).toBe('link local');
      expect(privateAddressReason('::ffff:8.8.8.8')).toBeNull();
    });

    it('ignores a zone index', () => {
      expect(privateAddressReason('fe80::1%eth0')).toBe('link local');
    });

    it('allows a public address', () => {
      expect(privateAddressReason('2606:4700:4700::1111')).toBeNull();
    });
  });

  it('refuses anything that is not an address at all', () => {
    for (const value of ['', 'localhost', 'not-an-ip', '999.1.1.1', '10.0.0']) {
      expect(privateAddressReason(value)).toBe('unparseable');
    }
  });
});
