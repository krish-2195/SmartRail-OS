import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:smartrailos_app/core/constants/metro_data.dart';
import 'package:smartrailos_app/features/trains/models/announcement_model.dart';
import 'package:smartrailos_app/features/trains/models/train_model.dart';
import 'package:smartrailos_app/features/trains/models/coach_model.dart';
import 'package:smartrailos_app/features/trains/screens/home_screen.dart';
import 'package:smartrailos_app/features/trains/screens/train_results_screen.dart';
import 'package:smartrailos_app/features/trains/screens/train_detail_screen.dart';

void main() {
  group('Bug 17: TrainResultsScreen Station and Line Fallback', () {
    testWidgets('TrainResultsScreen handles invalid station and line IDs without crashing', (WidgetTester tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: TrainResultsScreen(
              lineId: 'INVALID_LINE',
              fromStationId: 'NON_EXISTENT_FROM',
              toStationId: 'NON_EXISTENT_TO',
            ),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 500));

      // Should fallback to default line (blue) and first/last station without throwing StateError
      expect(tester.takeException(), isNull);
      expect(find.byType(TrainResultsScreen), findsOneWidget);
    });

    testWidgets('TrainResultsScreen handles case-insensitive station IDs', (WidgetTester tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: TrainResultsScreen(
              lineId: 'blue',
              fromStationId: 'bl01', // lowercase ID
              toStationId: 'bl18', // lowercase ID
            ),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 500));

      expect(tester.takeException(), isNull);
      expect(find.textContaining('VASTRAL GAM'), findsWidgets);
      expect(find.textContaining('THALTEJ GAM'), findsWidgets);
    });
  });

  group('Bug 18: TrainModel currentPositionIndex dynamic calculation', () {
    test('Calculates currentPositionIndex from liveCurrentStationId in JSON', () {
      final json = {
        'train_id': 'RL-T02',
        'line_code': 'RL',
        'live_current_station_id': 'RL05', // Paldi is index 4 in red line
        'from_station_id': 'RL01',
        'to_station_id': 'RL15',
      };
      final train = TrainModel.fromJson(json);
      expect(train.currentPositionIndex, 4);
    });

    test('Calculates currentPositionIndex from station name in JSON', () {
      final json = {
        'train_id': 'BL-T03',
        'line_name': 'Blue Line',
        'live_current_station_name': 'Kalupur Metro Station', // index 7
      };
      final train = TrainModel.fromJson(json);
      expect(train.currentPositionIndex, 7);
    });

    test('Preserves explicit currentPositionIndex if provided in JSON', () {
      final json = {
        'train_id': 'BL-T03',
        'line_name': 'Blue Line',
        'currentPositionIndex': 5,
      };
      final train = TrainModel.fromJson(json);
      expect(train.currentPositionIndex, 5);
    });
  });

  group('Bug 20: Red Line route description', () {
    testWidgets('HomeScreen displays APMC ↔ Motera Stadium for Red Line', (WidgetTester tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: HomeScreen(),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('APMC ↔ Motera Stadium'), findsOneWidget);
    });
  });

  group('Bug 24: Announcement severity inference and UI styling', () {
    test('Infers emergency severity from keywords', () {
      final ann = AnnouncementModel.fromJson({
        'text': 'Emergency track maintenance: all operations suspended immediately',
      });
      expect(ann.severity, AnnouncementSeverity.emergency);
    });

    test('Infers warning severity from delay/crowd keywords', () {
      final ann = AnnouncementModel.fromJson({
        'text': 'Caution: heavy crowd and minor delays expected on platform 2',
      });
      expect(ann.severity, AnnouncementSeverity.warning);
    });

    test('Defaults to info for general announcement', () {
      final ann = AnnouncementModel.fromJson({
        'text': 'Welcome to Ahmedabad Metro. Please mind the platform gap.',
      });
      expect(ann.severity, AnnouncementSeverity.info);
    });

    test('Uses explicit severity if valid', () {
      final ann = AnnouncementModel.fromJson({
        'text': 'General update',
        'severity': 'warning',
      });
      expect(ann.severity, AnnouncementSeverity.warning);
    });

    testWidgets('TrainDetailScreen renders emergency announcement banner with appropriate styling', (WidgetTester tester) async {
      final emergencyTrain = TrainModel(
        trainId: 'BL-T99',
        displayName: 'Blue Express 99',
        line: MetroLine.blue,
        direction: 'UP',
        etaMinutes: 2,
        departureMinutes: 3,
        coaches: [
          CoachModel(coachNumber: 1, type: 'General', capacity: 400, currentPassengers: 100),
        ],
        status: TrainStatus.emergency,
        currentPositionIndex: 0,
        fromStationId: 'BL01',
        toStationId: 'BL18',
        announcements: [
          AnnouncementModel(
            message: 'Critical safety issue reported on track ahead',
            severity: AnnouncementSeverity.emergency,
          ),
        ],
      );

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: TrainDetailScreen(
              trainId: 'BL-T99',
              initialTrain: emergencyTrain,
            ),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('CRITICAL SAFETY ISSUE REPORTED ON TRACK AHEAD'), findsOneWidget);
      expect(find.byIcon(Icons.emergency_rounded), findsOneWidget);
    });
  });
}
