import 'dart:math';
import '../../../core/constants/metro_data.dart';
import 'coach_model.dart';
import 'announcement_model.dart';

enum TrainStatus { normal, moderate, full, emergency }

class JourneyStopModel {
  final String stationId;
  final String stationName;
  final String arrivalTime;
  final String departureTime;
  final bool isPassed;
  final bool isCurrent;
  final bool isUserOrigin;
  final bool isUserDestination;
  final int predictedStationCrowd;
  final int estimatedTrainOccupancy;

  JourneyStopModel({
    required this.stationId,
    required this.stationName,
    required this.arrivalTime,
    required this.departureTime,
    this.isPassed = false,
    this.isCurrent = false,
    this.isUserOrigin = false,
    this.isUserDestination = false,
    this.predictedStationCrowd = 0,
    this.estimatedTrainOccupancy = 0,
  });

  factory JourneyStopModel.fromJson(Map<String, dynamic> json) {
    return JourneyStopModel(
      stationId: json['station_id'] ?? json['stationId'] ?? '',
      stationName: json['station_name'] ?? json['stationName'] ?? '',
      arrivalTime: json['arrival_time'] ?? json['arrivalTime'] ?? '',
      departureTime: json['departure_time'] ?? json['departureTime'] ?? '',
      isPassed: json['is_passed'] ?? json['isPassed'] ?? false,
      isCurrent: json['is_current'] ?? json['isCurrent'] ?? false,
      isUserOrigin: json['is_user_origin'] ?? json['isUserOrigin'] ?? false,
      isUserDestination: json['is_user_destination'] ?? json['isUserDestination'] ?? false,
      predictedStationCrowd: json['predicted_station_crowd'] ?? json['predictedStationCrowd'] ?? 0,
      estimatedTrainOccupancy: json['estimated_train_occupancy'] ?? json['estimatedTrainOccupancy'] ?? 0,
    );
  }
}

class TrainModel {
  final String trainId;
  final String displayName;
  final MetroLine line;
  final String direction;
  final int etaMinutes;
  final int departureMinutes;
  final List<CoachModel> coaches;
  final TrainStatus status;
  final int currentPositionIndex;
  final String fromStationId;
  final String toStationId;
  final List<AnnouncementModel> announcements;
  final String? arrivalTime;
  final String? departureTime;
  final bool isAtPlatform;
  final int? journeyDurationMinutes;
  final String? destinationName;
  final int? predictedStationCrowd;
  final String? liveCurrentStationId;
  final String? liveCurrentStationName;
  final String? liveNextStationId;
  final String? liveNextStationName;
  final String liveStatus;
  final double journeyProgressPct;
  final List<JourneyStopModel> stopsTimeline;

  TrainModel({
    required this.trainId,
    required this.displayName,
    required this.line,
    required this.direction,
    required this.etaMinutes,
    required this.departureMinutes,
    required this.coaches,
    required this.status,
    required this.currentPositionIndex,
    required this.fromStationId,
    required this.toStationId,
    required this.announcements,
    this.arrivalTime,
    this.departureTime,
    this.isAtPlatform = false,
    this.journeyDurationMinutes,
    this.destinationName,
    this.predictedStationCrowd,
    this.liveCurrentStationId,
    this.liveCurrentStationName,
    this.liveNextStationId,
    this.liveNextStationName,
    this.liveStatus = "SCHEDULED",
    this.journeyProgressPct = 0.0,
    this.stopsTimeline = const [],
  });

  int get totalPassengers => coaches.fold(0, (s, c) => s + c.currentPassengers);
  double get maxCoachFill => coaches.isEmpty ? 0 : coaches.map((c) => c.percentFull).reduce(max);

  TrainModel copyWith({
    String? trainId,
    String? displayName,
    MetroLine? line,
    String? direction,
    int? etaMinutes,
    int? departureMinutes,
    List<CoachModel>? coaches,
    TrainStatus? status,
    int? currentPositionIndex,
    String? fromStationId,
    String? toStationId,
    List<AnnouncementModel>? announcements,
    String? arrivalTime,
    String? departureTime,
    bool? isAtPlatform,
    int? journeyDurationMinutes,
    String? destinationName,
    int? predictedStationCrowd,
    String? liveCurrentStationId,
    String? liveCurrentStationName,
    String? liveNextStationId,
    String? liveNextStationName,
    String? liveStatus,
    double? journeyProgressPct,
    List<JourneyStopModel>? stopsTimeline,
  }) {
    return TrainModel(
      trainId: trainId ?? this.trainId,
      displayName: displayName ?? this.displayName,
      line: line ?? this.line,
      direction: direction ?? this.direction,
      etaMinutes: etaMinutes ?? this.etaMinutes,
      departureMinutes: departureMinutes ?? this.departureMinutes,
      coaches: coaches ?? this.coaches,
      status: status ?? this.status,
      currentPositionIndex: currentPositionIndex ?? this.currentPositionIndex,
      fromStationId: fromStationId ?? this.fromStationId,
      toStationId: toStationId ?? this.toStationId,
      announcements: announcements ?? this.announcements,
      arrivalTime: arrivalTime ?? this.arrivalTime,
      departureTime: departureTime ?? this.departureTime,
      isAtPlatform: isAtPlatform ?? this.isAtPlatform,
      journeyDurationMinutes: journeyDurationMinutes ?? this.journeyDurationMinutes,
      destinationName: destinationName ?? this.destinationName,
      predictedStationCrowd: predictedStationCrowd ?? this.predictedStationCrowd,
      liveCurrentStationId: liveCurrentStationId ?? this.liveCurrentStationId,
      liveCurrentStationName: liveCurrentStationName ?? this.liveCurrentStationName,
      liveNextStationId: liveNextStationId ?? this.liveNextStationId,
      liveNextStationName: liveNextStationName ?? this.liveNextStationName,
      liveStatus: liveStatus ?? this.liveStatus,
      journeyProgressPct: journeyProgressPct ?? this.journeyProgressPct,
      stopsTimeline: stopsTimeline ?? this.stopsTimeline,
    );
  }

  factory TrainModel.fromJson(Map<String, dynamic> json) {
    return TrainModel(
      trainId: json['trainId'] ?? json['train_id'] ?? '',
      displayName: json['displayName'] ?? json['train_name'] ?? json['trainId'] ?? '',
      line: (json['line'] ?? json['line_name'] ?? '').toString().toLowerCase().contains('red') ? MetroLine.red : MetroLine.blue,
      direction: json['direction'] ?? 'UP',
      etaMinutes: json['etaMinutes'] ?? json['eta_minutes'] ?? 0,
      departureMinutes: json['departureMinutes'] ?? json['departure_minutes'] ?? 0,
      coaches: (json['coaches'] as List? ?? []).map((e) => CoachModel.fromJson(e)).toList(),
      status: TrainStatus.values.firstWhere(
        (e) => e.name == json['status'],
        orElse: () => TrainStatus.normal,
      ),
      currentPositionIndex: () {
        if (json['currentPositionIndex'] is int) return json['currentPositionIndex'] as int;
        if (json['current_position_index'] is int) return json['current_position_index'] as int;
        final currId = (json['live_current_station_id'] ?? json['liveCurrentStationId'] ?? json['current_station_id'] ?? json['fromStationId'] ?? json['from_station_id'] ?? '').toString().trim();
        final currName = (json['live_current_station_name'] ?? json['liveCurrentStationName'] ?? json['current_station_name'] ?? json['current_station'] ?? '').toString().trim();
        final isRed = (json['line'] ?? json['line_name'] ?? json['line_code'] ?? '').toString().toLowerCase().contains('red') || (json['line_code'] ?? '').toString().toUpperCase() == 'RL';
        final lineEnum = isRed ? MetroLine.red : MetroLine.blue;
        final stations = getStationsForLine(lineEnum);
        final idx = stations.indexWhere(
          (s) => (currId.isNotEmpty && s.id.toLowerCase() == currId.toLowerCase()) ||
                 (currName.isNotEmpty && s.name.toLowerCase() == currName.toLowerCase()),
        );
        return idx != -1 ? idx : 0;
      }(),
      fromStationId: json['fromStationId'] ?? json['from_station_id'] ?? '',
      toStationId: json['toStationId'] ?? json['to_station_id'] ?? '',
      announcements: (json['announcements'] as List? ?? []).map((e) => AnnouncementModel.fromJson(e)).toList(),
      arrivalTime: json['arrivalTime'] ?? json['arrival_time'],
      departureTime: json['departureTime'] ?? json['departure_time'],
      isAtPlatform: json['isAtPlatform'] ?? json['is_at_platform'] ?? false,
      journeyDurationMinutes: json['journeyDurationMinutes'] ?? json['journey_duration_minutes'],
      destinationName: json['destinationName'] ?? json['to_station_name'],
      predictedStationCrowd: json['predictedStationCrowd'] ?? json['predicted_station_crowd'],
      liveCurrentStationId: json['live_current_station_id'] ?? json['liveCurrentStationId'],
      liveCurrentStationName: json['live_current_station_name'] ?? json['liveCurrentStationName'],
      liveNextStationId: json['live_next_station_id'] ?? json['liveNextStationId'],
      liveNextStationName: json['live_next_station_name'] ?? json['liveNextStationName'],
      liveStatus: json['live_status'] ?? json['liveStatus'] ?? 'SCHEDULED',
      journeyProgressPct: ((json['journey_progress_pct'] ?? json['journeyProgressPct'] ?? 0.0) as num).toDouble(),
      stopsTimeline: (json['stops_timeline'] as List? ?? json['stopsTimeline'] as List? ?? [])
          .map((e) => JourneyStopModel.fromJson(e))
          .toList(),
    );
  }
}
