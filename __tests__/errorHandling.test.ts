import { Alert, Platform } from 'react-native';
import {
  ErrorCode,
  createAppError,
  debounceError,
  getErrorMessage,
  getPlatformSpecificError,
  handleAsyncError,
  isAppError,
  isNetworkError,
  isPermissionError,
  retryWithBackoff,
  safeJsonParse,
  safeJsonStringify,
  showErrorAlert,
  validateTemplateName,
  validateUrl,
  validateVideoUrl,
  withErrorLogging,
} from '@/utils/errorHandling';

jest.mock('react-native', () => {
  return {
    Alert: { alert: jest.fn() },
    Platform: { OS: 'ios', select: (obj: Record<string, unknown>) => obj.ios },
  };
});

const setPlatformOS = (os: string) => {
  (Platform as { OS: string }).OS = os;
};

describe('errorHandling utilities', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    (Alert.alert as jest.Mock).mockClear();
    setPlatformOS('ios');
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
    jest.useRealTimers();
  });

  test('createAppError returns structured error and logs', () => {
    const original = new Error('boom');
    const appError = createAppError(ErrorCode.NETWORK, 'Network failed', original, false);

    expect(appError).toEqual(
      expect.objectContaining({
        code: ErrorCode.NETWORK,
        message: 'Network failed',
        originalError: original,
        recoverable: false,
      })
    );
    expect(appError.timestamp).toEqual(expect.any(String));
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  test('createAppError falls back to error message for blank input', () => {
    const original = new Error('Fallback message');
    const appError = createAppError(ErrorCode.UNKNOWN, '   ', original);
    expect(appError.message).toBe('Fallback message');
  });

  test('getErrorMessage handles common error shapes', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');

    const namedError = new Error('');
    namedError.name = 'CustomError';
    expect(getErrorMessage(namedError)).toBe('CustomError');

    expect(getErrorMessage('plain')).toBe('plain');
    expect(getErrorMessage({ message: 'oops' })).toBe('oops');
    expect(getErrorMessage({ error: 'bad' })).toBe('bad');
    expect(getErrorMessage({ reason: 'why' })).toBe('why');
    expect(getErrorMessage(42)).toBe('42');
    expect(getErrorMessage({ code: 'E_FAIL' })).toContain('E_FAIL');
  });

  test('isNetworkError detects network-related issues', () => {
    expect(isNetworkError(new Error('Network request failed'))).toBe(true);
    expect(isNetworkError({ code: 'ECONNREFUSED' })).toBe(true);
  });

  test('isPermissionError detects permission-related issues', () => {
    expect(isPermissionError(new Error('Permission denied'))).toBe(true);
    expect(isPermissionError({ code: 'EACCES' })).toBe(true);
    expect(isPermissionError({ name: 'NotAllowedError' })).toBe(true);
  });

  test('handleAsyncError returns data on success', async () => {
    const [data, error] = await handleAsyncError(Promise.resolve(5), ErrorCode.NETWORK);
    expect(data).toBe(5);
    expect(error).toBeNull();
  });

  test('handleAsyncError wraps errors and preserves AppError', async () => {
    const [data, error] = await handleAsyncError(Promise.reject(new Error('fail')), ErrorCode.STORAGE);
    expect(data).toBeNull();
    expect(error?.code).toBe(ErrorCode.STORAGE);
    expect(error?.message).toBe('fail');

    const appError = createAppError(ErrorCode.INVALID_INPUT, 'Invalid input');
    const [data2, error2] = await handleAsyncError(Promise.reject(appError), ErrorCode.UNKNOWN);
    expect(data2).toBeNull();
    expect(error2).toBe(appError);
    expect(isAppError(error2)).toBe(true);
  });

  test('showErrorAlert uses default button and handlers', () => {
    showErrorAlert('Title', 'Message');
    expect(Alert.alert).toHaveBeenCalledWith('Title', 'Message', [{ text: 'OK' }]);

    const onRetry = jest.fn();
    const onCancel = jest.fn();
    showErrorAlert('Oops', 'Try again', onRetry, onCancel);
    expect(Alert.alert).toHaveBeenCalledWith('Oops', 'Try again', [
      { text: 'Cancel', style: 'cancel', onPress: onCancel },
      { text: 'Retry', onPress: onRetry },
    ]);
  });

  test('validateUrl rejects invalid input and accepts valid URLs', () => {
    expect(validateUrl('')).toEqual({ valid: false, error: 'URL cannot be empty' });
    expect(validateUrl('example.com').valid).toBe(false);
    expect(validateUrl('https://example.com').valid).toBe(true);
    expect(validateUrl('blob:https://example.com/id').valid).toBe(true);
    expect(validateUrl('data:text/plain,hello').valid).toBe(true);
  });

  test('validateVideoUrl respects URL validation and extensions', () => {
    expect(validateVideoUrl('example.com').valid).toBe(false);
    expect(validateVideoUrl('https://example.com/video.mp4').valid).toBe(true);
  });

  test('validateTemplateName enforces trimming and length', () => {
    expect(validateTemplateName('')).toEqual({ valid: false, error: 'Template name is required' });
    expect(validateTemplateName('  ')).toEqual({ valid: false, error: 'Template name cannot be empty' });
    expect(validateTemplateName('a')).toEqual({ valid: false, error: 'Template name must be at least 2 characters' });
    expect(validateTemplateName('Valid Name')).toEqual({ valid: true });
  });

  test('safeJsonParse and safeJsonStringify handle errors safely', () => {
    consoleErrorSpy.mockClear();
    expect(safeJsonParse('{"ok":true}', { ok: false })).toEqual({ ok: true });
    expect(safeJsonParse('', { ok: false })).toEqual({ ok: false });

    const invalid = safeJsonParse('{bad json}', { ok: false });
    expect(invalid).toEqual({ ok: false });
    expect(consoleErrorSpy).toHaveBeenCalled();

    const json = safeJsonStringify({ a: 1 });
    expect(json).toBe('{"a":1}');
    expect(safeJsonStringify(undefined)).toBeNull();

    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(safeJsonStringify(circular)).toBeNull();
  });

  test('withErrorLogging logs and rethrows sync and async errors', async () => {
    const syncFn = withErrorLogging(() => {
      throw new Error('sync fail');
    }, 'SyncTest');
    expect(() => syncFn()).toThrow('sync fail');
    expect(consoleErrorSpy).toHaveBeenCalledWith('[SyncTest] Sync error:', expect.any(Error));

    consoleErrorSpy.mockClear();
    const asyncFn = withErrorLogging(async () => {
      throw new Error('async fail');
    }, 'AsyncTest');
    await expect(asyncFn()).rejects.toThrow('async fail');
    expect(consoleErrorSpy).toHaveBeenCalledWith('[AsyncTest] Async error:', expect.any(Error));
  });

  test('retryWithBackoff retries before succeeding', async () => {
    jest.useFakeTimers();
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('ok');

    const promise = retryWithBackoff(fn, 3, 1000);

    await Promise.resolve();
    jest.runOnlyPendingTimers();
    await Promise.resolve();
    jest.runOnlyPendingTimers();
    await Promise.resolve();

    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test('debounceError skips duplicates within delay', () => {
    jest.useFakeTimers();
    const handler = jest.fn();
    const debounced = debounceError(handler, 1000);
    const error = createAppError(ErrorCode.UNKNOWN, 'Boom');

    debounced(error);
    debounced(error);
    expect(handler).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1000);
    debounced(error);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  test('getPlatformSpecificError returns helpful web message', () => {
    setPlatformOS('web');
    expect(getPlatformSpecificError(new Error('getUserMedia failed'))).toContain('Camera/microphone access');
    expect(getPlatformSpecificError(new Error('DeviceMotion not supported'))).toContain('Motion sensors');

    setPlatformOS('ios');
    expect(getPlatformSpecificError(new Error('Some error'))).toBe('Some error');
  });
});
