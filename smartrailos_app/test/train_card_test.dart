import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smartrailos_app/core/constants/metro_data.dart';
import 'package:smartrailos_app/core/widgets/train_card.dart';
import 'package:smartrailos_app/features/trains/models/train_model.dart';
import 'package:smartrailos_app/features/trains/models/coach_model.dart';
import 'package:smartrailos_app/features/trains/screens/train_detail_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

void main() {
  final sampleTrain = TrainModel(
    trainId: 'BL-T01',
    displayName: 'Blue Express 01',
    line: MetroLine.blue,
    direction: 'UP',
    etaMinutes: 4,
    departureMinutes: 5,
    coaches: [
      CoachModel(coachNumber: 1, type: 'General', capacity: 400, currentPassengers: 120),
      CoachModel(coachNumber: 2, type: 'Ladies', capacity: 400, currentPassengers: 90),
      CoachModel(coachNumber: 3, type: 'General', capacity: 400, currentPassengers: 140),
    ],
    status: TrainStatus.normal,
    currentPositionIndex: 0,
    fromStationId: 'BL08',
    toStationId: 'BL18',
    announcements: [],
    departureTime: '16:45',
    arrivalTime: '17:09',
    destinationName: 'Thaltej',
    journeyDurationMinutes: 24,
    predictedStationCrowd: 110,
    liveStatus: 'IN_TRANSIT',
  );

  testWidgets('TrainCard renders compact fields: ETA, Departure, and Arrival', (WidgetTester tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: TrainCard(train: sampleTrain),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 500));

    // Verify Train display name & line info
    expect(find.text('Blue Express 01'), findsOneWidget);
    expect(find.textContaining('4 MIN ETA'), findsOneWidget);

    // Verify timings
    expect(find.text('16:45'), findsOneWidget);
    expect(find.text('17:09'), findsOneWidget);
    expect(find.text('DEPARTURE'), findsOneWidget);
    expect(find.text('ARRIVAL'), findsOneWidget);
  });

  testWidgets('TrainCard renders ON STATION when train is at platform', (WidgetTester tester) async {
    final platformTrain = sampleTrain.copyWith(isAtPlatform: true);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: TrainCard(train: platformTrain),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.text('ON STATION'), findsWidgets);
  });

  testWidgets('TrainCard renders ARRIVING NOW when ETA is 0 and train is in transit', (WidgetTester tester) async {
    final arrivingTrain = sampleTrain.copyWith(etaMinutes: 0, isAtPlatform: false);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: TrainCard(train: arrivingTrain),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.text('ARRIVING NOW'), findsOneWidget);
    expect(find.text('ARRIVING'), findsOneWidget);
  });

  testWidgets('TrainDetailScreen renders complete telemetry sections with dual coach cards for approaching train', (WidgetTester tester) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: TrainDetailScreen(
            trainId: 'BL-T01',
            initialTrain: sampleTrain,
          ),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 500));

    // Header & schedule card
    expect(find.text('BLUE EXPRESS 01'), findsOneWidget);
    expect(find.text('16:45'), findsOneWidget);
    expect(find.text('17:09'), findsOneWidget);
    expect(find.text('4 MIN'), findsOneWidget);

    // Section titles
    expect(find.text('LIVE ROUTE TRACKING'), findsNothing);
    expect(find.text('COACH OCCUPANCY & COMPOSITION'), findsOneWidget);
    expect(find.text('STATION TIMELINE & PLATFORM CROWD'), findsOneWidget);
    expect(find.text('PASSENGER FLOW TELEMETRY'), findsOneWidget);

    // Dual cards inside coach section
    expect(find.text('CURRENT PASSENGERS (RIGHT NOW)'), findsOneWidget);
    expect(find.textContaining('EST. ON ARRIVAL AT'), findsOneWidget);

    // Total passenger count
    expect(find.text('350'), findsOneWidget); // 120 + 90 + 140
  });

  testWidgets('TrainDetailScreen renders single coach card when train is at platform', (WidgetTester tester) async {
    final atPlatformTrain = sampleTrain.copyWith(isAtPlatform: true);
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: TrainDetailScreen(
            trainId: 'BL-T01',
            initialTrain: atPlatformTrain,
          ),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 500));

    // Schedule card shows ON STATION
    expect(find.text('ON STATION'), findsWidgets);

    // Card 1 is present, Card 2 (arrival estimate) is hidden
    expect(find.text('CURRENT PASSENGERS (RIGHT NOW)'), findsOneWidget);
    expect(find.textContaining('EST. ON ARRIVAL AT'), findsNothing);
  });
}
