class EspSensorModel {
  final String status;
  final String deviceId;
  final String coachId;
  final int occupancy;
  final double occupancyPct;
  final int totalIn;
  final int totalOut;
  final int inRatePerMin;
  final int outRatePerMin;
  final int coachCapacity;
  final String? stationId;
  final String? lastDirection;
  final double sensorS1Distance;
  final double sensorS2Distance;
  final int? rssi;
  final DateTime lastUpdated;
  final bool isActive;

  EspSensorModel({
    required this.status,
    required this.deviceId,
    required this.coachId,
    required this.occupancy,
    required this.occupancyPct,
    required this.totalIn,
    required this.totalOut,
    required this.inRatePerMin,
    required this.outRatePerMin,
    required this.coachCapacity,
    this.stationId,
    this.lastDirection,
    required this.sensorS1Distance,
    required this.sensorS2Distance,
    this.rssi,
    required this.lastUpdated,
    required this.isActive,
  });

  factory EspSensorModel.fromJson(Map<String, dynamic> json) {
    return EspSensorModel(
      status: json['status'] ?? 'no_data',
      deviceId: json['device_id'] ?? 'ESP32_COACH_01',
      coachId: json['coach_id'] ?? 'C1',
      occupancy: json['occupancy'] ?? 0,
      occupancyPct: ((json['occupancy_pct'] ?? 0.0) as num).toDouble(),
      totalIn: json['total_in'] ?? 0,
      totalOut: json['total_out'] ?? 0,
      inRatePerMin: json['in_rate_per_min'] ?? 0,
      outRatePerMin: json['out_rate_per_min'] ?? 0,
      coachCapacity: json['coach_capacity'] ?? 400,
      stationId: json['station_id'] ?? json['target_station_id'],
      lastDirection: json['last_direction'],
      sensorS1Distance: ((json['sensor_s1_distance'] ?? 999.0) as num).toDouble(),
      sensorS2Distance: ((json['sensor_s2_distance'] ?? 999.0) as num).toDouble(),
      rssi: json['rssi'],
      lastUpdated: json['last_updated'] != null
          ? DateTime.tryParse(json['last_updated'].toString()) ?? DateTime.now()
          : DateTime.now(),
      isActive: json['is_active'] ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'status': status,
      'device_id': deviceId,
      'coach_id': coachId,
      'occupancy': occupancy,
      'occupancy_pct': occupancyPct,
      'total_in': totalIn,
      'total_out': totalOut,
      'in_rate_per_min': inRatePerMin,
      'out_rate_per_min': outRatePerMin,
      'coach_capacity': coachCapacity,
      'station_id': stationId,
      'last_direction': lastDirection,
      'sensor_s1_distance': sensorS1Distance,
      'sensor_s2_distance': sensorS2Distance,
      'rssi': rssi,
      'last_updated': lastUpdated.toIso8601String(),
      'is_active': isActive,
    };
  }

  String get loadStatus {
    if (occupancyPct >= 85) return 'Full';
    if (occupancyPct >= 60) return 'Crowded';
    if (occupancyPct >= 30) return 'Moderate';
    return 'Available';
  }
}
