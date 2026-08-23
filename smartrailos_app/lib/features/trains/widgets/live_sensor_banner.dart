import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../core/constants/theme.dart';
import '../models/esp_sensor_model.dart';
import '../providers/esp_sensor_provider.dart';

class LiveSensorBanner extends ConsumerWidget {
  final String? filterStationId;

  const LiveSensorBanner({
    super.key,
    this.filterStationId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final telemetryState = ref.watch(espSensorTelemetryProvider);
    final sensor = telemetryState.sensor ?? _fallbackSensor(telemetryState);

    // If station filter is provided and sensor is attached to a specific station
    if (filterStationId != null &&
        sensor.stationId != null &&
        sensor.stationId != 'ALL' &&
        sensor.stationId!.toUpperCase() != filterStationId!.toUpperCase()) {
      // Still show if network-wide or relevant
    }

    return _buildBannerCard(context, sensor, isConnected: telemetryState.isConnected);
  }

  Widget _buildBannerCard(BuildContext context, EspSensorModel sensor, {bool isConnected = true}) {
    final isHeavy = sensor.occupancyPct >= 75;
    final isModerate = sensor.occupancyPct >= 40;
    final statusColor = !isConnected
        ? AppTheme.signalAmber
        : (isHeavy
            ? AppTheme.signalRed
            : isModerate
                ? AppTheme.signalAmber
                : AppTheme.signalGreen);

    return Container(
      margin: const EdgeInsets.only(top: 14, bottom: 4),
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isConnected
              ? statusColor.withValues(alpha: 0.35)
              : Colors.white.withValues(alpha: 0.1),
          width: 1.2,
        ),
        boxShadow: [
          if (isConnected)
            BoxShadow(
              color: statusColor.withValues(alpha: 0.08),
              blurRadius: 14,
              offset: const Offset(0, 4),
            ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => context.push('/sensors'),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header Row
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: isConnected ? AppTheme.signalGreen : AppTheme.signalAmber,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'LIVE SENSOR · COACH ${sensor.coachId} (${sensor.deviceId})',
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.8,
                            color: AppTheme.textSecondary,
                          ),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: statusColor.withValues(alpha: 0.3)),
                      ),
                      child: Text(
                        sensor.loadStatus.toUpperCase(),
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                          color: statusColor,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Occupancy Main Stats
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.baseline,
                            textBaseline: TextBaseline.alphabetic,
                            children: [
                              Text(
                                '${sensor.occupancy}',
                                style: AppTheme.tabularNumberStyle.copyWith(
                                  fontSize: 24,
                                  fontWeight: FontWeight.w900,
                                  color: AppTheme.textPrimary,
                                ),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                '/ ${sensor.coachCapacity} PAX (${sensor.occupancyPct.toStringAsFixed(1)}%)',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: AppTheme.textMuted,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          // Progress bar
                          ClipRRect(
                            borderRadius: BorderRadius.circular(4),
                            child: LinearProgressIndicator(
                              value: (sensor.occupancyPct / 100).clamp(0.0, 1.0),
                              backgroundColor: Colors.white.withValues(alpha: 0.08),
                              valueColor: AlwaysStoppedAnimation<Color>(statusColor),
                              minHeight: 6,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 16),

                    // IN / OUT counters
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.arrow_downward_rounded, size: 12, color: AppTheme.signalGreen),
                            const SizedBox(width: 2),
                            Text(
                              'IN: ${sensor.totalIn}',
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: AppTheme.signalGreen,
                                fontFamily: 'monospace',
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.arrow_upward_rounded, size: 12, color: AppTheme.signalAmber),
                            const SizedBox(width: 2),
                            Text(
                              'OUT: ${sensor.totalOut}',
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: AppTheme.signalAmber,
                                fontFamily: 'monospace',
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),

                const SizedBox(height: 10),
                const Divider(height: 1, color: Color(0x0DFFFFFF)),
                const SizedBox(height: 8),

                // Tap to view full telemetry footer
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'ESP32 Dual-Beam Flow Telemetry',
                      style: TextStyle(color: AppTheme.textMuted, fontSize: 10),
                    ),
                    Row(
                      children: [
                        Text(
                          'VIEW SENSOR HUB',
                          style: TextStyle(
                            color: statusColor,
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(width: 2),
                        Icon(Icons.chevron_right_rounded, size: 14, color: statusColor),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    ).animate().fadeIn(duration: 300.ms);
  }

  EspSensorModel _fallbackSensor(EspSensorTelemetryState state) {
    return state.sensor ??
        EspSensorModel(
          status: state.isConnected ? 'active' : 'standby',
          deviceId: 'ESP32_COACH_01',
          coachId: 'C1',
          occupancy: 0,
          occupancyPct: 0.0,
          totalIn: 0,
          totalOut: 0,
          inRatePerMin: 0,
          outRatePerMin: 0,
          coachCapacity: 400,
          stationId: 'BL08',
          lastDirection: 'STANDBY',
          sensorS1Distance: 999.0,
          sensorS2Distance: 999.0,
          rssi: null,
          lastUpdated: DateTime.now(),
          isActive: state.isConnected,
        );
  }
}
