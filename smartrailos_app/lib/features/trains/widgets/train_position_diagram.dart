import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../core/constants/metro_data.dart';
import '../../../core/constants/theme.dart';

class TrainPositionDiagram extends StatelessWidget {
  final List<Station> stations;
  final int currentPositionIndex;
  final String fromStationId;
  final String toStationId;

  const TrainPositionDiagram({
    super.key,
    required this.stations,
    required this.currentPositionIndex,
    required this.fromStationId,
    required this.toStationId,
  });

  @override
  Widget build(BuildContext context) {
    const displayCount = 5;
    int startIndex = (currentPositionIndex - 2).clamp(0, stations.length - displayCount);
    if (startIndex < 0) startIndex = 0;
    
    final visibleStations = stations.skip(startIndex).take(displayCount).toList();
    final relativeCurrentIndex = currentPositionIndex - startIndex;

    final isBlue = stations.first.lineId == MetroLine.blue;
    final lineColor = isBlue ? AppTheme.blueLine : AppTheme.redLine;

    // Fixed vertical center for the track
    const double trackY = 30.0;

    return Container(
      height: 140,
      padding: const EdgeInsets.symmetric(horizontal: 40),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final totalWidth = constraints.maxWidth;
          final segmentWidth = totalWidth / (visibleStations.length - 1);

          return Stack(
            clipBehavior: Clip.none,
            children: [
              // 1. Background Track
              Positioned(
                top: trackY - 2, // Centering 4px track
                left: 0,
                right: 0,
                child: Container(
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              
              // 2. Active Track Fill
              Positioned(
                top: trackY - 2,
                left: 0,
                child: Container(
                  height: 4,
                  width: segmentWidth * relativeCurrentIndex.clamp(0, visibleStations.length - 1),
                  decoration: BoxDecoration(
                    color: lineColor,
                    borderRadius: BorderRadius.circular(2),
                    boxShadow: [
                      BoxShadow(color: lineColor.withValues(alpha: 0.3), blurRadius: 8),
                    ],
                  ),
                )
                .animate()
                .scale(begin: const Offset(0, 1), alignment: Alignment.centerLeft, duration: 800.ms),
              ),

              // 3. Station Nodes & Labels
              ...List.generate(visibleStations.length, (index) {
                final station = visibleStations[index];
                final isUserFrom = station.id == fromStationId;
                final isUserTo = station.id == toStationId;
                final isLarge = isUserFrom || isUserTo;
                final nodeSize = isLarge ? 14.0 : 8.0;
                final isPassed = index <= relativeCurrentIndex;
                
                return Positioned(
                  left: (index * segmentWidth) - 50,
                  width: 100,
                  top: trackY - (nodeSize / 2),
                  child: Column(
                    children: [
                      // Node Circle
                      Container(
                        width: nodeSize,
                        height: nodeSize,
                        decoration: BoxDecoration(
                          color: AppTheme.surfaceDark,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: isPassed ? lineColor : Colors.white.withValues(alpha: 0.2),
                            width: 2,
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      // Label
                      Text(
                        station.name.toUpperCase(),
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: isLarge ? FontWeight.w900 : FontWeight.bold,
                          color: isPassed ? AppTheme.textPrimary : AppTheme.textMuted,
                          letterSpacing: 0.5,
                        ),
                      ),
                      if (isLarge)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            isUserFrom ? 'START' : 'END',
                            style: TextStyle(
                              fontSize: 7,
                              fontWeight: FontWeight.w900,
                              color: lineColor,
                            ),
                          ),
                        ),
                    ],
                  ),
                );
              }),
              
              // 4. Train Dot
              Positioned(
                left: (relativeCurrentIndex * segmentWidth) - 8,
                top: trackY - 8, // Centering 16px dot
                child: Container(
                  width: 16,
                  height: 16,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    border: Border.all(color: lineColor, width: 3),
                    boxShadow: [
                      BoxShadow(color: lineColor, blurRadius: 12, spreadRadius: 2),
                    ],
                  ),
                )
                .animate()
                .fadeIn(duration: 400.ms)
                .scale(begin: const Offset(0.8, 0.8), end: const Offset(1.0, 1.0), duration: 400.ms),
              ),
            ],
          );
        },
      ),
    );
  }
}
