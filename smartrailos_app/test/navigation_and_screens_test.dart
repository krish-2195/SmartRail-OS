import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:smartrailos_app/core/constants/metro_data.dart';
import 'package:smartrailos_app/core/constants/theme.dart';
import 'package:smartrailos_app/core/widgets/floating_nav.dart';
import 'package:smartrailos_app/core/widgets/metro_drawer.dart';
import 'package:smartrailos_app/core/widgets/station_selector.dart';
import 'package:smartrailos_app/features/trains/screens/home_screen.dart';
import 'package:smartrailos_app/features/trains/screens/lines_screen.dart';
import 'package:smartrailos_app/features/trains/screens/live_radar_screen.dart';
import 'package:smartrailos_app/features/profile/screens/profile_screen.dart';
import 'package:smartrailos_app/features/trains/providers/train_search_provider.dart';

import 'package:smartrailos_app/features/trains/screens/sensor_telemetry_screen.dart';
import 'package:smartrailos_app/features/trains/widgets/live_sensor_banner.dart';

void main() {
  testWidgets('FloatingNav renders 4 tabs with active label and railway icons', (WidgetTester tester) async {
    int tappedIndex = -1;

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.darkTheme,
        home: Scaffold(
          body: FloatingNav(
            currentIndex: 0,
            onTap: (i) => tappedIndex = i,
          ),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('Plan'), findsOneWidget);
    expect(find.byIcon(Icons.alt_route_rounded), findsOneWidget);
    expect(find.byIcon(Icons.hub_outlined), findsOneWidget);
    expect(find.byIcon(Icons.sensors_rounded), findsOneWidget);
    expect(find.byIcon(Icons.tune_rounded), findsOneWidget);

    // Tap on the Lines tab
    await tester.tap(find.byIcon(Icons.hub_outlined));
    await tester.pump();
    expect(tappedIndex, 1);
  });

  testWidgets('FloatingNav renders all 4 tabs across narrow viewports without RenderFlex overflow', (WidgetTester tester) async {
    for (int i = 0; i < 4; i++) {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.darkTheme,
          home: Scaffold(
            body: FloatingNav(
              currentIndex: i,
              onTap: (_) {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    }
  });

  testWidgets('MetroDrawer renders network status, corridors, and interchange info', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: MetroDrawer(),
          ),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 400));

    // Verify Metro Drawer contents
    expect(find.text('SMARTRAIL OS'), findsOneWidget);
    expect(find.text('Ahmedabad Metro Transit'), findsOneWidget);
    expect(find.text('ALL SYSTEMS NOMINAL'), findsOneWidget);
    expect(find.text('Line 1 · Blue Line'), findsOneWidget);
    expect(find.text('Line 2 · Red Line'), findsOneWidget);
    expect(find.text('INTERCHANGE HUB'), findsOneWidget);
    expect(find.text('Old High Court Station'), findsOneWidget);

    // Scroll to reveal Transit Services items
    await tester.drag(find.byType(ListView), const Offset(0, -300));
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.text('ESP32 Sensor Telemetry'), findsOneWidget);
  });

  testWidgets('LinesScreen renders line corridors and station sequence', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: LinesScreen(),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.text('METRO NETWORK'), findsOneWidget);
    expect(find.text('BLUE LINE · 18 STNS'), findsOneWidget);
    expect(find.text('RED LINE · 15 STNS'), findsOneWidget);
    expect(find.text('EAST-WEST CORRIDOR'), findsOneWidget);
    expect(find.text('Vastral Gam'), findsOneWidget);
  });

  testWidgets('LiveRadarScreen renders optical sensor banner and departure boards', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: LiveRadarScreen(),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.text('LIVE PLATFORM RADAR'), findsOneWidget);
    expect(find.text('ESP32 DUAL-BEAM SENSOR ACTIVE'), findsOneWidget);
    expect(find.text('INFLOW SENSOR'), findsOneWidget);
    expect(find.text('OUTFLOW SENSOR'), findsOneWidget);
    expect(find.text('MAJOR HUB DEPARTURE RADAR'), findsOneWidget);
    expect(find.text('Kalupur Metro Station'), findsOneWidget);
  });

  testWidgets('ProfileScreen renders Commuter Stats and Saved Shortcuts without digital pass card', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: ProfileScreen(),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.text('COMMUTER PREFERENCES'), findsOneWidget);
    expect(find.text('DIGITAL COMMUTER PASS'), findsNothing);
    expect(find.text('₹340.00'), findsNothing);
    expect(find.text('142'), findsOneWidget);
    expect(find.text('TRIPS COMPLETED'), findsOneWidget);
    expect(find.text('SAVED COMMUTE SHORTCUTS'), findsOneWidget);
    expect(find.text('TELEMETRY & SENSOR SYSTEM'), findsOneWidget);
  });

  testWidgets('StationSelector handles selected station gracefully even if not in stations list', (WidgetTester tester) async {
    const foreignStation = Station(id: 'XX99', name: 'Alien Station', lineId: MetroLine.red, sequenceIndex: 99);
    
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.darkTheme,
        home: Scaffold(
          body: StationSelector(
            label: 'TEST DROPDOWN',
            stations: blueLineStations,
            selectedStation: foreignStation,
            icon: Icons.trip_origin,
            onChanged: (_) {},
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('TEST DROPDOWN'), findsOneWidget);
  });

  testWidgets('HomeScreen renders without FREQUENT METRO HUBS and handles line switching', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: HomeScreen(),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 500));

    // Verify Frequent Metro Hubs section is removed
    expect(find.text('FREQUENT METRO HUBS'), findsNothing);

    // Verify Search Card and Station Dropdowns
    expect(find.text('ORIGIN & DESTINATION'), findsOneWidget);
    expect(find.text('FROM STATION (BOARDING)'), findsOneWidget);
    expect(find.text('TO STATION (DESTINATION)'), findsOneWidget);
    expect(find.text('POPULAR COMMUTE ROUTES'), findsOneWidget);
  });

  testWidgets('HomeScreen allows selecting and switching red line stations without assertion crash', (WidgetTester tester) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    // Select Red line and set fromStation
    container.read(selectedLineProvider.notifier).state = MetroLine.red;
    const jivrajPark = Station(id: 'RL02', name: 'Jivraj Park', lineId: MetroLine.red, sequenceIndex: 1);
    container.read(fromStationProvider.notifier).state = jivrajPark;

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(
          home: HomeScreen(),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.text('Jivraj Park'), findsOneWidget);
    expect(find.text('TO STATION (DESTINATION)'), findsOneWidget);
    container.dispose();
  });

  testWidgets('LiveSensorBanner renders live sensor occupancy and flow metrics', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: LiveSensorBanner(),
          ),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.textContaining('LIVE SENSOR'), findsOneWidget);
    expect(find.textContaining('IN:'), findsOneWidget);
    expect(find.textContaining('OUT:'), findsOneWidget);
    expect(find.text('VIEW SENSOR HUB'), findsOneWidget);
  });

  testWidgets('SensorTelemetryScreen renders real-time telemetry gauges and controls', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: SensorTelemetryScreen(),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.text('ESP32 SENSOR TELEMETRY'), findsOneWidget);
    expect(find.text('REAL-TIME COACH OCCUPANCY'), findsOneWidget);
    expect(find.text('DUAL-BEAM OPTICAL FLOW SENSORS'), findsOneWidget);
    expect(find.text('PASSENGER FLOW RATES'), findsOneWidget);
    expect(find.text('TEST HARDWARE SIMULATION'), findsOneWidget);
    expect(find.text('+1 IN (Board)'), findsOneWidget);
    expect(find.text('-1 OUT (Alight)'), findsOneWidget);
    expect(find.text('Reset All Sensor Counters'), findsOneWidget);
  });
}
