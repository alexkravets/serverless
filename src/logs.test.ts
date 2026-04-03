'use strict';

import logs from './logs';
import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';

jest.mock('@aws-sdk/client-cloudwatch-logs');

let mockSend: jest.Mock;

beforeEach(() => {
  delete process.env.GITHUB_ACTIONS;
  delete process.env.AWS_PROFILE;

  mockSend = jest.fn();
  jest.mocked(CloudWatchLogsClient).mockImplementation(() => ({ send: mockSend }) as unknown as CloudWatchLogsClient);
});

afterEach(() => {
  jest.clearAllMocks();
});

// NOTE: tests use nextToken on resolved calls to keep the loop polling without
// hitting the setTimeout delay, allowing tests to run synchronously.

describe('logs()', () => {
  it('tails and prints log events with ISO timestamps', async () => {
    const ts = new Date('2024-01-01T00:00:00Z').getTime();
    mockSend
      .mockResolvedValueOnce({ events: [{ timestamp: ts, message: 'lambda started\n' }], nextToken: 'tok' })
      .mockRejectedValueOnce(new Error('stop'));

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    await expect(logs('dev')).rejects.toThrow('stop');

    const output = consoleSpy.mock.calls.flat().join('\n');
    expect(output).toContain('2024-01-01T00:00:00.000Z');
    expect(output).toContain('lambda started');

    consoleSpy.mockRestore();
  });

  it('continues polling while nextToken is returned', async () => {
    mockSend
      .mockResolvedValueOnce({ events: [{ timestamp: 1000, message: 'first' }],  nextToken: 'tok-1' })
      .mockResolvedValueOnce({ events: [{ timestamp: 2000, message: 'second' }], nextToken: 'tok-2' })
      .mockRejectedValueOnce(new Error('stop'));

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    await expect(logs('dev')).rejects.toThrow('stop');

    const output = consoleSpy.mock.calls.flat().join('\n');
    expect(output).toContain('first');
    expect(output).toContain('second');
    expect(mockSend).toHaveBeenCalledTimes(3);

    consoleSpy.mockRestore();
  });

  it('exits with code 1 on ResourceNotFoundException', async () => {
    mockSend.mockRejectedValueOnce(new Error('ResourceNotFoundException: log group not found'));

    const exitSpy  = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit(1)'); });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'log').mockImplementation();

    await expect(logs('dev')).rejects.toThrow('process.exit(1)');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));

    jest.restoreAllMocks();
  });

  it('re-throws unexpected errors', async () => {
    mockSend.mockRejectedValueOnce(new Error('network error'));

    jest.spyOn(console, 'log').mockImplementation();

    await expect(logs('dev')).rejects.toThrow('network error');

    jest.restoreAllMocks();
  });

  it('sleeps and continues polling when nextToken is missing', async () => {
    // Instead of fake timers (which can be sensitive to scheduling order),
    // make setTimeout resolve immediately so the polling loop continues.
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((cb) => {
      (cb as () => void)();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });

    try {
      mockSend
        .mockResolvedValueOnce({ events: [{ timestamp: 1000, message: 'no token\n' }] })
        .mockRejectedValueOnce(new Error('stop'));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const promise = logs('dev');
      await expect(promise).rejects.toThrow('stop');

      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('no token');
      consoleSpy.mockRestore();
    } finally {
      setTimeoutSpy.mockRestore();
    }
  });

  it('re-throws non-Error values', async () => {
    mockSend.mockRejectedValueOnce('stop');

    jest.spyOn(console, 'log').mockImplementation();

    await expect(logs('dev')).rejects.toBe('stop');

    jest.restoreAllMocks();
  });

  it('handles missing events/timestamp/message and skips AWS_PROFILE when profile is absent', async () => {
    // `config` is cached by `require('config')`, so env switching may not fully remove `aws.profile`.
    // Setting `GITHUB_ACTIONS` forces `isProfileRequired` to be false and makes `profile` undefined.
    process.env.GITHUB_ACTIONS = '1';

    mockSend
      .mockResolvedValueOnce({ nextToken: 'tok-1' })
      .mockResolvedValueOnce({
        events: [{ timestamp: undefined, message: undefined }],
        nextToken: 'tok-2',
      })
      .mockRejectedValueOnce(new Error('stop'));

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    await expect(logs('dev')).rejects.toThrow('stop');

    expect(process.env.AWS_PROFILE).toBeUndefined();

    const output = consoleSpy.mock.calls.flat().join('\n');
    expect(output).toContain('1970-01-01T00:00:00.000Z');
    consoleSpy.mockRestore();
  });
});
