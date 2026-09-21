import { EventEmitter } from 'node:events';
import {
  ChallengeResponse,
  UnsafeTargetError,
  readChallengeResponse,
} from '../src/infrastructure/http/challenge-fetch';

// A response with no socket under it. The address checks in fetchChallenge are
// tested separately against real DNS; this is about what happens once bytes
// start arriving.
class FakeResponse extends EventEmitter implements ChallengeResponse {
  destroyed = false;
  encoding: string | null = null;

  constructor(public statusCode?: number) {
    super();
  }

  setEncoding(encoding: string): void {
    this.encoding = encoding;
  }

  destroy(): void {
    this.destroyed = true;
  }

  send(...chunks: string[]): this {
    // Queued so the reader is listening before anything arrives.
    queueMicrotask(() => {
      for (const chunk of chunks) this.emit('data', chunk);
      this.emit('end');
    });
    return this;
  }
}

async function refusal(res: FakeResponse, maxBytes = 1_024): Promise<string> {
  try {
    await readChallengeResponse(res, maxBytes);
    throw new Error('was not refused');
  } catch (err) {
    if (!(err instanceof UnsafeTargetError)) throw err;
    return err.message;
  }
}

describe('readChallengeResponse', () => {
  it('reads the body and reports the status', async () => {
    const res = new FakeResponse(200).send('a-token');
    await expect(readChallengeResponse(res, 1_024)).resolves.toEqual({
      status: 200,
      body: 'a-token',
    });
  });

  it('joins a body that arrives in pieces', async () => {
    const res = new FakeResponse(200).send('a-', 'to', 'ken');
    await expect(readChallengeResponse(res, 1_024)).resolves.toMatchObject({ body: 'a-token' });
  });

  it('hands back a non-200 rather than refusing, so the reason can be reported', async () => {
    const res = new FakeResponse(404).send('Not Found');
    await expect(readChallengeResponse(res, 1_024)).resolves.toMatchObject({ status: 404 });
  });

  // A redirect is a second target that nothing checked — following it would
  // undo the address check entirely.
  it.each([301, 302, 303, 307, 308])('refuses a %s redirect without reading it', async (status) => {
    const res = new FakeResponse(status);
    expect(await refusal(res)).toMatch(/redirects/);
    expect(res.destroyed).toBe(true);
  });

  it('refuses a body past the cap and stops reading', async () => {
    const res = new FakeResponse(200).send('x'.repeat(2_048));
    expect(await refusal(res, 1_024)).toMatch(/too large/);
    expect(res.destroyed).toBe(true);
  });

  // An endless response must not be able to keep resolving and rejecting the
  // same promise as more chunks arrive.
  it('settles once, however much more arrives', async () => {
    const res = new FakeResponse(200);
    const reading = refusal(res, 8);
    queueMicrotask(() => {
      res.emit('data', 'x'.repeat(16));
      res.emit('data', 'x'.repeat(16));
      res.emit('end');
    });
    expect(await reading).toMatch(/too large/);
  });

  it('reads as text, so the body is a string rather than a buffer', async () => {
    const res = new FakeResponse(200).send('token');
    await readChallengeResponse(res, 1_024);
    expect(res.encoding).toBe('utf8');
  });

  it('copes with a response that carries no status at all', async () => {
    const res = new FakeResponse(undefined).send('token');
    await expect(readChallengeResponse(res, 1_024)).resolves.toMatchObject({ status: 0 });
  });
});
