import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../core/constants/metro_data.dart';
import '../../../core/constants/theme.dart';
import '../../../core/widgets/station_selector.dart';
import '../../../core/widgets/floating_nav.dart';
import '../../../core/widgets/metro_drawer.dart';
import '../providers/train_search_provider.dart';
import '../widgets/live_sensor_banner.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedLine = ref.watch(selectedLineProvider);
    final fromStation = ref.watch(fromStationProvider);
    final toStation = ref.watch(toStationProvider);

    final stations = getStationsForLine(selectedLine);
    final activeColor = selectedLine == MetroLine.blue ? AppTheme.blueLine : AppTheme.redLine;

    return Scaffold(
      drawer: const MetroDrawer(),
      body: Stack(
        children: [
          CustomScrollView(
            slivers: [
              SliverAppBar(
                expandedHeight: 160,
                floating: false,
                pinned: true,
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
                    'SMARTRAIL OS',
                    style: TextStyle(
                      color: AppTheme.textPrimary,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 2.0,
                      fontFamily: AppTheme.tabularNumberStyle.fontFamily,
                      fontSize: 16,
                    ),
                  ),
                  centerTitle: true,
                  background: Stack(
                    children: [
                      Positioned.fill(
                        child: Container(
                          decoration: const BoxDecoration(
                            gradient: LinearGradient(
                              colors: [AppTheme.surfaceElevated, AppTheme.surfaceDark],
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                            ),
                          ),
                        ),
                      ),
                      Positioned(
                        right: -40,
                        top: -40,
                        child: Container(
                          width: 180,
                          height: 180,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: RadialGradient(
                              colors: [activeColor.withValues(alpha: 0.18), Colors.transparent],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                actions: [
                  IconButton(
                    onPressed: () => context.push('/sensors'),
                    icon: Stack(
                      clipBehavior: Clip.none,
                      children: [
                        const Icon(Icons.sensors_rounded, color: AppTheme.textPrimary),
                        Positioned(
                          right: -1,
                          top: -1,
                          child: Container(
                            width: 7,
                            height: 7,
                            decoration: const BoxDecoration(
                              color: AppTheme.signalGreen,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                      ],
                    ),
                    tooltip: 'ESP32 Sensor Telemetry',
                  ),
                  IconButton(
                    onPressed: () => context.push('/profile'),
                    icon: const Icon(Icons.tune_rounded, color: AppTheme.textPrimary),
                    tooltip: 'Commuter Preferences',
                  ),
                ],
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 120),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Live Network Ticker Banner
                      _buildNetworkTicker(activeColor)
                          .animate()
                          .fadeIn(duration: 400.ms)
                          .slideY(begin: 0.05, end: 0),

                      const LiveSensorBanner(),

                      const SizedBox(height: 16),

                      Text(
                        'PLAN YOUR\nMETRO JOURNEY',
                        style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w900,
                          letterSpacing: 1.0,
                          height: 1.15,
                        ),
                      ).animate().fadeIn(delay: 100.ms).slideY(begin: 0.1, end: 0),
                      const SizedBox(height: 20),
                      
                      const Text(
                        'SELECT METRO LINE',
                        style: TextStyle(
                          color: AppTheme.textMuted,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.0,
                        ),
                      ).animate().fadeIn(delay: 150.ms),
                      const SizedBox(height: 10),
                      _buildLineSelector(ref, selectedLine)
                          .animate()
                          .fadeIn(delay: 200.ms)
                          .slideY(begin: 0.1, end: 0),
                      
                      const SizedBox(height: 24),
                      
                      // Route Search Card
                      _buildSearchCard(context, ref, selectedLine, stations, fromStation, toStation)
                          .animate()
                          .fadeIn(delay: 300.ms)
                          .slideY(begin: 0.1, end: 0),
                      
                      const SizedBox(height: 28),
                      
                      // Popular Commutes
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'POPULAR COMMUTE ROUTES',
                            style: TextStyle(
                              color: AppTheme.textMuted,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1.0,
                            ),
                          ),
                          TextButton(
                            onPressed: () => context.push('/lines'),
                            style: TextButton.styleFrom(
                              visualDensity: VisualDensity.compact,
                              foregroundColor: activeColor,
                            ),
                            child: const Text('VIEW NETWORK MAP', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                          ),
                        ],
                      ).animate().fadeIn(delay: 400.ms),
                      const SizedBox(height: 8),
                      _buildPopularCommutes(context)
                          .animate()
                          .fadeIn(delay: 450.ms)
                          .slideY(begin: 0.1, end: 0),
                    ],
                  ),
                ),
              ),
            ],
          ),
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: FloatingNav(
              currentIndex: 0,
              activeColor: activeColor,
              onTap: (index) {
                if (index == 1) context.push('/lines');
                if (index == 2) context.push('/live');
                if (index == 3) context.push('/profile');
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNetworkTicker(Color activeColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0x1AFFFFFF)),
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
            child: Text(
              'ALL 32 METRO STATIONS ACTIVE · PEAK FREQUENCY 8 MIN',
              style: TextStyle(
                color: AppTheme.textSecondary,
                fontSize: 10,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.5,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLineSelector(WidgetRef ref, MetroLine selectedLine) {
    return Row(
      children: [
        Expanded(
          child: _LineTile(
            line: MetroLine.blue,
            isSelected: selectedLine == MetroLine.blue,
            onTap: () => _selectLine(ref, MetroLine.blue),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _LineTile(
            line: MetroLine.red,
            isSelected: selectedLine == MetroLine.red,
            onTap: () => _selectLine(ref, MetroLine.red),
          ),
        ),
      ],
    );
  }

  void _selectLine(WidgetRef ref, MetroLine line) {
    ref.read(selectedLineProvider.notifier).state = line;
    ref.read(fromStationProvider.notifier).state = null;
    ref.read(toStationProvider.notifier).state = null;
  }

  Widget _buildSearchCard(
    BuildContext context,
    WidgetRef ref,
    MetroLine selectedLine,
    List<Station> stations,
    Station? fromStation,
    Station? toStation,
  ) {
    final activeColor = selectedLine == MetroLine.blue ? AppTheme.blueLine : AppTheme.redLine;
    final isInterchange = (fromStation != null && fromStation.name.contains('Old High Court')) ||
        (toStation != null && toStation.name.contains('Old High Court'));

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppTheme.borderRadius),
        color: AppTheme.surfaceElevated,
        border: Border.all(color: const Color(0x26FFFFFF)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.3),
            blurRadius: 20,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Text(
                    'ORIGIN & DESTINATION',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 10,
                      color: AppTheme.textMuted,
                      letterSpacing: 1.0,
                    ),
                  ),
                  if (isInterchange) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppTheme.signalAmber.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text(
                        'TRANSFER HUB',
                        style: TextStyle(
                          color: AppTheme.signalAmber,
                          fontSize: 8,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
              if (fromStation != null && toStation != null)
                TextButton(
                  onPressed: () {
                    final temp = fromStation;
                    ref.read(fromStationProvider.notifier).state = toStation;
                    ref.read(toStationProvider.notifier).state = temp;
                  },
                  style: TextButton.styleFrom(
                    visualDensity: VisualDensity.compact,
                    foregroundColor: activeColor,
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.swap_vert_rounded, size: 16),
                      SizedBox(width: 4),
                      Text('SWAP', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 14),
          
          StationSelector(
            label: 'FROM STATION (BOARDING)',
            stations: stations,
            selectedStation: fromStation,
            icon: Icons.trip_origin_rounded,
            onChanged: (val) {
              ref.read(fromStationProvider.notifier).state = val;
              if (val != null && ref.read(toStationProvider)?.id == val.id) {
                ref.read(toStationProvider.notifier).state = null;
              }
            },
          ),
          
          const SizedBox(height: 12),
          
          StationSelector(
            label: 'TO STATION (DESTINATION)',
            stations: stations.where((s) => s.id != fromStation?.id).toList(),
            selectedStation: toStation,
            icon: Icons.place_rounded,
            onChanged: (val) {
              ref.read(toStationProvider.notifier).state = val;
              if (val != null && ref.read(fromStationProvider)?.id == val.id) {
                ref.read(fromStationProvider.notifier).state = null;
              }
            },
          ),
          
          const SizedBox(height: 20),
          
          ElevatedButton(
            onPressed: (fromStation != null && toStation != null)
                ? () {
                    context.push(
                      Uri(path: '/results', queryParameters: {
                        'lineId': selectedLine.name,
                        'fromStationId': fromStation.id,
                        'toStationId': toStation.id,
                      }).toString(),
                    );
                  }
                : null,
            style: ElevatedButton.styleFrom(
              backgroundColor: activeColor,
              minimumSize: const Size.fromHeight(54),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
              elevation: 4,
              shadowColor: activeColor.withValues(alpha: 0.4),
            ),
            child: const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.directions_subway_rounded, size: 20),
                SizedBox(width: 8),
                Flexible(
                  child: Text(
                    'SEARCH UPCOMING METRO TRAINS',
                    style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 0.8, fontSize: 13),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPopularCommutes(BuildContext context) {
    return Column(
      children: [
        _buildCommuteTile(
          context,
          lineId: 'blue',
          fromStationId: 'BL08',
          toStationId: 'BL18',
          lineName: 'Blue Line · 10 Stations',
          fromName: 'Kalupur Metro',
          toName: 'Thaltej Gam',
          color: AppTheme.blueLine,
          etaText: 'In 3 min',
        ),
        const SizedBox(height: 10),
        _buildCommuteTile(
          context,
          lineId: 'red',
          fromStationId: 'RL07',
          toStationId: 'RL15',
          lineName: 'Red Line · 8 Stations',
          fromName: 'Old High Court',
          toName: 'Motera Stadium',
          color: AppTheme.redLine,
          etaText: 'In 6 min',
        ),
      ],
    );
  }

  Widget _buildCommuteTile(
    BuildContext context, {
    required String lineId,
    required String fromStationId,
    required String toStationId,
    required String lineName,
    required String fromName,
    required String toName,
    required Color color,
    required String etaText,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0x1AFFFFFF)),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () {
            context.push(
              Uri(path: '/results', queryParameters: {
                'lineId': lineId,
                'fromStationId': fromStationId,
                'toStationId': toStationId,
              }).toString(),
            );
          },
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Center(
                    child: Icon(Icons.directions_subway_rounded, color: color, size: 20),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '$fromName → $toName',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        lineName,
                        style: const TextStyle(color: AppTheme.textMuted, fontSize: 11),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    etaText,
                    style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold),
                  ),
                ),
                const SizedBox(width: 8),
                const Icon(Icons.chevron_right_rounded, color: AppTheme.textMuted, size: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _LineTile extends StatelessWidget {
  final MetroLine line;
  final bool isSelected;
  final VoidCallback onTap;

  const _LineTile({
    required this.line,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = line == MetroLine.blue ? AppTheme.blueLine : AppTheme.redLine;
    final name = line == MetroLine.blue ? "BLUE LINE (LINE 1)" : "RED LINE (LINE 2)";
    final lineNumber = line == MetroLine.blue ? "1" : "2";

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: 250.ms,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected ? color.withValues(alpha: 0.08) : AppTheme.surfaceElevated,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? color : const Color(0x1AFFFFFF),
            width: isSelected ? 2 : 1,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: color.withValues(alpha: 0.2),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ]
              : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                  child: Center(
                    child: Text(
                      lineNumber,
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                  ),
                ),
                Row(
                  children: [
                    Container(width: 4, height: 4, decoration: const BoxDecoration(color: AppTheme.textMuted, shape: BoxShape.circle)),
                    Container(width: 12, height: 1, color: AppTheme.textMuted.withValues(alpha: 0.3)),
                    Container(width: 4, height: 4, decoration: const BoxDecoration(color: AppTheme.textMuted, shape: BoxShape.circle)),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              name,
              style: TextStyle(
                color: isSelected ? color : AppTheme.textPrimary,
                fontWeight: FontWeight.bold,
                fontSize: 12,
                letterSpacing: 0.5,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              line == MetroLine.blue ? "Thaltej ↔ Vastral" : "APMC ↔ Motera Stadium",
              style: const TextStyle(color: AppTheme.textMuted, fontSize: 10),
            ),
          ],
        ),
      ),
    );
  }
}
