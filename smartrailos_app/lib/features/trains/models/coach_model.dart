class CoachModel {
  final int coachNumber;
  final String type; // "General" or "Ladies/General"
  final int capacity; // 175
  final int currentPassengers;
  final int? predictedPassengersOnArrival;

  CoachModel({
    required this.coachNumber,
    required this.type,
    required this.capacity,
    required this.currentPassengers,
    this.predictedPassengersOnArrival,
  });

  double get percentFull => capacity > 0 ? (currentPassengers / capacity).clamp(0.0, 1.0) : 0.0;
  double get predictedPercentFull => capacity > 0 && predictedPassengersOnArrival != null
      ? (predictedPassengersOnArrival! / capacity).clamp(0.0, 1.0)
      : percentFull;

  factory CoachModel.fromJson(Map<String, dynamic> json) {
    return CoachModel(
      coachNumber: json['coachNumber'] ?? json['coach_number'] ?? 1,
      type: json['type'] ?? json['coach_type'] ?? 'General',
      capacity: json['capacity'] ?? 400,
      currentPassengers: json['currentPassengers'] ?? json['current_passenger_count'] ?? 0,
      predictedPassengersOnArrival: json['predictedPassengersOnArrival'] ?? json['predicted_passengers_on_arrival'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'coachNumber': coachNumber,
      'type': type,
      'capacity': capacity,
      'currentPassengers': currentPassengers,
      if (predictedPassengersOnArrival != null)
        'predictedPassengersOnArrival': predictedPassengersOnArrival,
    };
  }
}
