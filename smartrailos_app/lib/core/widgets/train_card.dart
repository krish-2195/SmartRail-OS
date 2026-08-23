import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../constants/metro_data.dart';
import '../constants/theme.dart';
import '../../features/trains/models/train_model.dart';

class TrainCard extends StatelessWidget {
  final TrainModel train;
  final int index;

  const TrainCard({super.key, required this.train, this.index = 0});

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
  Widget build(BuildContext context) {
    final isBlueLine = train.line == MetroLine.blue;
    final lineColor = isBlueLine ? AppTheme.blueLine : AppTheme.redLine;
    final lineNumber = isBlueLine ? '1' : '2';
    final lineName = isBlueLine ? 'Blue Line' : 'Red Line';
    final departureFormatted = _formatTime(train.departureTime);
    final arrivalFormatted = _formatTime(train.arrivalTime);

    // Calculate coach occupancy preview
    final totalPax = train.coaches.fold(0, (s, c) => s + c.currentPassengers);
    final totalCapacity = train.coaches.fold(0, (s, c) => s + c.capacity);
    final occupancyPct = totalCapacity > 0 ? (totalPax / totalCapacity) : 0.0;
    final crowdColor = AppTheme.coachColor(occupancyPct);

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(AppTheme.borderRadius),
        border: Border.all(color: const Color(0x1FFFFFFF)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.3),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppTheme.borderRadius),
        child: Container(
          decoration: BoxDecoration(
            border: Border(
              left: BorderSide(
                color: train.isAtPlatform ? AppTheme.signalGreen : lineColor,
                width: 4,
              ),
            ),
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () => context.push('/train/${train.trainId}', extra: train),
              splashColor: lineColor.withValues(alpha: 0.1),
              highlightColor: lineColor.withValues(alpha: 0.05),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Top Header: Line Disc, Train Title, Subtitle, and Live Badge
                    Row(
                      children: [
                        // Metro Line Disc
                        Container(
                          width: 34,
                          height: 34,
                          decoration: BoxDecoration(
                            color: lineColor,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: lineColor.withValues(alpha: 0.3),
                                blurRadius: 8,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Center(
                            child: Text(
                              lineNumber,
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w900,
                                fontSize: 15,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        // Train Name & Line direction
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                train.trainId == 'ESP32_DEMO' ? 'ESP32 Sensor Train' : train.displayName,
                                style: AppTheme.tabularNumberStyle.copyWith(
                                  fontSize: 15,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 0.5,
                                  color: AppTheme.textPrimary,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '$lineName · ${train.direction.toUpperCase()}${train.journeyDurationMinutes != null ? " · ${train.journeyDurationMinutes} MIN TRIP" : ""}',
                                style: const TextStyle(
                                  color: AppTheme.textMuted,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ),
                        // Platform / ETA Chip
                        if (train.isAtPlatform)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: AppTheme.signalGreen.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: AppTheme.signalGreen.withValues(alpha: 0.4)),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  width: 6,
                                  height: 6,
                                  decoration: const BoxDecoration(
                                    color: AppTheme.signalGreen,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                                const SizedBox(width: 6),
                                const Text(
                                  'ON STATION',
                                  style: TextStyle(
                                    color: AppTheme.signalGreen,
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ],
                            ),
                          )
                        else if (train.etaMinutes <= 0)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: AppTheme.signalGreen.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: AppTheme.signalGreen.withValues(alpha: 0.3)),
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.near_me_rounded, size: 12, color: AppTheme.signalGreen),
                                SizedBox(width: 4),
                                Text(
                                  'ARRIVING NOW',
                                  style: TextStyle(
                                    color: AppTheme.signalGreen,
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ],
                            ),
                          )
                        else
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: lineColor.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: lineColor.withValues(alpha: 0.3)),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.schedule_rounded, size: 12, color: lineColor),
                                const SizedBox(width: 4),
                                Text(
                                  '${train.etaMinutes} MIN ETA',
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

                    const SizedBox(height: 14),
                    const Divider(height: 1, color: Color(0x0DFFFFFF)),
                    const SizedBox(height: 14),

                    // Metrics Row: Departure, ETA Pill, Arrival, and Tap Arrow
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        // Origin Departure
                        _buildTimingMetric(
                          label: 'DEPARTURE',
                          time: departureFormatted,
                          sublabel: 'From origin',
                          icon: Icons.trip_origin_rounded,
                          color: lineColor,
                        ),

                        // Middle ETA Pill with Coach Occupancy dot
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: AppTheme.surfaceDark,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0x1AFFFFFF)),
                          ),
                          child: Column(
                            children: [
                              Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Container(
                                    width: 5,
                                    height: 5,
                                    decoration: BoxDecoration(
                                      color: train.isAtPlatform ? AppTheme.signalGreen : crowdColor,
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    train.isAtPlatform
                                        ? 'LIVE'
                                        : (train.etaMinutes <= 0 ? 'STATUS' : 'ETA'),
                                    style: TextStyle(
                                      color: train.isAtPlatform ? AppTheme.signalGreen : crowdColor,
                                      fontSize: 8,
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 2),
                              Text(
                                train.isAtPlatform
                                    ? 'ON STATION'
                                    : (train.etaMinutes <= 0 ? 'ARRIVING' : '${train.etaMinutes}m'),
                                style: AppTheme.tabularNumberStyle.copyWith(
                                  fontSize: train.isAtPlatform || train.etaMinutes <= 0 ? 12 : 15,
                                  fontWeight: FontWeight.w900,
                                  color: train.isAtPlatform || train.etaMinutes <= 0
                                      ? AppTheme.signalGreen
                                      : AppTheme.textPrimary,
                                ),
                              ),
                            ],
                          ),
                        ),

                        // Destination Arrival
                        _buildTimingMetric(
                          label: 'ARRIVAL',
                          time: arrivalFormatted,
                          sublabel: train.destinationName ?? 'Destination',
                          icon: Icons.place_rounded,
                          color: AppTheme.signalGreen,
                        ),

                        // Detail chevron
                        const Icon(
                          Icons.chevron_right_rounded,
                          color: AppTheme.textMuted,
                          size: 22,
                        ),
                      ],
                    ),

                    if (train.coaches.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      // Mini coach occupancy breakdown bar
                      Row(
                        children: [
                          const Icon(Icons.directions_subway_rounded, size: 12, color: AppTheme.textMuted),
                          const SizedBox(width: 6),
                          const Text(
                            'COACH LOAD:',
                            style: TextStyle(fontSize: 8, fontWeight: FontWeight.bold, color: AppTheme.textMuted, letterSpacing: 0.5),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Row(
                              children: train.coaches.map((c) {
                                final isLadies = c.type.contains('Ladies');
                                final cColor = isLadies ? AppTheme.ladiesTint : AppTheme.coachColor(c.percentFull);
                                return Expanded(
                                  child: Container(
                                    margin: const EdgeInsets.symmetric(horizontal: 2),
                                    height: 4,
                                    decoration: BoxDecoration(
                                      color: cColor,
                                      borderRadius: BorderRadius.circular(2),
                                    ),
                                  ),
                                );
                              }).toList(),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            '${(occupancyPct * 100).round()}%',
                            style: AppTheme.tabularNumberStyle.copyWith(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: crowdColor,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    )
    .animate()
    .fadeIn(delay: (60 * index).ms, duration: 350.ms)
    .slideY(begin: 0.08, end: 0, curve: Curves.easeOutCubic, delay: (60 * index).ms);
  }

  Widget _buildTimingMetric({
    required String label,
    required String time,
    required String sublabel,
    required IconData icon,
    required Color color,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 11, color: color),
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
        const SizedBox(height: 3),
        Text(
          time,
          style: AppTheme.tabularNumberStyle.copyWith(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: AppTheme.textPrimary,
          ),
        ),
        const SizedBox(height: 1),
        Text(
          sublabel.toUpperCase(),
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
}
