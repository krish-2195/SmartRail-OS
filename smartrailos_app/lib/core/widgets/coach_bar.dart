import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../constants/theme.dart';
import '../../features/trains/models/coach_model.dart';

class CoachBar extends StatelessWidget {
  final CoachModel coach;
  final bool isPredicted;
  final int? predictedPassengers;

  const CoachBar({
    super.key,
    required this.coach,
    this.isPredicted = false,
    this.predictedPassengers,
  });

  String _getCrowdLabel(double percent) {
    if (percent < 0.35) return 'Seats Available';
    if (percent < 0.65) return 'Moderate Density';
    if (percent < 0.85) return 'Standing Room Only';
    return 'Heavily Packed';
  }

  @override
  Widget build(BuildContext context) {
    final effectivePassengers = (predictedPassengers ?? (isPredicted ? coach.predictedPassengersOnArrival : null) ?? coach.currentPassengers).clamp(0, coach.capacity);
    final effectivePercent = coach.capacity > 0 ? (effectivePassengers / coach.capacity).clamp(0.0, 1.0) : 0.0;

    final color = AppTheme.coachColor(effectivePercent);
    final isLadies = coach.type.contains('Ladies');
    const segmentsCount = 12;
    final filledSegments = (effectivePercent * segmentsCount).round();
    final crowdLabel = _getCrowdLabel(effectivePercent);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 22,
                    height: 22,
                    decoration: BoxDecoration(
                      color: isLadies
                          ? AppTheme.ladiesTint.withValues(alpha: 0.15)
                          : isPredicted
                              ? AppTheme.signalAmber.withValues(alpha: 0.12)
                              : Colors.white.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                        color: isLadies
                            ? AppTheme.ladiesTint.withValues(alpha: 0.4)
                            : isPredicted
                                ? AppTheme.signalAmber.withValues(alpha: 0.35)
                                : Colors.white.withValues(alpha: 0.15),
                      ),
                    ),
                    child: Center(
                      child: Text(
                        'C${coach.coachNumber}',
                        style: TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 9,
                          color: isLadies
                              ? AppTheme.ladiesTint
                              : isPredicted
                                  ? AppTheme.signalAmber
                                  : AppTheme.textPrimary,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'COACH ${coach.coachNumber}',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                      color: AppTheme.textPrimary,
                      fontFamily: AppTheme.tabularNumberStyle.fontFamily,
                    ),
                  ),
                  if (isLadies) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppTheme.ladiesTint.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: AppTheme.ladiesTint.withValues(alpha: 0.35)),
                      ),
                      child: const Text(
                        'LADIES SPECIAL',
                        style: TextStyle(
                          color: AppTheme.ladiesTint,
                          fontSize: 8,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
              Row(
                children: [
                  Text(
                    isPredicted ? '~$crowdLabel' : crowdLabel,
                    style: TextStyle(
                      color: color,
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '${isPredicted ? "~" : ""}${(effectivePercent * 100).toInt()}%',
                    style: AppTheme.tabularNumberStyle.copyWith(
                      color: color,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 8),
          Container(
            height: 14,
            padding: const EdgeInsets.all(2),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.3),
              borderRadius: BorderRadius.circular(5),
              border: Border.all(
                color: isPredicted
                    ? AppTheme.signalAmber.withValues(alpha: 0.25)
                    : Colors.white.withValues(alpha: 0.08),
              ),
              boxShadow: isLadies
                  ? [
                      BoxShadow(
                        color: AppTheme.ladiesTint.withValues(alpha: 0.15),
                        blurRadius: 6,
                        spreadRadius: 1,
                      )
                    ]
                  : null,
            ),
            child: Row(
              children: List.generate(segmentsCount, (index) {
                final isFilled = index < filledSegments;
                return Expanded(
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 1),
                    decoration: BoxDecoration(
                      color: isFilled ? color : Colors.white.withValues(alpha: 0.05),
                      borderRadius: BorderRadius.circular(2),
                      boxShadow: isFilled
                          ? [
                              BoxShadow(
                                color: color.withValues(alpha: 0.3),
                                blurRadius: 4,
                              )
                            ]
                          : null,
                    ),
                  )
                  .animate()
                  .fadeIn(delay: (20 * index).ms)
                  .scale(begin: const Offset(0, 1), alignment: Alignment.centerLeft, delay: (20 * index).ms),
                );
              }),
            ),
          ),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                isPredicted
                    ? '~$effectivePassengers / ${coach.capacity} EST. ON ARRIVAL'
                    : '$effectivePassengers / ${coach.capacity} PASSENGERS',
                style: const TextStyle(
                  color: AppTheme.textMuted,
                  fontSize: 9,
                  fontWeight: FontWeight.w600,
                ),
              ),
              Text(
                '${(coach.capacity - effectivePassengers).clamp(0, coach.capacity)} SEATS LEFT',
                style: const TextStyle(
                  color: AppTheme.textMuted,
                  fontSize: 9,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
