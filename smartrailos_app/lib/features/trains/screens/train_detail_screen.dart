import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../core/constants/metro_data.dart';
import '../../../core/constants/theme.dart';
import '../../../core/widgets/coach_bar.dart';
import '../../../core/widgets/status_badge.dart';
import '../models/train_model.dart';
import '../models/coach_model.dart';
import '../models/announcement_model.dart';
import '../providers/train_search_provider.dart';

class TrainDetailScreen extends ConsumerWidget {
  final String trainId;
  final TrainModel? initialTrain;

  const TrainDetailScreen({
    super.key,
    required this.trainId,
    this.initialTrain,
  });

  String _formatTime(String? time) {
    if (time == null || time.isEmpty) return '--:--';
    if (time.contains('T')) {
      try {
        final parsed = DateTime.parse(time);
        return '${parsed.hour.toString().padLeft(2, '0')}:${parsed.minute.toString().padLeft(2, '0')}';
      } catch (_) {}
    }
    if (time.contains(':')) {
      final parts = time.split(':');
      if (parts.length >= 2) {
        final h = int.tryParse(parts[0]);
        final m = int.tryParse(parts[1]);
        if (h != null && m != null) {
          return '${h.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')}';
        }
      }
    }
    return time;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final effectiveFrom = initialTrain?.fromStationId ?? '';
    final effectiveTo = initialTrain?.toStationId ?? '';
    final effectiveLine = initialTrain?.line.name ?? 'blue';

    final params = (
      trainId: trainId,
      fromStationId: effectiveFrom,
      toStationId: effectiveTo,
      lineId: effectiveLine,
    );

    final trainAsync = ref.watch(liveTrainDetailProvider(params));

    // Prefer freshly streamed live train telemetry; fallback to initialTrain during initial load
    final TrainModel? train = trainAsync.value ?? initialTrain;

    if (train != null) {
      return _buildScaffoldWithTrain(context, ref, train, params);
    }

    return trainAsync.when(
      data: (t) => _buildScaffoldWithTrain(context, ref, t, params),
      loading: () => Scaffold(
        appBar: AppBar(title: Text('TRAIN $trainId')),
        body: const Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(color: AppTheme.blueLine),
              SizedBox(height: 16),
              Text(
                'CONNECTING TO TRAIN TELEMETRY...',
                style: TextStyle(color: AppTheme.textMuted, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.8),
              ),
            ],
          ),
        ),
      ),
      error: (err, stack) => Scaffold(
        appBar: AppBar(title: Text('TRAIN $trainId')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline_rounded, size: 48, color: AppTheme.textMuted),
                const SizedBox(height: 16),
                const Text(
                  'UNABLE TO FETCH TRAIN TELEMETRY',
                  style: TextStyle(color: AppTheme.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
                ),
                const SizedBox(height: 8),
                Text(
                  '$err',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppTheme.textMuted, fontSize: 11),
                ),
                const SizedBox(height: 20),
                ElevatedButton.icon(
                  onPressed: () => ref.invalidate(liveTrainDetailProvider(params)),
                  icon: const Icon(Icons.refresh, size: 16),
                  label: const Text('RETRY'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildScaffoldWithTrain(BuildContext context, WidgetRef ref, TrainModel train, TrainDetailParams params) {
    final isBlue = train.line == MetroLine.blue;
    final lineColor = isBlue ? AppTheme.blueLine : AppTheme.redLine;
    final lineName = isBlue ? 'Blue Line (Line 1)' : 'Red Line (Line 2)';
    final announcementsAsync = ref.watch(announcementsProvider(train.fromStationId));

    return Scaffold(
      appBar: AppBar(
        title: Text(train.trainId == 'ESP32_DEMO' ? 'ESP32 SENSOR TRAIN' : train.displayName.toUpperCase()),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, size: 20, color: AppTheme.textSecondary),
            tooltip: 'Refresh Telemetry',
            onPressed: () {
              ref.invalidate(liveTrainDetailProvider(params));
            },
          ),
          Container(
            margin: const EdgeInsets.only(right: 16),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: lineColor.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: lineColor.withValues(alpha: 0.4)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(color: lineColor, shape: BoxShape.circle),
                ),
                const SizedBox(width: 6),
                Text(
                  lineName.toUpperCase(),
                  style: TextStyle(
                    color: lineColor,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.5,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: lineColor,
        backgroundColor: AppTheme.surfaceElevated,
        onRefresh: () async {
          ref.invalidate(liveTrainDetailProvider(params));
          await ref.read(liveTrainDetailProvider(params).future);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Active Announcements Banner (if any)
            () {
              final stationAnnouncements = announcementsAsync.asData?.value ?? [];
              final effectiveAnnouncements = stationAnnouncements.isNotEmpty
                  ? stationAnnouncements
                  : train.announcements;
              if (effectiveAnnouncements.isNotEmpty) {
                return _buildAnnouncementBanner(effectiveAnnouncements.first)
                    .animate()
                    .fadeIn()
                    .slideY(begin: -0.2, end: 0);
              }
              return const SizedBox.shrink();
            }(),

            // ── Section 1: Hero Overview & Schedule ──────────────────────
            _buildScheduleCard(train, lineColor)
                .animate()
                .fadeIn(duration: 400.ms)
                .slideY(begin: 0.05, end: 0),

            const SizedBox(height: 24),

            // ── Section 2: Coach Occupancy Breakdown ─────────────────────
            _buildSectionTitle('COACH OCCUPANCY & COMPOSITION', Icons.directions_subway_rounded),
            const SizedBox(height: 12),
            _buildCoachSection(train, lineColor)
                .animate()
                .fadeIn(delay: 250.ms)
                .slideY(begin: 0.05, end: 0),

            const SizedBox(height: 24),

            // ── Section 4: Live Stops & Crowd Timeline ───────────────────
            _buildSectionTitle('STATION TIMELINE & PLATFORM CROWD', Icons.timeline_rounded),
            const SizedBox(height: 12),
            _buildStopsTimelineCard(train, lineColor)
                .animate()
                .fadeIn(delay: 350.ms)
                .slideY(begin: 0.05, end: 0),

            const SizedBox(height: 24),

            // ── Section 5: Estimated Passenger Flow ───────────────────────
            _buildSectionTitle('PASSENGER FLOW TELEMETRY', Icons.sensors_rounded),
            const SizedBox(height: 12),
            Row(
              children: [
                _buildFlowTile(
                  'EST. BOARDING',
                  '${_calculateEstBoarding(train)}',
                  Icons.login_rounded,
                  AppTheme.signalGreen,
                ),
                const SizedBox(width: 12),
                _buildFlowTile(
                  'EST. ALIGHTING',
                  '${_calculateEstAlighting(train)}',
                  Icons.logout_rounded,
                  AppTheme.signalAmber,
                ),
              ],
            ).animate().fadeIn(delay: 450.ms).slideY(begin: 0.05, end: 0),

            const SizedBox(height: 40),
          ],
        ),
      ),
    ),
  );
}

  Widget _buildSectionTitle(String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, size: 15, color: AppTheme.textMuted),
        const SizedBox(width: 6),
        Text(
          title,
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 10,
            color: AppTheme.textMuted,
            letterSpacing: 1.0,
          ),
        ),
      ],
    );
  }

  Widget _buildScheduleCard(TrainModel train, Color lineColor) {
    final departureFormatted = _formatTime(train.departureTime);
    final arrivalFormatted = _formatTime(train.arrivalTime);

    return Container(
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x26FFFFFF)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.35),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top Row: Status, Platform, Direction
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  StatusBadge(status: train.status),
                  if (train.isAtPlatform) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppTheme.signalGreen.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppTheme.signalGreen.withValues(alpha: 0.4)),
                      ),
                      child: const Text(
                        'ON STATION',
                        style: TextStyle(
                          color: AppTheme.signalGreen,
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
              Row(
                children: [
                  const Icon(Icons.speed_rounded, size: 14, color: AppTheme.textMuted),
                  const SizedBox(width: 4),
                  Text(
                    'DIR: ${train.direction.toUpperCase()}',
                    style: const TextStyle(
                      color: AppTheme.textMuted,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.8,
                    ),
                  ),
                ],
              ),
            ],
          ),

          const SizedBox(height: 18),
          const Divider(height: 1, color: Color(0x0DFFFFFF)),
          const SizedBox(height: 18),

          // Timings Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildScheduleMetric(
                label: 'DEPARTURE',
                time: departureFormatted,
                subtext: 'Origin Platform',
                color: AppTheme.textPrimary,
                icon: Icons.trip_origin_rounded,
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: AppTheme.surfaceDark,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: (train.isAtPlatform || train.etaMinutes <= 0)
                      ? AppTheme.signalGreen.withValues(alpha: 0.35)
                      : lineColor.withValues(alpha: 0.35)),
                ),
                child: Column(
                  children: [
                    Text(
                      train.isAtPlatform ? 'LIVE STATUS' : 'ESTIMATED ETA',
                      style: TextStyle(
                        color: (train.isAtPlatform || train.etaMinutes <= 0) ? AppTheme.signalGreen : AppTheme.textMuted,
                        fontSize: 8,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      train.isAtPlatform
                          ? 'ON STATION'
                          : (train.etaMinutes <= 0 ? 'ARRIVING' : '${train.etaMinutes} MIN'),
                      style: AppTheme.tabularNumberStyle.copyWith(
                        fontSize: (train.isAtPlatform || train.etaMinutes <= 0) ? 13 : 16,
                        fontWeight: FontWeight.w900,
                        color: (train.isAtPlatform || train.etaMinutes <= 0) ? AppTheme.signalGreen : lineColor,
                      ),
                    ),
                  ],
                ),
              ),
              _buildScheduleMetric(
                label: 'DEST. ARRIVAL',
                time: arrivalFormatted,
                subtext: train.destinationName ?? 'Destination',
                color: AppTheme.textPrimary,
                icon: Icons.place_rounded,
              ),
            ],
          ),

          if (train.liveCurrentStationName != null || train.liveNextStationName != null) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: AppTheme.surfaceDark,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0x14FFFFFF)),
              ),
              child: Row(
                children: [
                  Icon(Icons.gps_fixed_rounded, size: 14, color: lineColor),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      train.liveStatus == 'AT_STATION'
                          ? 'Current Station: ${train.liveCurrentStationName}'
                          : 'In Transit: Towards ${train.liveNextStationName ?? "Next Stop"}',
                      style: const TextStyle(
                        color: AppTheme.textPrimary,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  if (train.journeyDurationMinutes != null)
                    Text(
                      '${train.journeyDurationMinutes} min trip',
                      style: const TextStyle(color: AppTheme.textMuted, fontSize: 10),
                    ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildScheduleMetric({
    required String label,
    required String time,
    required String subtext,
    required Color color,
    required IconData icon,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 11, color: AppTheme.textMuted),
            const SizedBox(width: 4),
            Text(
              label,
              style: const TextStyle(
                color: AppTheme.textMuted,
                fontSize: 9,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          time,
          style: AppTheme.tabularNumberStyle.copyWith(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          subtext.toUpperCase(),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            color: AppTheme.textMuted,
            fontSize: 9,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  Widget _buildCoachSection(TrainModel train, Color lineColor) {
    final coaches = train.coaches.isNotEmpty
        ? train.coaches
        : [
            CoachModel(coachNumber: 1, type: 'General', capacity: 400, currentPassengers: (train.totalPassengers * 0.35).round()),
            CoachModel(coachNumber: 2, type: 'Ladies', capacity: 400, currentPassengers: (train.totalPassengers * 0.25).round()),
            CoachModel(coachNumber: 3, type: 'General', capacity: 400, currentPassengers: (train.totalPassengers * 0.40).round()),
          ];

    final totalCapacity = coaches.fold(0, (s, c) => s + c.capacity);
    final totalPax = coaches.fold(0, (s, c) => s + c.currentPassengers);
    final totalPct = totalCapacity > 0 ? (totalPax / totalCapacity * 100).round() : 0;

    // Resolve station name for arrival estimation
    final stationList = getStationsForLine(train.line);
    final originStation = stationList.firstWhere(
      (s) => s.id == train.fromStationId,
      orElse: () => Station(id: train.fromStationId, name: train.fromStationId.isNotEmpty ? train.fromStationId : 'Selected Station', lineId: train.line, sequenceIndex: 0),
    );
    final fromStationName = originStation.name;

    // Predicted arrival calculations
    JourneyStopModel? originStop;
    if (train.stopsTimeline.isNotEmpty) {
      try {
        originStop = train.stopsTimeline.firstWhere(
          (s) => s.isUserOrigin || s.stationId == train.fromStationId,
        );
      } catch (_) {
        originStop = train.stopsTimeline.first;
      }
    }

    final predictedTotalPax = (originStop != null && originStop.estimatedTrainOccupancy > 0)
        ? originStop.estimatedTrainOccupancy
        : (train.predictedStationCrowd != null && train.predictedStationCrowd! > 0)
            ? train.predictedStationCrowd!
            : totalPax;
    final predictedTotalPct = totalCapacity > 0 ? (predictedTotalPax / totalCapacity * 100).round() : 0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── CARD 1: Current Live Passengers (Right Now) ───────────────
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: AppTheme.surfaceElevated,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0x1AFFFFFF)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Summary Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: BoxDecoration(
                              color: lineColor,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 6),
                          const Text(
                            'CURRENT PASSENGERS (RIGHT NOW)',
                            style: TextStyle(
                              color: AppTheme.textMuted,
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Text(
                            '$totalPax',
                            style: AppTheme.tabularNumberStyle.copyWith(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: AppTheme.textPrimary,
                            ),
                          ),
                          Text(
                            ' / $totalCapacity PAX',
                            style: const TextStyle(
                              color: AppTheme.textMuted,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: (totalPct > 80
                              ? AppTheme.signalRed
                              : totalPct > 50
                                  ? AppTheme.signalAmber
                                  : AppTheme.signalGreen)
                          .withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      '$totalPct% CAPACITY',
                      style: TextStyle(
                        color: totalPct > 80
                            ? AppTheme.signalRed
                            : totalPct > 50
                                ? AppTheme.signalAmber
                                : AppTheme.signalGreen,
                        fontWeight: FontWeight.bold,
                        fontSize: 10,
                      ),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 16),
              const Divider(height: 1, color: Color(0x0DFFFFFF)),
              const SizedBox(height: 16),

              // Coach Bars
              ...coaches.map((c) => CoachBar(coach: c)),
            ],
          ),
        ),

        // ── CARD 2: Estimated On Arrival At Selected Station ──────────
        if (!train.isAtPlatform) ...[
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppTheme.surfaceElevated,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppTheme.signalAmber.withValues(alpha: 0.35)),
              boxShadow: [
                BoxShadow(
                  color: AppTheme.signalAmber.withValues(alpha: 0.05),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Summary Header
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.auto_graph_rounded, size: 13, color: AppTheme.signalAmber),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  'EST. ON ARRIVAL AT ${fromStationName.toUpperCase()}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: AppTheme.signalAmber,
                                    fontSize: 9,
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              Text(
                                '~$predictedTotalPax',
                                style: AppTheme.tabularNumberStyle.copyWith(
                                  fontSize: 20,
                                  fontWeight: FontWeight.bold,
                                  color: AppTheme.textPrimary,
                                ),
                              ),
                              Text(
                                ' / $totalCapacity PAX',
                                style: const TextStyle(
                                  color: AppTheme.textMuted,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: (predictedTotalPct > 80
                                ? AppTheme.signalRed
                                : predictedTotalPct > 50
                                    ? AppTheme.signalAmber
                                    : AppTheme.signalGreen)
                            .withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: (predictedTotalPct > 80
                                  ? AppTheme.signalRed
                                  : predictedTotalPct > 50
                                      ? AppTheme.signalAmber
                                      : AppTheme.signalGreen)
                              .withValues(alpha: 0.35),
                        ),
                      ),
                      child: Text(
                        '~$predictedTotalPct% PREDICTED',
                        style: TextStyle(
                          color: predictedTotalPct > 80
                              ? AppTheme.signalRed
                              : predictedTotalPct > 50
                                  ? AppTheme.signalAmber
                                  : AppTheme.signalGreen,
                          fontWeight: FontWeight.bold,
                          fontSize: 10,
                        ),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 16),
                const Divider(height: 1, color: Color(0x0DFFFFFF)),
                const SizedBox(height: 16),

                // Predicted Coach Bars
                ...coaches.map((c) {
                  final coachShare = totalPax > 0
                      ? c.currentPassengers / totalPax
                      : 1.0 / coaches.length;
                  final predCoachPax = (predictedTotalPax * coachShare).round();
                  return CoachBar(
                    coach: c,
                    isPredicted: true,
                    predictedPassengers: predCoachPax,
                  );
                }),

                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppTheme.surfaceDark,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline_rounded, size: 12, color: AppTheme.textMuted),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          'Estimated based on AI crowd forecasts and intermediate station boardings before $fromStationName.',
                          style: const TextStyle(color: AppTheme.textMuted, fontSize: 9),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildStopsTimelineCard(TrainModel train, Color lineColor) {
    final List<JourneyStopModel> stops = train.stopsTimeline.isNotEmpty
        ? train.stopsTimeline
        : () {
            final stations = getStationsForLine(train.line);
            final fromIdx = stations.indexWhere((s) => s.id == train.fromStationId);
            final toIdx = stations.indexWhere((s) => s.id == train.toStationId);
            if (fromIdx == -1 || toIdx == -1) return <JourneyStopModel>[];
            final list = <JourneyStopModel>[];
            final step = fromIdx <= toIdx ? 1 : -1;
            for (int i = fromIdx; (step > 0 ? i <= toIdx : i >= toIdx); i += step) {
              final st = stations[i];
              list.add(JourneyStopModel(
                stationId: st.id,
                stationName: st.name,
                arrivalTime: '--:--',
                departureTime: '--:--',
                isUserOrigin: st.id == train.fromStationId,
                isUserDestination: st.id == train.toStationId,
                predictedStationCrowd: train.predictedStationCrowd ?? 120,
                estimatedTrainOccupancy: train.totalPassengers,
              ));
            }
            return list;
          }();

    if (stops.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppTheme.surfaceElevated,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0x1AFFFFFF)),
        ),
        child: const Center(
          child: Text(
            'Route timeline unavailable for this service',
            style: TextStyle(color: AppTheme.textMuted, fontSize: 11),
          ),
        ),
      );
    }

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
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: List.generate(stops.length, (i) {
                final s = stops[i];
                final isLast = i == stops.length - 1;
                final isPassed = s.isPassed;
                final isCurrent = s.isCurrent;
                final isUserStop = s.isUserOrigin || s.isUserDestination;

                final nodeColor = isCurrent
                    ? AppTheme.signalGreen
                    : isPassed
                        ? AppTheme.textMuted.withValues(alpha: 0.4)
                        : isUserStop
                            ? lineColor
                            : lineColor.withValues(alpha: 0.7);

                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Node icon
                        Stack(
                          alignment: Alignment.center,
                          children: [
                            if (isCurrent)
                              Container(
                                width: 22,
                                height: 22,
                                decoration: BoxDecoration(
                                  color: AppTheme.signalGreen.withValues(alpha: 0.25),
                                  shape: BoxShape.circle,
                                ),
                              ),
                            Container(
                              width: isUserStop || isCurrent ? 14 : 10,
                              height: isUserStop || isCurrent ? 14 : 10,
                              decoration: BoxDecoration(
                                color: nodeColor,
                                shape: BoxShape.circle,
                                border: isUserStop
                                    ? Border.all(color: Colors.white, width: 2)
                                    : null,
                              ),
                              child: isPassed
                                  ? const Icon(Icons.check, size: 7, color: Colors.black)
                                  : null,
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        // Station ID / Name
                        Text(
                          s.stationId,
                          style: TextStyle(
                            color: isPassed
                                ? AppTheme.textMuted.withValues(alpha: 0.5)
                                : isCurrent || isUserStop
                                    ? Colors.white
                                    : AppTheme.textPrimary,
                            fontSize: 11,
                            fontWeight: isUserStop || isCurrent ? FontWeight.bold : FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 2),
                        // Time
                        Text(
                          _formatTime(s.arrivalTime),
                          style: AppTheme.tabularNumberStyle.copyWith(
                            color: isPassed
                                ? AppTheme.textMuted.withValues(alpha: 0.4)
                                : isUserStop
                                    ? lineColor
                                    : AppTheme.textMuted,
                            fontSize: 9,
                            fontWeight: isUserStop ? FontWeight.bold : FontWeight.normal,
                          ),
                        ),
                        const SizedBox(height: 3),
                        // Crowd indicator
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                          decoration: BoxDecoration(
                            color: isPassed ? Colors.transparent : AppTheme.surfaceDark,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            isPassed ? 'Passed' : '${s.predictedStationCrowd} pax',
                            style: TextStyle(
                              color: isPassed
                                  ? AppTheme.textMuted.withValues(alpha: 0.4)
                                  : AppTheme.textMuted,
                              fontSize: 8,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (!isLast) ...[
                      // Track line
                      Container(
                        margin: const EdgeInsets.only(top: 5),
                        width: 50,
                        height: 2,
                        decoration: BoxDecoration(
                          color: isPassed
                              ? AppTheme.textMuted.withValues(alpha: 0.2)
                              : lineColor.withValues(alpha: 0.4),
                        ),
                      ),
                    ],
                  ],
                );
              }),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFlowTile(String label, String count, IconData icon, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.bold,
                    color: color,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  count,
                  style: AppTheme.tabularNumberStyle.copyWith(
                    fontWeight: FontWeight.bold,
                    fontSize: 20,
                    color: AppTheme.textPrimary,
                  ),
                ),
              ],
            )
          ],
        ),
      ),
    );
  }

  int _calculateEstBoarding(TrainModel train) {
    if (train.predictedStationCrowd != null && train.predictedStationCrowd! > 0) {
      return (train.predictedStationCrowd! * 0.4).round();
    }
    final hash = train.trainId.hashCode.abs();
    return 20 + (hash % 25);
  }

  int _calculateEstAlighting(TrainModel train) {
    if (train.totalPassengers > 0) {
      return (train.totalPassengers * 0.15).round();
    }
    final hash = train.trainId.hashCode.abs();
    return 15 + ((hash ~/ 3) % 20);
  }

  Widget _buildAnnouncementBanner(dynamic announcement) {
    final String message;
    AnnouncementSeverity severity = AnnouncementSeverity.info;
    if (announcement is AnnouncementModel) {
      message = announcement.message;
      severity = announcement.severity;
    } else if (announcement is Map) {
      message = announcement['message']?.toString() ?? announcement['text']?.toString() ?? '';
      final parsed = AnnouncementModel.fromJson(Map<String, dynamic>.from(announcement));
      severity = parsed.severity;
    } else {
      message = announcement?.toString() ?? '';
      severity = AnnouncementModel.inferSeverity(null, message, null);
    }

    if (message.trim().isEmpty) return const SizedBox.shrink();

    final Color bannerColor;
    final IconData bannerIcon;
    switch (severity) {
      case AnnouncementSeverity.emergency:
        bannerColor = AppTheme.signalRed;
        bannerIcon = Icons.emergency_rounded;
        break;
      case AnnouncementSeverity.warning:
        bannerColor = AppTheme.signalAmber;
        bannerIcon = Icons.warning_amber_rounded;
        break;
      case AnnouncementSeverity.info:
        bannerColor = AppTheme.blueLine;
        bannerIcon = Icons.info_outline_rounded;
        break;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: bannerColor.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(16),
        border: Border(
          left: BorderSide(color: bannerColor, width: 4),
        ),
      ),
      child: Row(
        children: [
          Icon(bannerIcon, color: bannerColor, size: 24),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              message.toUpperCase(),
              style: const TextStyle(
                color: AppTheme.textPrimary,
                fontWeight: FontWeight.bold,
                fontSize: 12,
                letterSpacing: 0.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
