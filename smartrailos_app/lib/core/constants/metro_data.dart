// BACKEND:
// Method:  GET
// URL:     /api/v1/stations?lineId=blue  (or ?lineId=red)
// Returns: List<Station JSON>
// Currently hardcoded here. Replace getStationsForLine() with an API call
// so station lists can be updated server-side without an app release.

enum MetroLine { blue, red }

enum TrainDirection { up, down }

class Station {
  final String id;
  final String name;
  final MetroLine lineId;
  final int sequenceIndex;

  const Station({
    required this.id,
    required this.name,
    required this.lineId,
    required this.sequenceIndex,
  });

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Station &&
          runtimeType == other.runtimeType &&
          id == other.id &&
          lineId == other.lineId;

  @override
  int get hashCode => id.hashCode ^ lineId.hashCode;

  @override
  String toString() => '$id - $name';
}

const List<Station> blueLineStations = [
  Station(id: 'BL01', name: 'Vastral Gam', lineId: MetroLine.blue, sequenceIndex: 0),
  Station(id: 'BL02', name: 'Nirant Cross Road', lineId: MetroLine.blue, sequenceIndex: 1),
  Station(id: 'BL03', name: 'Vastral', lineId: MetroLine.blue, sequenceIndex: 2),
  Station(id: 'BL04', name: 'Rabari Colony', lineId: MetroLine.blue, sequenceIndex: 3),
  Station(id: 'BL05', name: 'Amraiwadi', lineId: MetroLine.blue, sequenceIndex: 4),
  Station(id: 'BL06', name: 'Apparel Park', lineId: MetroLine.blue, sequenceIndex: 5),
  Station(id: 'BL07', name: 'Kankaria East', lineId: MetroLine.blue, sequenceIndex: 6),
  Station(id: 'BL08', name: 'Kalupur Metro Station', lineId: MetroLine.blue, sequenceIndex: 7),
  Station(id: 'BL09', name: 'Ghee Kanta', lineId: MetroLine.blue, sequenceIndex: 8),
  Station(id: 'BL10', name: 'Shahpur', lineId: MetroLine.blue, sequenceIndex: 9),
  Station(id: 'BL11', name: 'Old High Court', lineId: MetroLine.blue, sequenceIndex: 10),
  Station(id: 'BL12', name: 'SP Stadium', lineId: MetroLine.blue, sequenceIndex: 11),
  Station(id: 'BL13', name: 'Commerce Six Road', lineId: MetroLine.blue, sequenceIndex: 12),
  Station(id: 'BL14', name: 'Gujarat University', lineId: MetroLine.blue, sequenceIndex: 13),
  Station(id: 'BL15', name: 'Gurukul Road', lineId: MetroLine.blue, sequenceIndex: 14),
  Station(id: 'BL16', name: 'Doordarshan Kendra', lineId: MetroLine.blue, sequenceIndex: 15),
  Station(id: 'BL17', name: 'Thaltej', lineId: MetroLine.blue, sequenceIndex: 16),
  Station(id: 'BL18', name: 'Thaltej Gam', lineId: MetroLine.blue, sequenceIndex: 17),
];

const List<Station> redLineStations = [
  Station(id: 'RL01', name: 'APMC', lineId: MetroLine.red, sequenceIndex: 0),
  Station(id: 'RL02', name: 'Jivraj Park', lineId: MetroLine.red, sequenceIndex: 1),
  Station(id: 'RL03', name: 'Rajiv Nagar', lineId: MetroLine.red, sequenceIndex: 2),
  Station(id: 'RL04', name: 'Shreyas', lineId: MetroLine.red, sequenceIndex: 3),
  Station(id: 'RL05', name: 'Paldi', lineId: MetroLine.red, sequenceIndex: 4),
  Station(id: 'RL06', name: 'Gandhigram', lineId: MetroLine.red, sequenceIndex: 5),
  Station(id: 'RL07', name: 'Old High Court', lineId: MetroLine.red, sequenceIndex: 6),
  Station(id: 'RL08', name: 'Usmanpura', lineId: MetroLine.red, sequenceIndex: 7),
  Station(id: 'RL09', name: 'Vijay Nagar', lineId: MetroLine.red, sequenceIndex: 8),
  Station(id: 'RL10', name: 'Vadaj', lineId: MetroLine.red, sequenceIndex: 9),
  Station(id: 'RL11', name: 'Ranip', lineId: MetroLine.red, sequenceIndex: 10),
  Station(id: 'RL12', name: 'Sabarmati Railway Station', lineId: MetroLine.red, sequenceIndex: 11),
  Station(id: 'RL13', name: 'AEC', lineId: MetroLine.red, sequenceIndex: 12),
  Station(id: 'RL14', name: 'Sabarmati', lineId: MetroLine.red, sequenceIndex: 13),
  Station(id: 'RL15', name: 'Motera Stadium', lineId: MetroLine.red, sequenceIndex: 14),
];

List<Station> getStationsForLine(MetroLine line) {
  return line == MetroLine.blue ? blueLineStations : redLineStations;
}

List<Station> getNextStations(MetroLine line, String currentStationId) {
  final stations = getStationsForLine(line);
  final currentIndex = stations.indexWhere((s) => s.id == currentStationId);
  if (currentIndex == -1) return [];
  
  // Direction UP: Toward Thaltej (Blue) or Motera (Red) - wait, PLAN says:
  // Blue Line: UP = toward Thaltej, DN = toward Vastral
  // Red Line: UP = toward Motera, DN = toward GNLU
  
  // Actually, sequenceIndex 0 is Vastral Gam for Blue, and Motera Stadium for Red.
  // So UP (toward Thaltej) is increasing index for Blue.
  // UP (toward Motera) is DECREASING index for Red if 0 is Motera? 
  // Let's re-read CONTEXT.md
  // Blue Line: Direction A: Eastbound -> West (toward Thaltej), Direction B: Westbound -> East (toward Vastral)
  // Red Line: Direction A: Southbound -> North (toward Motera), Direction B: Northbound -> South
  
  // Let's simplify and just return all stations other than the current one for now, 
  // or return stations that could be destinations.
  return stations.where((s) => s.id != currentStationId).toList();
}
