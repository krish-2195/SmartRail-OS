import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../core/constants/app_config.dart';
import '../../../core/constants/theme.dart';
import '../../../core/constants/metro_data.dart';
import '../../../core/widgets/metro_drawer.dart';
import '../models/esp_sensor_model.dart';
import '../providers/esp_sensor_provider.dart';

class SensorTelemetryScreen extends ConsumerWidget {
  const SensorTelemetryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final telemetryState = ref.watch(espSensorTelemetryProvider);
    final notifier = ref.read(espSensorTelemetryProvider.notifier);
    final sensor = telemetryState.sensor;
    final isConnected = telemetryState.isConnected;

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
                  builder: (context) {
                    final canPop = Navigator.of(context).canPop();
                    return IconButton(
                      icon: Icon(
                        canPop ? Icons.arrow_back_rounded : Icons.menu_rounded,
                        color: AppTheme.textPrimary,
                      ),
                      onPressed: () {
                        if (canPop) {
                          context.pop();
                        } else {
                          Scaffold.of(context).openDrawer();
                        }
                      },
                      tooltip: canPop ? 'Back' : 'Metro Menu',
                    );
                  },
                ),
                flexibleSpace: FlexibleSpaceBar(
                  title: Text(
                    'ESP32 SENSOR TELEMETRY',
                    style: TextStyle(
                      color: AppTheme.textPrimary,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.5,
                      fontFamily: AppTheme.tabularNumberStyle.fontFamily,
                      fontSize: 15,
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
                              colors: [
                                (isConnected ? AppTheme.signalGreen : AppTheme.signalAmber)
                                    .withValues(alpha: 0.18),
                                Colors.transparent
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                actions: [
                  IconButton(
                    icon: const Icon(Icons.settings_ethernet_rounded, color: AppTheme.textPrimary),
                    tooltip: 'Configure Backend Host',
                    onPressed: () => _showHostConfigDialog(context, ref),
                  ),
                  IconButton(
                    icon: const Icon(Icons.refresh_rounded, color: AppTheme.textPrimary),
                    tooltip: 'Refresh Telemetry',
                    onPressed: () => notifier.refresh(),
                  ),
                ],
              ),

              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 100),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // ── Connection Status Banner ────────────────────────────
                      _buildConnectionBanner(context, ref, telemetryState)
                          .animate()
                          .fadeIn(duration: 350.ms)
                          .slideY(begin: 0.05, end: 0),

                      const SizedBox(height: 20),

                      // ── Live Coach Occupancy Gauge ──────────────────────────
                      _buildSectionHeader('REAL-TIME COACH OCCUPANCY', Icons.groups_rounded),
                      const SizedBox(height: 10),
                      _buildOccupancyCard(sensor ?? _fallbackSensor(telemetryState))
                          .animate()
                          .fadeIn(delay: 100.ms)
                          .slideY(begin: 0.05, end: 0),

                      const SizedBox(height: 24),

                      // ── Dual-Beam Ultrasonic Metrics ────────────────────────
                      _buildSectionHeader('DUAL-BEAM OPTICAL FLOW SENSORS', Icons.sensors_rounded),
                      const SizedBox(height: 10),
                      _buildDualBeamCard(sensor ?? _fallbackSensor(telemetryState))
                          .animate()
                          .fadeIn(delay: 200.ms)
                          .slideY(begin: 0.05, end: 0),

                      const SizedBox(height: 24),

                      // ── Cumulative Counters & Velocity ──────────────────────
                      _buildSectionHeader('PASSENGER FLOW RATES', Icons.speed_rounded),
                      const SizedBox(height: 10),
                      _buildFlowRateGrid(sensor ?? _fallbackSensor(telemetryState))
                          .animate()
                          .fadeIn(delay: 300.ms)
                          .slideY(begin: 0.05, end: 0),

                      const SizedBox(height: 24),

                      // ── Hardware Simulation & Controls ──────────────────────
                      _buildSectionHeader('TEST HARDWARE SIMULATION', Icons.tune_rounded),
                      const SizedBox(height: 10),
                      _buildSimulationControls(context, ref)
                          .animate()
                          .fadeIn(delay: 400.ms)
                          .slideY(begin: 0.05, end: 0),

                      const SizedBox(height: 24),

                      // ── Recent Passenger Crossing Events Log ────────────────
                      _buildSectionHeader('LIVE PASSENGER CROSSING LOG', Icons.history_rounded),
                      const SizedBox(height: 10),
                      _buildEventsLogCard(telemetryState.recentEvents)
                          .animate()
                          .fadeIn(delay: 500.ms)
                          .slideY(begin: 0.05, end: 0),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, size: 14, color: AppTheme.textMuted),
        const SizedBox(width: 6),
        Text(
          title,
          style: const TextStyle(
            color: AppTheme.textMuted,
            fontSize: 10,
            fontWeight: FontWeight.bold,
            letterSpacing: 1.0,
          ),
        ),
      ],
    );
  }

  Widget _buildConnectionBanner(
      BuildContext context, WidgetRef ref, EspSensorTelemetryState state) {
    final sensor = state.sensor;
    final isConnected = state.isConnected;
    final statusColor = isConnected ? AppTheme.signalGreen : AppTheme.signalAmber;
    final statusText = isConnected ? 'ESP32 HARDWARE STREAMING (LIVE)' : 'ESP32 CONNECTING / STANDBY';

    String stationName = 'All Network Stations';
    if (sensor?.stationId != null) {
      final allStations = [...blueLineStations, ...redLineStations];
      final s = allStations.firstWhere(
        (st) => st.id.toLowerCase() == sensor!.stationId!.toLowerCase(),
        orElse: () => Station(
          id: sensor!.stationId!,
          name: sensor.stationId!,
          lineId: MetroLine.blue,
          sequenceIndex: 0,
        ),
      );
      stationName = '${s.name} (${s.id})';
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: statusColor.withValues(alpha: 0.3)),
        boxShadow: [
          BoxShadow(
            color: statusColor.withValues(alpha: 0.08),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: statusColor,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    statusText,
                    style: TextStyle(
                      color: statusColor,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.8,
                    ),
                  ),
                ],
              ),
              InkWell(
                onTap: () => _showHostConfigDialog(context, ref),
                borderRadius: BorderRadius.circular(6),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppTheme.surfaceDark,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: const Color(0x1AFFFFFF)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        sensor?.deviceId ?? 'ESP32_COACH_01',
                        style: const TextStyle(
                          color: AppTheme.textSecondary,
                          fontSize: 10,
                          fontFamily: 'monospace',
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(width: 4),
                      const Icon(Icons.edit_rounded, size: 10, color: AppTheme.textMuted),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(height: 1, color: Color(0x14FFFFFF)),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('ATTACHED STATION',
                      style: TextStyle(fontSize: 8, color: AppTheme.textMuted, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 2),
                  Text(
                    stationName,
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.textPrimary),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text('COACH ATTACHMENT',
                      style: TextStyle(fontSize: 8, color: AppTheme.textMuted, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 2),
                  Text(
                    'Coach ${sensor?.coachId ?? "C1"}',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.textPrimary),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  'Host: ${state.activeHost}',
                  style: const TextStyle(color: AppTheme.textMuted, fontSize: 10, fontFamily: 'monospace'),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              InkWell(
                onTap: () => _showHostConfigDialog(context, ref),
                child: const Text(
                  'Change Host IP',
                  style: TextStyle(
                    color: AppTheme.blueLine,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    decoration: TextDecoration.underline,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildOccupancyCard(EspSensorModel sensor) {
    final pct = sensor.occupancyPct;
    final color = pct >= 85
        ? AppTheme.signalRed
        : (pct >= 60 ? AppTheme.signalAmber : AppTheme.signalGreen);

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x1AFFFFFF)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Text(
                        '${sensor.occupancy}',
                        style: AppTheme.tabularNumberStyle.copyWith(
                          fontSize: 38,
                          fontWeight: FontWeight.w900,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '/ ${sensor.coachCapacity} PAX',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.textMuted,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  const Text(
                    'Live Coach C1 Headcount',
                    style: TextStyle(color: AppTheme.textMuted, fontSize: 11),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: color.withValues(alpha: 0.35)),
                ),
                child: Column(
                  children: [
                    Text(
                      '${pct.toStringAsFixed(1)}%',
                      style: TextStyle(
                        color: color,
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        fontFamily: 'monospace',
                      ),
                    ),
                    Text(
                      sensor.loadStatus.toUpperCase(),
                      style: TextStyle(
                        color: color,
                        fontSize: 9,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: (pct / 100).clamp(0.0, 1.0),
              backgroundColor: Colors.white.withValues(alpha: 0.08),
              valueColor: AlwaysStoppedAnimation<Color>(color),
              minHeight: 10,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDualBeamCard(EspSensorModel sensor) {
    final s1Dist = sensor.sensorS1Distance < 900
        ? '${sensor.sensorS1Distance.toStringAsFixed(1)} cm'
        : 'Clear (>100cm)';
    final s2Dist = sensor.sensorS2Distance < 900
        ? '${sensor.sensorS2Distance.toStringAsFixed(1)} cm'
        : 'Clear (>100cm)';
    final s1Active = sensor.sensorS1Distance < 50.0;
    final s2Active = sensor.sensorS2Distance < 50.0;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x1AFFFFFF)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: _buildSensorBeamTile(
                  title: 'BEAM 1 (ENTRY)',
                  subtitle: 'Inflow Detection',
                  distance: s1Dist,
                  isTriggered: s1Active,
                  color: AppTheme.signalGreen,
                  icon: Icons.input_rounded,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildSensorBeamTile(
                  title: 'BEAM 2 (EXIT)',
                  subtitle: 'Outflow Detection',
                  distance: s2Dist,
                  isTriggered: s2Active,
                  color: AppTheme.signalAmber,
                  icon: Icons.output_rounded,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: AppTheme.surfaceDark,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(Icons.compare_arrows_rounded, size: 14, color: AppTheme.textMuted),
                    SizedBox(width: 6),
                    Text(
                      'LAST DETECTED CROSSING',
                      style: TextStyle(color: AppTheme.textMuted, fontSize: 9, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                Text(
                  sensor.lastDirection ?? 'SYNC (CALIBRATED)',
                  style: const TextStyle(
                    color: AppTheme.textPrimary,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    fontFamily: 'monospace',
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSensorBeamTile({
    required String title,
    required String subtitle,
    required String distance,
    required bool isTriggered,
    required Color color,
    required IconData icon,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isTriggered ? color.withValues(alpha: 0.12) : AppTheme.surfaceDark,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isTriggered ? color : const Color(0x14FFFFFF)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Icon(icon, size: 16, color: color),
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isTriggered ? color : Colors.grey,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            title,
            style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: color, letterSpacing: 0.5),
          ),
          const SizedBox(height: 2),
          Text(
            distance,
            style: const TextStyle(
                fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.textPrimary, fontFamily: 'monospace'),
          ),
          const SizedBox(height: 1),
          Text(
            subtitle,
            style: const TextStyle(color: AppTheme.textMuted, fontSize: 9),
          ),
        ],
      ),
    );
  }

  Widget _buildFlowRateGrid(EspSensorModel sensor) {
    return Row(
      children: [
        Expanded(
          child: _buildMetricTile(
            label: 'TOTAL BOARDED (IN)',
            value: '${sensor.totalIn} PAX',
            subvalue: '+${sensor.inRatePerMin}/min flow',
            icon: Icons.arrow_downward_rounded,
            color: AppTheme.signalGreen,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _buildMetricTile(
            label: 'TOTAL ALIGHTED (OUT)',
            value: '${sensor.totalOut} PAX',
            subvalue: '-${sensor.outRatePerMin}/min flow',
            icon: Icons.arrow_upward_rounded,
            color: AppTheme.signalAmber,
          ),
        ),
      ],
    );
  }

  Widget _buildMetricTile({
    required String label,
    required String value,
    required String subvalue,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0x1AFFFFFF)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                label,
                style: TextStyle(fontSize: 8, fontWeight: FontWeight.bold, color: color, letterSpacing: 0.5),
              ),
              Icon(icon, size: 14, color: color),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: AppTheme.tabularNumberStyle.copyWith(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: AppTheme.textPrimary,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            subvalue,
            style: const TextStyle(fontSize: 10, color: AppTheme.textMuted),
          ),
        ],
      ),
    );
  }

  Widget _buildSimulationControls(BuildContext context, WidgetRef ref) {
    final notifier = ref.read(espSensorTelemetryProvider.notifier);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x1AFFFFFF)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Inject pulse events to test sensor reactivity & dummy train updates:',
            style: TextStyle(fontSize: 11, color: AppTheme.textMuted),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () {
                    notifier.triggerCrossing(direction: 'IN', inDelta: 1);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('✓ Injected +1 Boarding (IN) Pulse to ESP32'),
                        duration: Duration(seconds: 1),
                      ),
                    );
                  },
                  icon: const Icon(Icons.add_rounded, size: 16),
                  label: const Text('+1 IN (Board)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.signalGreen,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () {
                    notifier.triggerCrossing(direction: 'OUT', outDelta: 1);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('✓ Injected +1 Alighting (OUT) Pulse to ESP32'),
                        duration: Duration(seconds: 1),
                      ),
                    );
                  },
                  icon: const Icon(Icons.remove_rounded, size: 16),
                  label: const Text('-1 OUT (Alight)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.signalAmber,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: () {
              notifier.resetCounters();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('✓ Reset ESP32 Counters to 0'),
                  duration: Duration(seconds: 1),
                ),
              );
            },
            icon: const Icon(Icons.restart_alt_rounded, size: 16),
            label: const Text('Reset All Sensor Counters',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(42),
              foregroundColor: AppTheme.textSecondary,
              side: const BorderSide(color: Color(0x26FFFFFF)),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEventsLogCard(List<Map<String, dynamic>> events) {
    if (events.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppTheme.surfaceElevated,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0x1AFFFFFF)),
        ),
        child: const Center(
          child: Text(
            'No recent passenger crossing events recorded yet.\nCrossings are logged live when passengers trigger the sensors.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppTheme.textMuted, fontSize: 11),
          ),
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x1AFFFFFF)),
      ),
      child: ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: events.take(8).length,
        separatorBuilder: (_, __) => const Divider(height: 1, color: Color(0x0DFFFFFF)),
        itemBuilder: (context, index) {
          final event = events[index];
          final dir = (event['direction'] ?? 'SYNC').toString().toUpperCase();
          final isEntry = dir == 'IN';
          final color = isEntry
              ? AppTheme.signalGreen
              : (dir == 'OUT' ? AppTheme.signalAmber : AppTheme.blueLine);
          final time = event['timestamp'] != null
              ? event['timestamp'].toString().split('T').last.split('.').first
              : '--:--:--';
          final occ = event['occupancy'] ?? event['current_occupancy'] ?? 0;

          return ListTile(
            dense: true,
            leading: Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                isEntry
                    ? Icons.arrow_downward_rounded
                    : (dir == 'OUT' ? Icons.arrow_upward_rounded : Icons.sync_rounded),
                color: color,
                size: 16,
              ),
            ),
            title: Text(
              '$dir EVENT · OCCUPANCY $occ PAX',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: AppTheme.textPrimary),
            ),
            subtitle: Text(
              'Coach ${event['coach_id'] ?? 'C1'} · Station ${event['station_id'] ?? 'ALL'}',
              style: const TextStyle(color: AppTheme.textMuted, fontSize: 10),
            ),
            trailing: Text(
              time,
              style: const TextStyle(color: AppTheme.textMuted, fontSize: 10, fontFamily: 'monospace'),
            ),
          );
        },
      ),
    );
  }

  void _showHostConfigDialog(BuildContext context, WidgetRef ref) {
    final controller = TextEditingController(text: AppConfig.baseUrl);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surfaceElevated,
        title: const Row(
          children: [
            Icon(Icons.settings_ethernet_rounded, color: AppTheme.signalGreen),
            SizedBox(width: 10),
            Text('Backend Host IP', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Configure the FastAPI backend server URL to stream real ESP32 telemetry:',
              style: TextStyle(color: AppTheme.textMuted, fontSize: 12),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: controller,
              decoration: const InputDecoration(
                labelText: 'Server URL',
                hintText: 'http://172.22.218.104:8000',
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
            const SizedBox(height: 12),
            const Text('Common Presets:',
                style: TextStyle(color: AppTheme.textMuted, fontSize: 10, fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                'http://localhost:8000',
                'http://127.0.0.1:8000',
                'http://10.0.2.2:8000',
                'http://172.22.218.104:8000',
              ].map((url) {
                return ActionChip(
                  label: Text(url, style: const TextStyle(fontSize: 10)),
                  onPressed: () => controller.text = url,
                );
              }).toList(),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              final newUrl = controller.text.trim();
              Navigator.pop(ctx);
              final ok = await ref.read(espSensorTelemetryProvider.notifier).setServerUrl(newUrl);
              if (!context.mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(ok
                      ? '✓ Connected to $newUrl'
                      : '⚠️ Saved $newUrl (Connecting...)'),
                  backgroundColor: ok ? AppTheme.signalGreen : AppTheme.signalAmber,
                ),
              );
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.signalGreen),
            child: const Text('Save & Connect'),
          ),
        ],
      ),
    );
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
