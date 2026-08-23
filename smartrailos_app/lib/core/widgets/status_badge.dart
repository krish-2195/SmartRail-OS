import 'package:flutter/material.dart';
import '../constants/theme.dart';
import '../../features/trains/models/train_model.dart';

class StatusBadge extends StatelessWidget {
  final TrainStatus status;

  const StatusBadge({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final color = _getStatusColor(status);
    
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color.withValues(alpha: 0.5)),
      ),

      child: Text(
        status.name.toUpperCase(),
        style: TextStyle(
          color: color,
          fontSize: 9,
          fontWeight: FontWeight.w900,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Color _getStatusColor(TrainStatus status) {
    switch (status) {
      case TrainStatus.normal: return AppTheme.signalGreen;
      case TrainStatus.moderate: return AppTheme.signalAmber;
      case TrainStatus.full: return AppTheme.signalRed;
      case TrainStatus.emergency: return AppTheme.ladiesTint;
    }
  }
}
