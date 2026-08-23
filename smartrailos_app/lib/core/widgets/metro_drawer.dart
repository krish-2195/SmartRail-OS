import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../constants/theme.dart';
import '../../features/trains/providers/esp_sensor_provider.dart';
import '../../features/auth/providers/auth_provider.dart';

class MetroDrawer extends ConsumerWidget {
  const MetroDrawer({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final telemetryState = ref.watch(espSensorTelemetryProvider);
    final sensor = telemetryState.sensor;
    final authState = ref.watch(authProvider);
    final user = authState.value;

    return Drawer(
      backgroundColor: AppTheme.surfaceDark,
      child: SafeArea(
        child: Column(
          children: [
            // Header
            _buildHeader(context, user),
            const Divider(height: 1, color: Color(0x14FFFFFF)),


            // Scrollable Content
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
                children: [
                  // Network Status Pill
                  _buildNetworkStatusPill(),
                  const SizedBox(height: 20),

                  // Line Status Overview
                  const Text(
                    'METRO CORRIDORS',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.0,
                      color: AppTheme.textMuted,
                    ),
                  ),
                  const SizedBox(height: 10),
                  _buildLineStatusTile(
                    title: 'Line 1 · Blue Line',
                    route: 'Vastral Gam ↔ Thaltej Gam',
                    stationsCount: '18 Stations',
                    color: AppTheme.blueLine,
                    onTap: () {
                      Navigator.pop(context);
                      context.push('/lines?line=blue');
                    },
                  ),
                  const SizedBox(height: 10),
                  _buildLineStatusTile(
                    title: 'Line 2 · Red Line',
                    route: 'APMC ↔ Motera Stadium',
                    stationsCount: '15 Stations',
                    color: AppTheme.redLine,
                    onTap: () {
                      Navigator.pop(context);
                      context.push('/lines?line=red');
                    },
                  ),

                  const SizedBox(height: 24),

                  // Interchange Hub Highlight
                  _buildInterchangeCard(context),

                  const SizedBox(height: 24),

                  // Quick Links
                  const Text(
                    'TRANSIT SERVICES',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.0,
                      color: AppTheme.textMuted,
                    ),
                  ),
                  const SizedBox(height: 10),

                  _buildDrawerNavItem(
                    icon: Icons.alt_route_rounded,
                    label: 'Trip Planner & Search',
                    subtitle: 'Find upcoming train arrivals',
                    onTap: () {
                      Navigator.pop(context);
                      context.go('/home');
                    },
                  ),
                  _buildDrawerNavItem(
                    icon: Icons.sensors_rounded,
                    label: 'ESP32 Sensor Telemetry',
                    subtitle: sensor != null && sensor.isActive
                        ? 'Live flow: ${sensor.occupancy} PAX (${sensor.occupancyPct.toStringAsFixed(0)}%)'
                        : 'Real-time dual-beam IoT sensor data',
                    iconColor: AppTheme.signalGreen,
                    badgeWidget: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppTheme.signalGreen.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: AppTheme.signalGreen.withValues(alpha: 0.4)),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.circle, size: 6, color: AppTheme.signalGreen),
                          SizedBox(width: 4),
                          Text(
                            'LIVE',
                            style: TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: AppTheme.signalGreen),
                          ),
                        ],
                      ),
                    ),
                    onTap: () {
                      Navigator.pop(context);
                      context.push('/sensors');
                    },
                  ),
                  _buildDrawerNavItem(
                    icon: Icons.hub_rounded,
                    label: 'Network & Station Explorer',
                    subtitle: 'Full interactive line map',
                    onTap: () {
                      Navigator.pop(context);
                      context.push('/lines');
                    },
                  ),
                  _buildDrawerNavItem(
                    icon: Icons.radar_rounded,
                    label: 'Live Platform Radar',
                    subtitle: 'Hub departure radar & passenger feed',
                    onTap: () {
                      Navigator.pop(context);
                      context.push('/live');
                    },
                  ),
                  _buildDrawerNavItem(
                    icon: Icons.tune_rounded,
                    label: 'Commuter Preferences',
                    subtitle: 'Saved routes & diagnostics',
                    onTap: () {
                      Navigator.pop(context);
                      context.push('/profile');
                    },
                  ),

                  const SizedBox(height: 24),

                  // Telemetry Diagnostics
                  _buildTelemetryDiagnosticCard(context, sensor),
                ],
              ),
            ),

            // Footer
            _buildFooter(context, ref, user),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, dynamic user) {
    final hasUser = user != null;
    final displayName = hasUser ? (user.name.isNotEmpty ? user.name : 'Commuter') : 'Ahmedabad Metro Transit';
    final passengerId = hasUser ? (user.userIdCode ?? user.userId) : null;

    return Container(
      padding: const EdgeInsets.all(20),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppTheme.blueLine, AppTheme.redLine],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: AppTheme.blueLine.withValues(alpha: 0.3),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: const Center(
              child: Icon(Icons.directions_subway_rounded, color: Colors.white, size: 24),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  hasUser ? displayName : 'SMARTRAIL OS',
                  style: const TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 15,
                    letterSpacing: 0.8,
                    color: AppTheme.textPrimary,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  hasUser ? 'Passenger ID: $passengerId' : 'Ahmedabad Metro Transit',
                  style: TextStyle(
                    fontSize: 11,
                    fontFamily: hasUser ? 'monospace' : null,
                    color: hasUser ? AppTheme.blueLine : AppTheme.textMuted,
                    fontWeight: FontWeight.w600,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: () => Navigator.pop(context),
            icon: const Icon(Icons.close_rounded, color: AppTheme.textMuted, size: 20),
          ),
        ],
      ),
    );
  }


  Widget _buildNetworkStatusPill() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppTheme.signalGreen.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.signalGreen.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: const BoxDecoration(
              color: AppTheme.signalGreen,
              shape: BoxShape.circle,
            ),
          ).animate().fadeIn(duration: 400.ms),
          const SizedBox(width: 10),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'ALL SYSTEMS NOMINAL',
                  style: TextStyle(
                    color: AppTheme.signalGreen,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.8,
                  ),
                ),
                SizedBox(height: 1),
                Text(
                  '32 Stations · Normal Frequency (8 min)',
                  style: TextStyle(color: AppTheme.textMuted, fontSize: 10),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLineStatusTile({
    required String title,
    required String route,
    required String stationsCount,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0x14FFFFFF)),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Container(
                  width: 10,
                  height: 36,
                  decoration: BoxDecoration(
                    color: color,
                    borderRadius: BorderRadius.circular(5),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        route,
                        style: const TextStyle(color: AppTheme.textMuted, fontSize: 10),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    stationsCount,
                    style: TextStyle(
                      color: color,
                      fontSize: 9,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildInterchangeCard(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppTheme.blueLine.withValues(alpha: 0.1),
            AppTheme.redLine.withValues(alpha: 0.1),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0x26FFFFFF)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppTheme.surfaceDark,
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.transfer_within_a_station_rounded, color: AppTheme.signalAmber, size: 20),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'INTERCHANGE HUB',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 9,
                    color: AppTheme.signalAmber,
                    letterSpacing: 0.8,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Old High Court Station',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                    color: AppTheme.textPrimary,
                  ),
                ),
                SizedBox(height: 1),
                Text(
                  'Seamless transfer: Blue ↔ Red Lines',
                  style: TextStyle(color: AppTheme.textMuted, fontSize: 10),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDrawerNavItem({
    required IconData icon,
    required String label,
    required String subtitle,
    required VoidCallback onTap,
    Color? iconColor,
    Widget? badgeWidget,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0x14FFFFFF)),
      ),
      child: Material(
        color: Colors.transparent,
        child: ListTile(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          dense: true,
          leading: Icon(icon, color: iconColor ?? AppTheme.blueLine, size: 20),
          title: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Flexible(
                child: Text(
                  label,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.textPrimary),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (badgeWidget != null) ...[
                const SizedBox(width: 6),
                badgeWidget,
              ],
            ],
          ),
          subtitle: Text(
            subtitle,
            style: const TextStyle(color: AppTheme.textMuted, fontSize: 10),
          ),
          trailing: const Icon(Icons.chevron_right_rounded, size: 16, color: AppTheme.textMuted),
          onTap: onTap,
        ),
      ),
    );
  }

  Widget _buildTelemetryDiagnosticCard(BuildContext context, dynamic sensor) {
    final hasSensor = sensor != null;
    final isActive = hasSensor && (sensor.isActive == true);
    final statusColor = isActive ? AppTheme.signalGreen : AppTheme.signalAmber;

    return Container(
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: statusColor.withValues(alpha: 0.25)),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () {
            Navigator.pop(context);
            context.push('/sensors');
          },
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.wifi_tethering_rounded, size: 14, color: statusColor),
                        const SizedBox(width: 6),
                        Text(
                          'LIVE TELEMETRY ENGINE',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 9,
                            color: statusColor,
                            letterSpacing: 0.8,
                          ),
                        ),
                      ],
                    ),
                    Row(
                      children: [
                        Text(
                          'VIEW SENSORS',
                          style: TextStyle(color: statusColor, fontSize: 8, fontWeight: FontWeight.w900),
                        ),
                        Icon(Icons.chevron_right_rounded, size: 14, color: statusColor),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  'Device: ${hasSensor ? sensor.deviceId : "ESP32_COACH_01"} · Coach ${hasSensor ? sensor.coachId : "C1"}',
                  style: const TextStyle(color: AppTheme.textSecondary, fontSize: 10, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                if (hasSensor)
                  Text(
                    'Load: ${sensor.occupancy} PAX (${sensor.occupancyPct.toStringAsFixed(1)}%) · IN: ${sensor.totalIn} / OUT: ${sensor.totalOut}',
                    style: const TextStyle(color: AppTheme.textMuted, fontSize: 10, fontFamily: 'monospace'),
                  )
                else
                  const Text(
                    'Sensors: Dual-Beam Optical Inflow & Outflow',
                    style: TextStyle(color: AppTheme.textMuted, fontSize: 10),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildFooter(BuildContext context, WidgetRef ref, dynamic user) {
    final hasUser = user != null;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: Color(0x14FFFFFF))),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              if (hasUser)
                TextButton.icon(
                  onPressed: () async {
                    Navigator.pop(context);
                    await ref.read(authProvider.notifier).logout();
                    if (context.mounted) {
                      context.go('/login');
                    }
                  },
                  icon: const Icon(Icons.logout_rounded, size: 14, color: AppTheme.signalRed),
                  label: const Text('Sign Out', style: TextStyle(color: AppTheme.signalRed, fontSize: 11, fontWeight: FontWeight.bold)),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                )
              else
                TextButton.icon(
                  onPressed: () {
                    Navigator.pop(context);
                    context.push('/login');
                  },
                  icon: const Icon(Icons.login_rounded, size: 14, color: AppTheme.blueLine),
                  label: const Text('Passenger Sign In', style: TextStyle(color: AppTheme.blueLine, fontSize: 11, fontWeight: FontWeight.bold)),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(width: 6, height: 6, decoration: const BoxDecoration(color: AppTheme.blueLine, shape: BoxShape.circle)),
                  const SizedBox(width: 4),
                  Container(width: 6, height: 6, decoration: const BoxDecoration(color: AppTheme.redLine, shape: BoxShape.circle)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 4),
          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'SmartRail OS v2.4 (Commuter)',
                style: TextStyle(color: AppTheme.textMuted, fontSize: 9),
              ),
              Text(
                'JWT Secured',
                style: TextStyle(color: AppTheme.signalGreen, fontSize: 9, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

