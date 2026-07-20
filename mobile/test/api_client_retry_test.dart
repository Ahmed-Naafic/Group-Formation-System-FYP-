import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:group_formation/app/data/providers/api_client.dart';

const _secureStorageChannel = MethodChannel(
  'plugins.it_nomads.com/flutter_secure_storage',
);

// Fails with a connection error the first N times, then succeeds.
class _FlakyThenOkAdapter implements HttpClientAdapter {
  int callCount = 0;
  final int failCount;
  _FlakyThenOkAdapter(this.failCount);

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    callCount++;
    if (callCount <= failCount) {
      throw DioException(
        requestOptions: options,
        type: DioExceptionType.connectionError,
        error: 'Simulated connection failure #$callCount',
      );
    }
    return ResponseBody.fromString(
      '{"ok":true}',
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

// Always returns a real application error (404) — must never be retried.
class _AlwaysNotFoundAdapter implements HttpClientAdapter {
  int callCount = 0;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    callCount++;
    return ResponseBody.fromString(
      '{"error":"not found"}',
      404,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  // ApiClient's auth interceptor reads a token from flutter_secure_storage on
  // every request — there's no real platform implementation in the test
  // harness, so stub the channel to behave like "no token stored".
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(_secureStorageChannel, (call) async => null);

  test('retries a connection failure with backoff, then resolves', () async {
    final client = ApiClient();
    final adapter = _FlakyThenOkAdapter(2);
    client.dio.httpClientAdapter = adapter;

    final sw = Stopwatch()..start();
    final response = await client.dio.get('/health');
    sw.stop();

    expect(response.statusCode, 200);
    expect(adapter.callCount, 3); // 2 failures + 1 success
    // The first two retry delays (5s + 8s) must actually have been waited out.
    expect(sw.elapsed, greaterThanOrEqualTo(const Duration(seconds: 13)));
  }, timeout: const Timeout(Duration(seconds: 30)));

  test('does not retry a genuine application error (404)', () async {
    final client = ApiClient();
    final adapter = _AlwaysNotFoundAdapter();
    client.dio.httpClientAdapter = adapter;

    final sw = Stopwatch()..start();
    await expectLater(
      () => client.dio.get('/health'),
      throwsA(isA<DioException>()),
    );
    sw.stop();

    expect(adapter.callCount, 1); // no retry attempted
    expect(sw.elapsed, lessThan(const Duration(seconds: 2)));
  });
}
