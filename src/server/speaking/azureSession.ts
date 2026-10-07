import type * as Azure from 'microsoft-cognitiveservices-speech-sdk';
import { SpeakingError, type SpeakingKind } from '../../shared/speaking/types';

type AzureSdk = Pick<typeof Azure, 'ResultReason' | 'PropertyId' | 'CancellationReason' | 'CancellationErrorCode' | 'CancellationDetails'>;
type Recognizer = Pick<Azure.SpeechRecognizer, 'recognized' | 'canceled' | 'sessionStopped' | 'recognizeOnceAsync' | 'startContinuousRecognitionAsync' | 'close'>;
type Connection = Pick<Azure.Connection, 'openConnection'>;

function cancellationError(sdk: AzureSdk, code: Azure.CancellationErrorCode): SpeakingError {
  switch (code) {
    case sdk.CancellationErrorCode.AuthenticationFailure:
      return new SpeakingError(503, 'PROVIDER_AUTH', 'Azure từ chối xác thực. Giáo viên cần kiểm tra khóa và vùng dịch vụ.');
    case sdk.CancellationErrorCode.Forbidden:
      return new SpeakingError(503, 'PROVIDER_QUOTA', 'Azure chưa cho phép chấm bản thu. Giáo viên cần kiểm tra quyền và hạn mức dịch vụ.');
    case sdk.CancellationErrorCode.TooManyRequests:
      return new SpeakingError(503, 'PROVIDER_BUSY', 'Azure đang bận. Bản thu được giữ; em có thể yêu cầu chấm lại sau.');
    case sdk.CancellationErrorCode.ConnectionFailure:
      return new SpeakingError(502, 'PROVIDER_CONNECTION', 'Máy chủ chưa kết nối được Azure. Bản thu được giữ; em có thể yêu cầu chấm lại sau.');
    case sdk.CancellationErrorCode.ServiceTimeout:
      return new SpeakingError(504, 'PROVIDER_TIMEOUT', 'Azure chưa hoàn tất chấm trong thời gian cho phép. Bản thu được giữ; em có thể yêu cầu chấm lại.');
    case sdk.CancellationErrorCode.BadRequestParameters:
      return new SpeakingError(502, 'PROVIDER_REQUEST', 'Azure không nhận được yêu cầu chấm hợp lệ. Giáo viên cần kiểm tra cấu hình bài.');
    default:
      return new SpeakingError(502, 'PROVIDER_FAILED', 'Azure gián đoạn khi chấm. Bản thu được giữ; em có thể yêu cầu chấm lại.');
  }
}

/** Bound connection separately: a stalled SDK handshake must not occupy the grader for minutes. */
export function recognizeAzure(sdk: AzureSdk, recognizer: Recognizer, connection: Connection, kind: SpeakingKind, durationSeconds: number): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const payloads: unknown[] = [];
    let done = false, started = false;
    let connectionTimer: ReturnType<typeof setTimeout> | undefined;
    let assessmentTimer: ReturnType<typeof setTimeout> | undefined;
    const cleanupFailure = () => console.warn('[Speaking/Azure] Recognizer cleanup failed.');
    const finish = (error?: SpeakingError) => {
      if (done) return;
      done = true;
      clearTimeout(connectionTimer); clearTimeout(assessmentTimer);
      // Settle even when SDK cleanup throws or never completes; retain the original outcome.
      error ? reject(error) : resolve(payloads);
      try { recognizer.close(undefined, cleanupFailure); } catch { cleanupFailure(); }
    };
    const collect = (result: Azure.SpeechRecognitionResult) => {
      if (done || result.reason !== sdk.ResultReason.RecognizedSpeech) return;
      try { payloads.push(JSON.parse(result.properties.getProperty(sdk.PropertyId.SpeechServiceResponse_JsonResult))); }
      catch { finish(new SpeakingError(502, 'PROVIDER_RESPONSE', 'Kết quả Azure không hợp lệ.')); }
    };
    recognizer.recognized = (_s, e) => collect(e.result);
    recognizer.canceled = (_s, e) => {
      if (done) return;
      e.reason === sdk.CancellationReason.Error ? finish(cancellationError(sdk, e.errorCode)) : finish();
    };
    recognizer.sessionStopped = () => finish();
    const connectionFailed = (details = '') => {
      // SDK connection callbacks expose text instead of a cancellation code. Never return/log it:
      // it can include the authenticated endpoint. Only classify known HTTP status codes.
      const code = /\b401\b/.test(details) ? sdk.CancellationErrorCode.AuthenticationFailure
        : /\b403\b/.test(details) ? sdk.CancellationErrorCode.Forbidden
          : /\b429\b/.test(details) ? sdk.CancellationErrorCode.TooManyRequests : sdk.CancellationErrorCode.ConnectionFailure;
      finish(cancellationError(sdk, code));
    };
    connectionTimer = setTimeout(() => finish(cancellationError(sdk, sdk.CancellationErrorCode.ConnectionFailure)), 15000);
    try {
      // Opening a connection alone does not send the WAV or start a billable assessment.
      connection.openConnection(() => {
        if (done || started) return;
        started = true; clearTimeout(connectionTimer);
        assessmentTimer = setTimeout(() => finish(cancellationError(sdk, sdk.CancellationErrorCode.ServiceTimeout)), Math.min(360000, durationSeconds * 1000 + 60000));
        try {
          if (kind === 'word') recognizer.recognizeOnceAsync(result => {
            if (done) return;
            if (result.reason === sdk.ResultReason.Canceled) {
              try {
                const cancellation = sdk.CancellationDetails.fromResult(result);
                finish(cancellation.reason === sdk.CancellationReason.Error ? cancellationError(sdk, cancellation.ErrorCode) : undefined);
              } catch { finish(new SpeakingError(502, 'PROVIDER_RESPONSE', 'Kết quả Azure không hợp lệ.')); }
            } else { collect(result); finish(); }
          }, () => finish(cancellationError(sdk, sdk.CancellationErrorCode.RuntimeError)));
          else recognizer.startContinuousRecognitionAsync(undefined, () => finish(cancellationError(sdk, sdk.CancellationErrorCode.RuntimeError)));
        } catch { finish(cancellationError(sdk, sdk.CancellationErrorCode.RuntimeError)); }
      }, connectionFailed);
    } catch { connectionFailed(); }
  });
}
