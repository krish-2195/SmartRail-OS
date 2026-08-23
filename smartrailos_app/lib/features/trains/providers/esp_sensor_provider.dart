import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_config.dart';
import '../../../core/services/api_service.dart';
import '../models/esp_sensor_model.dart';

class EspSensorTelemetryState {
  final EspSensorModel? sensor;
  final bool isConnected;
  final bool isLoading;
  final String activeHost;
  final DateTime? lastSyncTime;
  final String? errorMessage;
  final List<Map<String, dynamic>> recentEvents;

  const EspSensorTelemetryState({
    this.sensor,
    this.isConnected = false,
    this.isLoading = false,
    required this.activeHost,
    this.lastSyncTime,
    this.errorMessage,
    this.recentEvents = const [],
  });

  EspSensorTelemetryState copyWith({
    EspSensorModel? sensor,
    bool? isConnected,
    bool? isLoading,
    String? activeHost,
    DateTime? lastSyncTime,
    String? errorMessage,
    List<Map<String, dynamic>>? recentEvents,
    bool clearError = false,
  }) {
    return EspSensorTelemetryState(
      sensor: sensor ?? this.sensor,
      isConnected: isConnected ?? this.isConnected,
      isLoading: isLoading ?? this.isLoading,
      activeHost: activeHost ?? this.activeHost,
      lastSyncTime: lastSyncTime ?? this.lastSyncTime,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      recentEvents: recentEvents ?? this.recentEvents,
    );
  }
}

class EspSensorTelemetryNotifier extends StateNotifier<EspSensorTelemetryState> {
  final ApiService _apiService;
  Timer? _pollingTimer;
  int _tickCount = 0;
  bool _isFetching = false;

  EspSensorTelemetryNotifier(this._apiService)
      : super(EspSensorTelemetryState(activeHost: AppConfig.baseUrl)) {
    _startPolling();
  }

  void _startPolling() {
    _pollingTimer?.cancel();
    // Initial fetch immediately
    fetchTelemetry(showLoading: true);
    // Continuous live polling every 1200ms for instantaneous live updates
    _pollingTimer = Timer.periodic(const Duration(milliseconds: 1200), (_) {
      if (!mounted) return;
      _tickCount++;
      fetchTelemetry(fetchEvents: _tickCount % 2 == 0);
    });
  }

  Future<void> fetchTelemetry({bool showLoading = false, bool fetchEvents = false}) async {
    if (_isFetching || !mounted) return;
    _isFetching = true;

    if (showLoading && state.sensor == null && mounted) {
      state = state.copyWith(isLoading: true);
    }

    try {
      final sensor = await _apiService.getEsp32Live();
      if (!mounted) return;

      if (sensor != null) {
        List<Map<String, dynamic>> events = state.recentEvents;
        if (fetchEvents || state.recentEvents.isEmpty) {
          try {
            final evts = await _apiService.getEsp32Events();
            if (evts.isNotEmpty) events = evts;
          } catch (_) {}
        }

        if (mounted) {
          state = state.copyWith(
            sensor: sensor,
            isConnected: true,
            isLoading: false,
            activeHost: AppConfig.baseUrl,
            lastSyncTime: DateTime.now(),
            recentEvents: events,
            clearError: true,
          );
        }
      } else {
        // Try auto-discovering working URL
        final discovered = await AppConfig.discoverWorkingUrl();
        if (discovered != null && mounted) {
          final retried = await _apiService.getEsp32Live();
          if (retried != null && mounted) {
            state = state.copyWith(
              sensor: retried,
              isConnected: true,
              isLoading: false,
              activeHost: discovered,
              lastSyncTime: DateTime.now(),
              clearError: true,
            );
            _isFetching = false;
            return;
          }
        }

        if (mounted) {
          state = state.copyWith(
            isConnected: false,
            isLoading: false,
            errorMessage: 'Cannot connect to ESP32 backend at ${AppConfig.baseUrl}',
          );
        }
      }
    } catch (e) {
      if (mounted) {
        state = state.copyWith(
          isConnected: false,
          isLoading: false,
          errorMessage: e.toString(),
        );
      }
    } finally {
      _isFetching = false;
    }
  }

  Future<bool> setServerUrl(String newUrl) async {
    await AppConfig.setCustomBaseUrl(newUrl);
    if (mounted) {
      state = state.copyWith(activeHost: AppConfig.baseUrl, isLoading: true);
    }
    await fetchTelemetry(showLoading: true, fetchEvents: true);
    return state.isConnected;
  }

  Future<void> triggerCrossing({
    required String direction,
    int inDelta = 0,
    int outDelta = 0,
    String? stationId,
  }) async {
    try {
      await _apiService.sendEsp32Telemetry(
        direction: direction,
        inDelta: inDelta,
        outDelta: outDelta,
        stationId: stationId,
      );
      await fetchTelemetry(fetchEvents: true);
    } catch (e) {
      debugPrint('Error triggering sensor pulse: $e');
    }
  }

  Future<void> resetCounters() async {
    try {
      await _apiService.resetEsp32Counters();
      await fetchTelemetry(fetchEvents: true);
    } catch (e) {
      debugPrint('Error resetting sensor counters: $e');
    }
  }

  void refresh() {
    fetchTelemetry(showLoading: true, fetchEvents: true);
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    _pollingTimer = null;
    super.dispose();
  }
}

/// Central state notifier provider for all sensor telemetry
final espSensorTelemetryProvider =
    StateNotifierProvider.autoDispose<EspSensorTelemetryNotifier, EspSensorTelemetryState>((ref) {
  final apiService = ref.watch(apiServiceProvider);
  return EspSensorTelemetryNotifier(apiService);
});

/// Live sensor model stream provider for reactive UI consumption
final espSensorLiveProvider = StreamProvider.autoDispose<EspSensorModel?>((ref) async* {
  final state = ref.watch(espSensorTelemetryProvider);
  yield state.sensor;
});

/// Live events stream provider
final espSensorEventsProvider = StreamProvider.autoDispose<List<Map<String, dynamic>>>((ref) async* {
  final state = ref.watch(espSensorTelemetryProvider);
  yield state.recentEvents;
});

/// Compatibility action notifier provider
class EspSensorActionsNotifier extends StateNotifier<AsyncValue<void>> {
  final Ref _ref;

  EspSensorActionsNotifier(this._ref) : super(const AsyncData(null));

  Future<void> triggerCrossing({
    required String direction,
    int inDelta = 0,
    int outDelta = 0,
    String? stationId,
  }) async {
    state = const AsyncLoading();
    try {
      await _ref.read(espSensorTelemetryProvider.notifier).triggerCrossing(
            direction: direction,
            inDelta: inDelta,
            outDelta: outDelta,
            stationId: stationId,
          );
      state = const AsyncData(null);
    } catch (e, st) {
      state = AsyncError(e, st);
    }
  }

  Future<void> resetCounters() async {
    state = const AsyncLoading();
    try {
      await _ref.read(espSensorTelemetryProvider.notifier).resetCounters();
      state = const AsyncData(null);
    } catch (e, st) {
      state = AsyncError(e, st);
    }
  }

  void refresh() {
    _ref.read(espSensorTelemetryProvider.notifier).refresh();
  }
}

final espSensorActionsProvider =
    StateNotifierProvider.autoDispose<EspSensorActionsNotifier, AsyncValue<void>>((ref) {
  return EspSensorActionsNotifier(ref);
});
