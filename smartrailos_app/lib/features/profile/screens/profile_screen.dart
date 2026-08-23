import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../core/constants/theme.dart';
import '../../../core/constants/app_config.dart';
import '../../../core/widgets/floating_nav.dart';
import '../../../core/widgets/metro_drawer.dart';
import '../../auth/providers/auth_provider.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final user = authState.value;

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
                    'PASSENGER PROFILE',
                    style: TextStyle(
                      color: AppTheme.textPrimary,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.5,
                      fontFamily: AppTheme.tabularNumberStyle.fontFamily,
                      fontSize: 15,
                    ),
                  ),
                  centerTitle: true,
                  background: Container(
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        colors: [AppTheme.surfaceElevated, AppTheme.surfaceDark],
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                      ),
                    ),
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 120),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // ── Passenger Account Card ──────────────────────────────
                      _buildUserAccountCard(context, ref, user)
                          .animate()
                          .fadeIn(delay: 100.ms)
                          .slideY(begin: 0.05, end: 0),

                      const SizedBox(height: 24),

                      // ── Commuter Impact Stats ───────────────────────────────
                      _buildCommuterStats()
                          .animate()
                          .fadeIn(delay: 150.ms)
                          .slideY(begin: 0.05, end: 0),

                      const SizedBox(height: 28),

                      // ── Saved Daily Routes ──────────────────────────────────
                      const Text(
                        'SAVED COMMUTE SHORTCUTS',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 10,
                          color: AppTheme.textMuted,
                          letterSpacing: 1.0,
                        ),
                      ).animate().fadeIn(delay: 200.ms),
                      const SizedBox(height: 12),

                      _buildSavedRoutes(context)
                          .animate()
                          .fadeIn(delay: 250.ms)
                          .slideY(begin: 0.05, end: 0),

                      const SizedBox(height: 28),

                      // ── Telemetry & Backend Settings ────────────────────────
                      const Text(
                        'TELEMETRY & SENSOR SYSTEM',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 10,
                          color: AppTheme.textMuted,
                          letterSpacing: 1.0,
                        ),
                      ).animate().fadeIn(delay: 300.ms),
                      const SizedBox(height: 12),

                      _buildSystemDiagnostics(context)
                          .animate()
                          .fadeIn(delay: 350.ms)
                          .slideY(begin: 0.05, end: 0),

                      const SizedBox(height: 30),
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
              currentIndex: 3,
              activeColor: AppTheme.blueLine,
              onTap: (index) {
                if (index == 0) context.go('/home');
                if (index == 1) context.push('/lines');
                if (index == 2) context.push('/live');
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildUserAccountCard(BuildContext context, WidgetRef ref, dynamic user) {
    if (user == null) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.surfaceElevated,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppTheme.blueLine.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: AppTheme.blueLine.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.person_outline, color: AppTheme.blueLine, size: 24),
            ),
            const SizedBox(width: 14),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Passenger Guest', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppTheme.textPrimary)),
                  SizedBox(height: 2),
                  Text('Sign in to sync saved routes & passes', style: TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                ],
              ),
            ),
            ElevatedButton(
              onPressed: () => context.push('/login'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.blueLine,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: const Text('SIGN IN', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900)),
            ),
          ],
        ),
      );
    }

    final displayName = user.name.isNotEmpty ? user.name : 'Commuter Passenger';
    final passengerId = user.userIdCode ?? user.userId;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.blueLine.withValues(alpha: 0.3)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.2),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppTheme.accentCyan, AppTheme.accentBlue],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(14),
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
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            displayName,
                            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15, color: AppTheme.textPrimary),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppTheme.blueLine.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: AppTheme.blueLine.withValues(alpha: 0.4)),
                          ),
                          child: const Text(
                            'PASSENGER',
                            style: TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: AppTheme.blueLine),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'ID: $passengerId · ${user.email}',
                      style: const TextStyle(fontSize: 11, fontFamily: 'monospace', color: AppTheme.textMuted),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          const Divider(height: 1, color: Color(0x14FFFFFF)),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.verified_rounded, size: 14, color: AppTheme.signalGreen),
                  SizedBox(width: 6),
                  Text('Active Passenger Metro Pass', style: TextStyle(fontSize: 11, color: AppTheme.signalGreen, fontWeight: FontWeight.bold)),
                ],
              ),
              TextButton.icon(
                onPressed: () async {
                  await ref.read(authProvider.notifier).logout();
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Signed out successfully')),
                    );
                    context.go('/login');
                  }
                },
                icon: const Icon(Icons.logout_rounded, size: 14, color: AppTheme.signalRed),
                label: const Text('SIGN OUT', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.signalRed)),
              ),
            ],
          ),
        ],
      ),
    );
  }


  Widget _buildCommuterStats() {
    return Row(
      children: [
        _buildStatTile('142', 'TRIPS COMPLETED', Icons.directions_subway_rounded, AppTheme.blueLine),
        const SizedBox(width: 10),
        _buildStatTile('38.4 kg', 'CO2 SAVED', Icons.eco_rounded, AppTheme.signalGreen),
        const SizedBox(width: 10),
        _buildStatTile('52.0 h', 'TIME SAVED', Icons.schedule_rounded, AppTheme.signalAmber),
      ],
    );
  }

  Widget _buildStatTile(String value, String label, IconData icon, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppTheme.surfaceElevated,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0x14FFFFFF)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(height: 8),
            Text(
              value,
              style: AppTheme.tabularNumberStyle.copyWith(
                fontSize: 15,
                fontWeight: FontWeight.bold,
                color: AppTheme.textPrimary,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: const TextStyle(color: AppTheme.textMuted, fontSize: 8, fontWeight: FontWeight.w600),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSavedRoutes(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x1AFFFFFF)),
      ),
      child: Material(
        color: Colors.transparent,
        child: Column(
          children: [
            ListTile(
              leading: Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: AppTheme.blueLine.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.star_rounded, color: AppTheme.signalAmber, size: 20),
              ),
              title: const Text('Blue Line · Kalupur → Thaltej', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
              subtitle: const Text('Daily Morning Commute · Platform 1', style: TextStyle(color: AppTheme.textMuted, fontSize: 11)),
              trailing: const Icon(Icons.chevron_right_rounded, size: 18, color: AppTheme.textMuted),
              onTap: () {
                context.push(
                  Uri(path: '/results', queryParameters: {
                    'lineId': 'blue',
                    'fromStationId': 'BL08',
                    'toStationId': 'BL18',
                  }).toString(),
                );
              },
            ),
            const Divider(height: 1, color: Color(0x0DFFFFFF)),
            ListTile(
              leading: Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: AppTheme.redLine.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.star_rounded, color: AppTheme.signalAmber, size: 20),
              ),
              title: const Text('Red Line · Sabarmati → Old High Court', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
              subtitle: const Text('Evening Return Route · Platform 2', style: TextStyle(color: AppTheme.textMuted, fontSize: 11)),
              trailing: const Icon(Icons.chevron_right_rounded, size: 18, color: AppTheme.textMuted),
              onTap: () {
                context.push(
                  Uri(path: '/results', queryParameters: {
                    'lineId': 'red',
                    'fromStationId': 'RL02',
                    'toStationId': 'RL08',
                  }).toString(),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSystemDiagnostics(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x1AFFFFFF)),
      ),
      child: Column(
        children: [
          InkWell(
            onTap: () => context.push('/sensors'),
            child: _buildStatusRow('Active API Host', '${AppConfig.baseUrl} (Tap to edit)'),
          ),
          const SizedBox(height: 12),
          _buildStatusRow('Telemetry Polling Rate', '1.2s (Instant Live Sync)'),
          const SizedBox(height: 12),
          _buildStatusRow('Sensor Telemetry Engine', 'ESP32 Real-Time Dual-Beam'),
          const SizedBox(height: 12),
          _buildStatusRow('Application Version', 'SmartRail OS v2.4 (Commuter)'),
        ],
      ),
    );
  }

  Widget _buildStatusRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(color: AppTheme.textMuted, fontSize: 12),
        ),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.end,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: AppTheme.textPrimary,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}
