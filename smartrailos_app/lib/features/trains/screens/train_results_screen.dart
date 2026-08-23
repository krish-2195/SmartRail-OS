import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../core/constants/metro_data.dart';
import '../../../core/constants/theme.dart';
import '../../../core/widgets/train_card.dart';
import '../providers/train_search_provider.dart';

class TrainResultsScreen extends ConsumerStatefulWidget {
  final String lineId;
  final String fromStationId;
  final String toStationId;

  const TrainResultsScreen({
    super.key,
    required this.lineId,
    required this.fromStationId,
    required this.toStationId,
  });

  @override
  ConsumerState<TrainResultsScreen> createState() => _TrainResultsScreenState();
}

class _TrainResultsScreenState extends ConsumerState<TrainResultsScreen> {
  int _filterIndex = 0; // 0: All, 1: Least Crowded, 2: Immediate

  @override
  Widget build(BuildContext context) {
    final resultsAsync = ref.watch(trainResultsProvider((
      lineId: widget.lineId,
      fromStationId: widget.fromStationId,
      toStationId: widget.toStationId,
    )));

    final line = MetroLine.values.firstWhere(
      (e) => e.name.toLowerCase() == widget.lineId.toLowerCase(),
      orElse: () => MetroLine.blue,
    );
    final stations = getStationsForLine(line);
    final fromStation = stations.firstWhere(
      (s) => s.id.toLowerCase() == widget.fromStationId.toLowerCase() || s.name.toLowerCase() == widget.fromStationId.toLowerCase(),
      orElse: () => stations.first,
    );
    final toStation = stations.firstWhere(
      (s) => s.id.toLowerCase() == widget.toStationId.toLowerCase() || s.name.toLowerCase() == widget.toStationId.toLowerCase(),
      orElse: () => stations.last,
    );

    final fromIndex = stations.indexWhere((s) => s.id == fromStation.id);
    final toIndex = stations.indexWhere((s) => s.id == toStation.id);
    final stopCount = (fromIndex != -1 && toIndex != -1) ? (toIndex - fromIndex).abs() : 5;
    final estimatedMins = (stopCount * 2.2).round().clamp(4, 45);

    final lineColor = line == MetroLine.blue ? AppTheme.blueLine : AppTheme.redLine;

    return Scaffold(
      appBar: AppBar(
        title: Text('${fromStation.name.toUpperCase()} → ${toStation.name.toUpperCase()}'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh departures',
            onPressed: () => ref.invalidate(trainResultsProvider((
              lineId: widget.lineId,
              fromStationId: widget.fromStationId,
              toStationId: widget.toStationId,
            ))),
          ),
        ],
      ),
      body: resultsAsync.when(
        data: (trains) {
          var filteredTrains = List<dynamic>.from(trains);
          if (_filterIndex == 1) {
            // Least crowded
            filteredTrains.sort((a, b) => a.totalPassengers.compareTo(b.totalPassengers));
          } else if (_filterIndex == 2) {
            // Immediate
            filteredTrains.sort((a, b) => a.etaMinutes.compareTo(b.etaMinutes));
          }

          // Separate dwelling train (at platform) from upcoming trains
          final platformTrains = filteredTrains.where((t) => t.isAtPlatform).toList();
          final upcomingTrains = filteredTrains
              .where((t) => !t.isAtPlatform && t.etaMinutes < 120)
              .toList();

          final hasAnyTrain = platformTrains.isNotEmpty || upcomingTrains.isNotEmpty;

          if (!hasAnyTrain) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(32.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.directions_subway_outlined, size: 64, color: AppTheme.textMuted),
                    const SizedBox(height: 16),
                    const Text(
                      'NO ACTIVE TRAINS ON THIS ROUTE',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: AppTheme.textPrimary,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.8,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Services operate between 06:00 AM and 10:30 PM. Please try another route or station pair.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppTheme.textMuted, fontSize: 12),
                    ),
                    const SizedBox(height: 20),
                    ElevatedButton.icon(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.arrow_back_rounded, size: 16),
                      label: const Text('BACK TO ROUTE PLANNER'),
                    ),
                  ],
                ),
              ),
            ).animate().fadeIn();
          }

          return ListView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            children: [
              // ── Route Summary Hero Card ─────────────────────────────
              _buildRouteSummaryCard(
                fromStation: fromStation.name,
                toStation: toStation.name,
                stopCount: stopCount,
                durationMins: estimatedMins,
                lineColor: lineColor,
                lineName: line == MetroLine.blue ? 'Blue Line (Line 1)' : 'Red Line (Line 2)',
              ).animate().fadeIn(duration: 350.ms).slideY(begin: -0.05, end: 0),

              const SizedBox(height: 16),

              // ── Filter Chips ──────────────────────────────────────────
              _buildFilterChips(lineColor),

              const SizedBox(height: 16),

              // ── Section 1: Live At Station ─────────────────────────────
              if (platformTrains.isNotEmpty) ...[
                _buildSectionHeader(
                  context,
                  icon: Icons.sensors_rounded,
                  label: 'LIVE AT ${fromStation.name.toUpperCase()} (PLATFORM 1)',
                  color: AppTheme.signalGreen,
                  dotColor: AppTheme.signalGreen,
                  isLive: true,
                ).animate().fadeIn(duration: 400.ms).slideY(begin: -0.1, end: 0),
                const SizedBox(height: 12),
                ...platformTrains.asMap().entries.map((e) =>
                  TrainCard(train: e.value, index: e.key),
                ),
              ] else ...[
                // Platform empty indicator
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
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
                          color: AppTheme.textMuted,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Text(
                        'PLATFORM CLEAR AT ${fromStation.name.toUpperCase()}',
                        style: const TextStyle(
                          color: AppTheme.textMuted,
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.8,
                        ),
                      ),
                    ],
                  ),
                ).animate().fadeIn(duration: 300.ms),
              ],

              const SizedBox(height: 20),

              // ── Section 2: Upcoming Trains ─────────────────────────────
              if (upcomingTrains.isNotEmpty) ...[
                _buildSectionHeader(
                  context,
                  icon: Icons.schedule_rounded,
                  label: 'UPCOMING DEPARTURES (${upcomingTrains.length} SERVICES)',
                  color: lineColor,
                  dotColor: lineColor,
                  isLive: false,
                ).animate().fadeIn(delay: 200.ms, duration: 400.ms).slideY(begin: -0.1, end: 0),
                const SizedBox(height: 12),
                ...upcomingTrains.asMap().entries.map((e) =>
                  TrainCard(train: e.value, index: e.key),
                ),
              ],

              const SizedBox(height: 40),
            ],
          );
        },
        loading: () => const Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(color: AppTheme.blueLine),
              SizedBox(height: 16),
              Text(
                'RETRIEVING LIVE METRO DEPARTURES...',
                style: TextStyle(color: AppTheme.textMuted, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.8),
              ),
            ],
          ),
        ),
        error: (err, stack) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.wifi_off_rounded, size: 48, color: AppTheme.textMuted),
                const SizedBox(height: 16),
                const Text(
                  'UNABLE TO REACH METRO BACKEND',
                  style: TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.bold, fontSize: 13),
                ),
                const SizedBox(height: 8),
                Text(
                  '$err',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppTheme.textMuted, fontSize: 11),
                ),
                const SizedBox(height: 20),
                ElevatedButton.icon(
                  onPressed: () => ref.invalidate(trainResultsProvider((
                    lineId: widget.lineId,
                    fromStationId: widget.fromStationId,
                    toStationId: widget.toStationId,
                  ))),
                  icon: const Icon(Icons.refresh, size: 16),
                  label: const Text('RETRY SEARCH'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildRouteSummaryCard({
    required String fromStation,
    required String toStation,
    required int stopCount,
    required int durationMins,
    required Color lineColor,
    required String lineName,
  }) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x26FFFFFF)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.3),
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
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: lineColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  lineName.toUpperCase(),
                  style: TextStyle(color: lineColor, fontWeight: FontWeight.bold, fontSize: 10),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.surfaceDark,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: const Color(0x1AFFFFFF)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.directions_subway_rounded, size: 12, color: lineColor),
                    const SizedBox(width: 4),
                    Text(
                      'DIRECT SERVICE',
                      style: TextStyle(color: lineColor, fontWeight: FontWeight.bold, fontSize: 9, letterSpacing: 0.5),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              const Icon(Icons.trip_origin_rounded, size: 16, color: AppTheme.textMuted),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  fromStation,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppTheme.textPrimary),
                ),
              ),
              Text(
                '$stopCount STOPS · ~$durationMins MIN',
                style: const TextStyle(color: AppTheme.textMuted, fontSize: 11, fontWeight: FontWeight.w600),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              const Icon(Icons.place_rounded, size: 16, color: AppTheme.signalGreen),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  toStation,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppTheme.textPrimary),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChips(Color lineColor) {
    const filters = ['All Trains', 'Least Crowded', 'Earliest ETA'];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: List.generate(filters.length, (index) {
          final isSelected = _filterIndex == index;
          return Padding(
            padding: const EdgeInsets.only(right: 8.0),
            child: ChoiceChip(
              label: Text(filters[index]),
              selected: isSelected,
              selectedColor: lineColor.withValues(alpha: 0.2),
              backgroundColor: AppTheme.surfaceElevated,
              side: BorderSide(color: isSelected ? lineColor : const Color(0x1AFFFFFF)),
              labelStyle: TextStyle(
                color: isSelected ? lineColor : AppTheme.textMuted,
                fontWeight: FontWeight.bold,
                fontSize: 11,
              ),
              onSelected: (_) => setState(() => _filterIndex = index),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildSectionHeader(
    BuildContext context, {
    required IconData icon,
    required String label,
    required Color color,
    required Color dotColor,
    required bool isLive,
  }) {
    return Row(
      children: [
        if (isLive) ...[
          SizedBox(
            width: 10,
            height: 10,
            child: Container(
              decoration: BoxDecoration(
                color: dotColor,
                shape: BoxShape.circle,
              ),
            ).animate().fadeIn(duration: 400.ms),
          ),
          const SizedBox(width: 8),
        ],
        Icon(icon, color: color, size: 14),
        const SizedBox(width: 6),
        Text(
          label,
          style: TextStyle(
            color: color,
            fontSize: 10,
            fontWeight: FontWeight.bold,
            letterSpacing: 1.0,
          ),
        ),
      ],
    );
  }
}
