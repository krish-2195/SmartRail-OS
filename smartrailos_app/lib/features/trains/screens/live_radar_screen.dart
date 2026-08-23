import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../core/constants/app_config.dart';
import '../../../core/constants/theme.dart';
import '../../../core/widgets/floating_nav.dart';
import '../../../core/widgets/metro_drawer.dart';
import '../providers/esp_sensor_provider.dart';

class LiveRadarScreen extends ConsumerStatefulWidget {
  const LiveRadarScreen({super.key});

  @override
  ConsumerState<LiveRadarScreen> createState() => _LiveRadarScreenState();
}

class _LiveRadarScreenState extends ConsumerState<LiveRadarScreen> {
  Timer? _ticker;
  int _streamTick = 0;

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(const Duration(seconds: 5), (_) {
      if (mounted) {
        setState(() => _streamTick++);
      }
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final telemetryState = ref.watch(espSensorTelemetryProvider);
    final sensor = telemetryState.sensor;

    return Scaffold(
      drawer: const MetroDrawer(),
      body: Stack(
        children: [
          CustomScrollView(
            slivers: [
              SliverAppBar(
                expandedHeight: 140,
                pinned: true,
                floating: false,
                backgroundColor: AppTheme.surfaceDark,
                leading: Builder(
                  builder: (context) => IconButton(
                    icon: const Icon(Icons.menu_rounded, color: AppTheme.textPrimary),
                    onPressed: () => Scaffold.of(context).openDrawer(),
                    tooltip: 'Metro Menu',
                  ),
                ),
                flexibleSpace: FlexibleSpaceBar(
                  title: Text(
                    'LIVE PLATFORM RADAR',
                    style: TextStyle(
                      color: AppTheme.textPrimary,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.5,
                      fontFamily: AppTheme.tabularNumberStyle.fontFamily,
                      fontSize: 16,
                    ),
                  ),
                  centerTitle: true,
                  background: Stack(
                    children: [
                      Container(color: AppTheme.surfaceDark),
                      Positioned(
                        right: -30,
                        top: -30,
                        child: Container(
                          width: 160,
                          height: 160,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: RadialGradient(
                              colors: [AppTheme.signalGreen.withValues(alpha: 0.15), Colors.transparent],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 120),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // ESP32 Sensor Status Banner
                      _buildSensorTelemetryBanner(sensor)
                          .animate()
                          .fadeIn(duration: 400.ms)
                          .slideY(begin: 0.05, end: 0),

                      const SizedBox(height: 24),

                      // Quick Metric Tiles
                      Row(
                        children: [
                          _buildTelemetryCard(
                            label: 'INFLOW SENSOR',
                            value: sensor != null
                                ? '${sensor.totalIn} PAX'
                                : '${84 + (_streamTick * 3 % 20)} PAX/M',
                            subvalue: sensor != null ? '+${sensor.inRatePerMin}/min flow' : null,
                            icon: Icons.login_rounded,
                            color: AppTheme.signalGreen,
                          ),
                          const SizedBox(width: 12),
                          _buildTelemetryCard(
                            label: 'OUTFLOW SENSOR',
                            value: sensor != null
                                ? '${sensor.totalOut} PAX'
                                : '${62 + (_streamTick * 2 % 15)} PAX/M',
                            subvalue: sensor != null ? '-${sensor.outRatePerMin}/min flow' : null,
                            icon: Icons.logout_rounded,
                            color: AppTheme.signalAmber,
                          ),
                        ],
                      ).animate().fadeIn(delay: 150.ms).slideY(begin: 0.05, end: 0),

                      const SizedBox(height: 28),

                      // Major Hub Live Departure Boards
                      const Text(
                        'MAJOR HUB DEPARTURE RADAR',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.0,
                          color: AppTheme.textMuted,
                        ),
                      ).animate().fadeIn(delay: 250.ms),
                      const SizedBox(height: 12),

                      _buildHubDepartureCard(
                        stationName: 'Kalupur Metro Station',
                        lineName: 'Blue Line · Platform 1 & 2',
                        lineColor: AppTheme.blueLine,
                        nextTrain: 'Blue Express 01',
                        etaMinutes: 2,
                        occupancyPct: 0.42,
                        destination: 'Thaltej Gam',
                        onTap: () {
                          context.push(
                            Uri(path: '/results', queryParameters: {
                              'lineId': 'blue',
                              'fromStationId': 'BL08',
                              'toStationId': 'BL18',
                            }).toString(),
                          );
                        },
                      ).animate().fadeIn(delay: 300.ms).slideY(begin: 0.05, end: 0),

                      const SizedBox(height: 12),

                      _buildHubDepartureCard(
                        stationName: 'Old High Court (Interchange)',
                        lineName: 'Red Line & Blue Line Hub',
                        lineColor: AppTheme.signalAmber,
                        nextTrain: 'Red Metro 04',
                        etaMinutes: 4,
                        occupancyPct: 0.68,
                        destination: 'Motera Stadium',
                        onTap: () {
                          context.push(
                            Uri(path: '/results', queryParameters: {
                              'lineId': 'red',
                              'fromStationId': 'RL07',
                              'toStationId': 'RL15',
                            }).toString(),
                          );
                        },
                      ).animate().fadeIn(delay: 400.ms).slideY(begin: 0.05, end: 0),

                      const SizedBox(height: 12),

                      _buildHubDepartureCard(
                        stationName: 'Motera Stadium Station',
                        lineName: 'Red Line · Platform 1',
                        lineColor: AppTheme.redLine,
                        nextTrain: 'Red Shuttle 02',
                        etaMinutes: 7,
                        occupancyPct: 0.28,
                        destination: 'APMC Terminal',
                        onTap: () {
                          context.push(
                            Uri(path: '/results', queryParameters: {
                              'lineId': 'red',
                              'fromStationId': 'RL15',
                              'toStationId': 'RL01',
                            }).toString(),
                          );
                        },
                      ).animate().fadeIn(delay: 500.ms).slideY(begin: 0.05, end: 0),
                    ],
                  ),
                ),
              ),
            ],
          ),

          // Bottom Nav Bar
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: FloatingNav(
              currentIndex: 2,
              activeColor: AppTheme.signalGreen,
              onTap: (index) {
                if (index == 0) context.go('/home');
                if (index == 1) context.push('/lines');
                if (index == 3) context.push('/profile');
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSensorTelemetryBanner(dynamic sensor) {
    final hasSensor = sensor != null;
    final isActive = hasSensor && (sensor.isActive == true);
    final statusColor = isActive ? AppTheme.signalGreen : AppTheme.signalAmber;

    return Container(
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: statusColor.withValues(alpha: 0.35)),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => context.push('/sensors'),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(Icons.sensors_rounded, color: statusColor, size: 24),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 6,
                                height: 6,
                                decoration: BoxDecoration(
                                  color: statusColor,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                'ESP32 DUAL-BEAM SENSOR ACTIVE',
                                style: TextStyle(
                                  color: statusColor,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 0.8,
                                ),
                              ),
                            ],
                          ),
                          Row(
                            children: [
                              Text(
                                'VIEW HUB',
                                style: TextStyle(color: statusColor, fontSize: 8, fontWeight: FontWeight.w900),
                              ),
                              Icon(Icons.chevron_right_rounded, size: 14, color: statusColor),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        hasSensor
                            ? 'Coach ${sensor.coachId} · Occupancy: ${sensor.occupancy} PAX (${sensor.occupancyPct.toStringAsFixed(1)}%)'
                            : 'Polling telemetry every 2.5s from ${AppConfig.baseUrl}',
                        style: const TextStyle(color: AppTheme.textMuted, fontSize: 11),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTelemetryCard({
    required String label,
    required String value,
    String? subvalue,
    required IconData icon,
    required Color color,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.surfaceElevated,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0x1AFFFFFF)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 8,
                      fontWeight: FontWeight.bold,
                      color: color,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    value,
                    style: AppTheme.tabularNumberStyle.copyWith(
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                  if (subvalue != null) ...[
                    const SizedBox(height: 1),
                    Text(
                      subvalue,
                      style: const TextStyle(fontSize: 8, color: AppTheme.textMuted),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHubDepartureCard({
    required String stationName,
    required String lineName,
    required Color lineColor,
    required String nextTrain,
    required int etaMinutes,
    required double occupancyPct,
    required String destination,
    required VoidCallback onTap,
  }) {
    final crowdColor = AppTheme.coachColor(occupancyPct);

    return Container(
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x1AFFFFFF)),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(color: lineColor, shape: BoxShape.circle),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          stationName,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppTheme.textPrimary),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: lineColor.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        'IN $etaMinutes MIN',
                        style: TextStyle(
                          color: lineColor,
                          fontWeight: FontWeight.bold,
                          fontSize: 10,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  lineName,
                  style: const TextStyle(color: AppTheme.textMuted, fontSize: 11),
                ),
                const SizedBox(height: 12),
                const Divider(height: 1, color: Color(0x0DFFFFFF)),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.directions_subway_rounded, size: 14, color: AppTheme.textMuted),
                        const SizedBox(width: 6),
                        Text(
                          '$nextTrain → $destination',
                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: AppTheme.textSecondary),
                        ),
                      ],
                    ),
                    Row(
                      children: [
                        Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(color: crowdColor, shape: BoxShape.circle),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '${(occupancyPct * 100).round()}% FULL',
                          style: TextStyle(color: crowdColor, fontSize: 9, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
