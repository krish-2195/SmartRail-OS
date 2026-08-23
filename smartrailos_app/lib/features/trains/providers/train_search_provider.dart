import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/metro_data.dart';
import '../../../core/services/api_service.dart';
import '../models/train_model.dart';
import '../models/announcement_model.dart';

final selectedLineProvider = StateProvider<MetroLine>((ref) => MetroLine.blue);
final fromStationProvider = StateProvider<Station?>((ref) => null);
final toStationProvider = StateProvider<Station?>((ref) => null);

/// Polls the backend every 5 seconds (matching the simulation tick).
/// This keeps the live passenger count from the ESP32 sensor in sync
/// with the Flutter UI automatically — no manual refresh needed.
final trainResultsProvider = StreamProvider.family<List<TrainModel>, ({String lineId, String fromStationId, String toStationId})>((ref, params) async* {
  final api = ref.read(apiServiceProvider);
  final line = MetroLine.values.firstWhere(
    (e) => e.name.toLowerCase() == params.lineId.toLowerCase(),
    orElse: () => MetroLine.blue,
  );

  List<TrainModel> lastTrains = [];

  // Yield immediately on invocation
  try {
    lastTrains = await api.getUpcomingTrains(line, params.fromStationId, params.toStationId);
    yield lastTrains;
  } catch (e) {
    if (lastTrains.isEmpty) rethrow;
  }

  // Then poll every 5 seconds
  while (true) {
    await Future.delayed(const Duration(seconds: 5));
    try {
      lastTrains = await api.getUpcomingTrains(line, params.fromStationId, params.toStationId);
      yield lastTrains;
    } catch (_) {
      // Retain last known state on transient mobile data / tunnel drops
      if (lastTrains.isNotEmpty) {
        yield lastTrains;
      }
    }
  }
});


typedef TrainDetailParams = ({
  String trainId,
  String fromStationId,
  String toStationId,
  String lineId,
});

/// Auto-refreshing live telemetry stream provider for individual trains.
/// Polls the server every 4 seconds to sync passenger counts, stops, and ETA.
final liveTrainDetailProvider = StreamProvider.autoDispose.family<TrainModel, TrainDetailParams>((ref, params) {
  final api = ref.read(apiServiceProvider);
  final line = MetroLine.values.firstWhere(
    (e) => e.name == params.lineId,
    orElse: () => MetroLine.blue,
  );

  Future<TrainModel> fetch() async {
    if (params.fromStationId.isNotEmpty && params.toStationId.isNotEmpty) {
      try {
        final upcoming = await api.getUpcomingTrains(line, params.fromStationId, params.toStationId);
        final match = upcoming.firstWhere(
          (t) => t.trainId == params.trainId,
          orElse: () => upcoming.first,
        );
        return match;
      } catch (_) {}
    }
    return await api.getTrainDetail(params.trainId);
  }

  final controller = StreamController<TrainModel>();
  Timer? timer;

  fetch().then((t) {
    if (!controller.isClosed) controller.add(t);
  }).catchError((_) {});

  timer = Timer.periodic(const Duration(seconds: 4), (_) async {
    try {
      final t = await fetch();
      if (!controller.isClosed) controller.add(t);
    } catch (_) {}
  });

  ref.onDispose(() {
    timer?.cancel();
    controller.close();
  });

  return controller.stream;
});

final trainDetailProvider = FutureProvider.family<TrainModel, String>((ref, trainId) async {
  return ref.read(apiServiceProvider).getTrainDetail(trainId);
});

final announcementsProvider = FutureProvider.family<List<AnnouncementModel>, String>((ref, stationId) async {
  return ref.read(apiServiceProvider).getActiveAnnouncements(stationId);
});
