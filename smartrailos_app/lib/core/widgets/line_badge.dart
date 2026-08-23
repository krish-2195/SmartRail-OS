import 'package:flutter/material.dart';
import '../constants/metro_data.dart';
import '../constants/theme.dart';

class LineBadge extends StatelessWidget {
  final MetroLine line;
  final bool isDisc;

  const LineBadge({super.key, required this.line, this.isDisc = false});

  @override
  Widget build(BuildContext context) {
    final color = line == MetroLine.blue ? AppTheme.blueLine : AppTheme.redLine;
    final label = line == MetroLine.blue ? 'BLUE LINE' : 'RED LINE';
    final number = line == MetroLine.blue ? '1' : '2';

    if (isDisc) {
      return Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        child: Center(
          child: Text(
            number,
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.bold,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}
