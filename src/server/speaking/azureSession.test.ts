import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { SpeakingError, type SpeakingKind } from '../../shared/speaking/types';
import { recognizeAzure } from './azureSession';

function fixture(kind: SpeakingKind = 'sentence', cleanupThrows = false) {
  let open: (() => void) | undefined, connectionError: ((error: string) => void) | undefined;
  let once: ((result: sdk.SpeechRecognitionResult) => void) | undefined;
  const calls = { recognition: 0, close: 0 };
  const recognizer: Parameters<typeof recognizeAzure>[1] = {
    recognized: () => {}, canceled: () => {}, sessionStopped: () => {},
    recognizeOnceAsync: success => { calls.recognition++; once = success; },
    startContinuousRecognitionAsync: () => { calls.recognition++; },
    close: () => { calls.close++; if (cleanupThrows) throw new Error('SDK cleanup failed'); },
  };
  const connection: Parameters<typeof recognizeAzure>[2] = { openConnection: (success, failure) => { open = success; connectionError = failure; } };
  const promise = recognizeAzure(sdk, recognizer, connection, kind, 2);
  const sender = recognizer as sdk.SpeechRecognizer;
  return {
    promise, calls, connect: () => open!(), failConnection: (text: string) => connectionError!(text),
    once: (result: sdk.SpeechRecognitionResult) => once!(result),
    phrase: (result: sdk.SpeechRecognitionResult) => recognizer.recognized(sender, { result } as sdk.SpeechRecognitionEventArgs),
    stop: () => recognizer.sessionStopped(sender, {} as sdk.SessionEventArgs),
    cancel: (errorCode: sdk.CancellationErrorCode, reason = sdk.CancellationReason.Error) => recognizer.canceled(sender, { reason, errorCode, errorDetails: 'private SDK endpoint' } as sdk.SpeechRecognitionCanceledEventArgs),
  };
}
function result(payload: unknown, reason = sdk.ResultReason.RecognizedSpeech) {
  const properties = new sdk.PropertyCollection();
  properties.setProperty(sdk.PropertyId.SpeechServiceResponse_JsonResult, typeof payload === 'string' ? payload : JSON.stringify(payload));
  return new sdk.SpeechRecognitionResult('fixture', reason, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, properties);
}
const expectCode = (promise: Promise<unknown>, code: string) => assert.rejects(promise, (error: SpeakingError) => error instanceof SpeakingError && error.code === code);

test('stalled Azure handshake fails promptly without starting recognition; late connection cannot send audio', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(), rejection = expectCode(f.promise, 'PROVIDER_CONNECTION');
  t.mock.timers.tick(14999); assert.equal(f.calls.recognition, 0); assert.equal(f.calls.close, 0);
  t.mock.timers.tick(1); await rejection;
  f.connect(); f.stop(); f.cancel(sdk.CancellationErrorCode.ConnectionFailure);
  assert.deepEqual(f.calls, { recognition: 0, close: 1 });
});

test('continuous recognition keeps every phrase until the service ends the session', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture('passage');
  t.mock.timers.tick(14000); f.connect(); f.connect();
  assert.equal(f.calls.recognition, 1, 'A repeated connection callback cannot start a second assessment');
  t.mock.timers.tick(2000); assert.equal(f.calls.close, 0, 'The connection timer is cleared after connecting');
  f.phrase(result({ NBest: [{ Display: 'First sentence.' }] }));
  f.phrase(result({}, sdk.ResultReason.NoMatch));
  f.phrase(result({ NBest: [{ Display: 'Second sentence.' }] }));
  assert.equal(f.calls.close, 0, 'A phrase does not prematurely end a passage');
  f.cancel(sdk.CancellationErrorCode.NoError, sdk.CancellationReason.EndOfStream); f.stop();
  assert.deepEqual(await f.promise, [{ NBest: [{ Display: 'First sentence.' }] }, { NBest: [{ Display: 'Second sentence.' }] }]);
  assert.equal(f.calls.close, 1);
  t.mock.timers.tick(360000); assert.equal(f.calls.close, 1);
});

test('an Azure session that connects but never ends fails without grading partial results', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(), rejection = expectCode(f.promise, 'PROVIDER_TIMEOUT'); f.connect();
  f.phrase(result({ NBest: [{ Display: 'Partial result.' }] }));
  t.mock.timers.tick(62000); await rejection;
  f.phrase(result({ NBest: [{ Display: 'Late result.' }] })); f.stop();
  assert.deepEqual(f.calls, { recognition: 1, close: 1 });
});

test('continuous Azure cancellation preserves network/auth/quota/timeout categories without SDK secrets', async () => {
  for (const [code, expected] of [
    [sdk.CancellationErrorCode.AuthenticationFailure, 'PROVIDER_AUTH'],
    [sdk.CancellationErrorCode.Forbidden, 'PROVIDER_QUOTA'],
    [sdk.CancellationErrorCode.TooManyRequests, 'PROVIDER_BUSY'],
    [sdk.CancellationErrorCode.ConnectionFailure, 'PROVIDER_CONNECTION'],
    [sdk.CancellationErrorCode.ServiceTimeout, 'PROVIDER_TIMEOUT'],
    [sdk.CancellationErrorCode.BadRequestParameters, 'PROVIDER_REQUEST'],
    [sdk.CancellationErrorCode.ServiceError, 'PROVIDER_FAILED'],
  ] as const) {
    const f = fixture(), rejected = assert.rejects(f.promise, (error: SpeakingError) => error.code === expected && !error.message.includes('private SDK endpoint'));
    f.connect(); f.cancel(code); await rejected; assert.equal(f.calls.close, 1);
  }
});

test('connection callbacks distinguish known HTTP failures without exposing an authenticated URL', async () => {
  for (const [status, code] of [[401, 'PROVIDER_AUTH'], [403, 'PROVIDER_QUOTA'], [429, 'PROVIDER_BUSY'], [1006, 'PROVIDER_CONNECTION']] as const) {
    const f = fixture(), rejection = assert.rejects(f.promise, (error: SpeakingError) => error.code === code && !error.message.includes('fixture-secret'));
    f.failConnection(`StatusCode: ${status} wss://fixture/?key=fixture-secret`); await rejection;
    assert.deepEqual(f.calls, { recognition: 0, close: 1 });
  }
});

test('word recognition uses the SDK cancellation details instead of reporting a network failure as no speech', async () => {
  const f = fixture('word'), rejection = expectCode(f.promise, 'PROVIDER_AUTH'); f.connect();
  const properties = new sdk.PropertyCollection(); properties.setProperty('CancellationErrorCode', 'AuthenticationFailure');
  const canceled = new sdk.SpeechRecognitionResult('fixture', sdk.ResultReason.Canceled, undefined, undefined, undefined, undefined, undefined, undefined, 'private SDK endpoint', undefined, properties);
  f.once(canceled); await rejection; assert.equal(f.calls.close, 1);
  const invalid = fixture('word'), invalidRejection = expectCode(invalid.promise, 'PROVIDER_RESPONSE'); invalid.connect();
  invalid.once(new sdk.SpeechRecognitionResult('fixture', sdk.ResultReason.Canceled, undefined, undefined, undefined, undefined, undefined, undefined, undefined, '{invalid', properties));
  await invalidRejection; assert.equal(invalid.calls.close, 1);
});

test('word success and no-match retain their existing result contracts', async () => {
  const word = fixture('word'); word.connect(); word.once(result({ NBest: [{ Display: 'apple' }] }));
  assert.deepEqual(await word.promise, [{ NBest: [{ Display: 'apple' }] }]);
  const silent = fixture('word'); silent.connect(); silent.once(result({}, sdk.ResultReason.NoMatch));
  assert.deepEqual(await silent.promise, []);
});

test('malformed Azure JSON fails before a later session-stop can publish a successful result', async () => {
  const f = fixture(), rejection = expectCode(f.promise, 'PROVIDER_RESPONSE'); f.connect(); f.phrase(result('{invalid')); f.stop();
  await rejection; assert.equal(f.calls.close, 1);
});

test('SDK cleanup failure cannot leave a failed job pending or replace its cause', async t => {
  const warnings: string[] = []; t.mock.method(console, 'warn', value => warnings.push(value));
  const f = fixture('sentence', true), rejection = expectCode(f.promise, 'PROVIDER_CONNECTION');
  f.failConnection('private SDK endpoint'); await rejection;
  assert.equal(f.calls.close, 1); assert.deepEqual(warnings, ['[Speaking/Azure] Recognizer cleanup failed.']);
});
