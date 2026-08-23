import 'dart:math';
import '../constants/metro_data.dart';
import '../../features/trains/models/train_model.dart';
import '../../features/trains/models/coach_model.dart';
import '../../features/trains/models/announcement_model.dart';

// DEPRECATED: This class is for prototyping only. 
// FOR BACKEND IMPLEMENTATION: Replace usages of this class in ApiService with real HTTP calls.
class MockTrainService {
  final Random _random = Random();

  // BACKEND:
  // Method:  GET
  // URL:     /api/v1/trains/upcoming?lineId=<line>&fromStationId=<id>&toStationId=<id>
  // Returns: List of TrainModel JSON objects (see TrainModel.fromJson)
  // Replace this mock with:
  //   final token = prefs.getString('auth_token') ?? '';
  //   final uri = Uri.parse(AppConfig.baseUrl + '/api/v1/trains/upcoming')
  //       .replace(queryParameters: { 'lineId': line.name, 'fromStationId': fromStationId, 'toStationId': toStationId });
  //   final res = await http.get(uri, headers: AppConfig.authHeaders(token));
  //   final list = jsonDecode(res.body) as List;
  //   return list.map((e) => TrainModel.fromJson(e)).toList();
  Future<List<TrainModel>> getUpcomingTrains(MetroLine line, String fromStationId, String toStationId) async {
    await Future.delayed(const Duration(milliseconds: 400));
    
    final List<int> etas = [3, 9, 15, 22, 28];
    final List<TrainModel> trains = [];

    for (int i = 0; i < etas.length; i++) {
      final eta = etas[i] + (_random.nextInt(3) - 1); // ±1 jitter
      final trainId = '${line == MetroLine.blue ? "BL" : "RL"}-${i % 2 == 0 ? "UP" : "DN"}-${100 + i}';
      
      trains.add(_generateMockTrain(
        trainId: trainId,
        line: line,
        eta: eta,
        fromStationId: fromStationId,
        toStationId: toStationId,
      ));
    }

    return trains;
  }

  // BACKEND:
  // Method:  GET
  // URL:     /api/v1/trains/:trainId
  // Returns: Single TrainModel JSON (same schema as above, with full coach detail)
  // Replace with:
  //   final res = await http.get(Uri.parse('${AppConfig.baseUrl}/api/v1/trains/$trainId'),
  //       headers: AppConfig.authHeaders(token));
  //   return TrainModel.fromJson(jsonDecode(res.body));
  Future<TrainModel> getTrainDetail(String trainId) async {
    await Future.delayed(const Duration(milliseconds: 300));
    final line = trainId.startsWith('BL') ? MetroLine.blue : MetroLine.red;
    return _generateMockTrain(
      trainId: trainId,
      line: line,
      eta: 5,
      fromStationId: 'OHC',
      toStationId: line == MetroLine.blue ? 'TG' : 'MS',
    );
  }

  // BACKEND:
  // Method:  GET
  // URL:     /api/v1/trains/:trainId/coaches
  // Returns: List<CoachModel JSON>  — called on a timer to refresh occupancy live
  // Replace with:
  //   final res = await http.get(Uri.parse('${AppConfig.baseUrl}/api/v1/trains/$trainId/coaches'),
  //       headers: AppConfig.authHeaders(token));
  //   final list = jsonDecode(res.body) as List;
  //   return list.map((e) => CoachModel.fromJson(e)).toList();
  Future<List<CoachModel>> getCoachOccupancy(String trainId) async {
    await Future.delayed(const Duration(milliseconds: 200));
    return _generateCoaches(trainId);
  }

  // BACKEND:
  // Method:  GET
  // URL:     /api/v1/announcements/active?stationId=<stationId>
  // Returns: List<{ "message": string, "severity": "info"|"warning"|"emergency", "trainId": string? }>
  // The admin panel pushes announcements; this endpoint returns ones currently active for a station.
  // Replace with:
  //   final uri = Uri.parse(AppConfig.baseUrl + '/api/v1/announcements/active')
  //       .replace(queryParameters: { 'stationId': stationId });
  //   final res = await http.get(uri, headers: AppConfig.authHeaders(token));
  //   final list = jsonDecode(res.body) as List;
  //   return list.map((e) => AnnouncementModel.fromJson(e)).toList();
  Future<List<AnnouncementModel>> getActiveAnnouncements(String stationId) async {
    return []; // Mock: return empty for now
  }

  TrainModel _generateMockTrain({
    required String trainId,
    required MetroLine line,
    required int eta,
    required String fromStationId,
    required String toStationId,
  }) {
    final coaches = _generateCoaches(trainId);
    final maxFill = coaches.map((c) => c.percentFull).reduce(max);
    
    TrainStatus status = TrainStatus.normal;
    if (maxFill > 0.9) {
      status = TrainStatus.full;
    } else if (maxFill > 0.7) {
      status = TrainStatus.moderate;
    }


    final stations = getStationsForLine(line);
    final fromIndex = stations.indexWhere((s) => s.id == fromStationId);
    final currentPosIndex = max(0, fromIndex - 2);

    return TrainModel(
      trainId: trainId,
      displayName: '${line == MetroLine.blue ? "Blue Line" : "Red Line"} - $trainId',
      line: line,
      direction: trainId.contains('UP') ? 'Eastbound → West' : 'Westbound → East',
      etaMinutes: eta,
      departureMinutes: eta + 2,
      coaches: coaches,
      status: status,
      currentPositionIndex: currentPosIndex,
      fromStationId: fromStationId,
      toStationId: toStationId,
      announcements: [],
    );
  }

  List<CoachModel> _generateCoaches(String trainId) {
    // Seeded random for consistency per train
    final seed = trainId.hashCode;
    final rand = Random(seed);
    
    return [
      CoachModel(
        coachNumber: 1,
        type: 'General',
        capacity: 175,
        currentPassengers: rand.nextInt(175),
      ),
      CoachModel(
        coachNumber: 2,
        type: 'Ladies/General',
        capacity: 175,
        currentPassengers: rand.nextInt(175),
      ),
      CoachModel(
        coachNumber: 3,
        type: 'General',
        capacity: 175,
        currentPassengers: rand.nextInt(175),
      ),
    ];
  }
}
