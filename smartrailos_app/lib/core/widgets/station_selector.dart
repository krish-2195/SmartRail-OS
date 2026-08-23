import 'package:flutter/material.dart';
import '../constants/metro_data.dart';
import '../constants/theme.dart';

class StationSelector extends StatelessWidget {
  final List<Station> stations;
  final Station? selectedStation;
  final String label;
  final Function(Station?) onChanged;
  final IconData icon;

  const StationSelector({
    super.key,
    required this.stations,
    this.selectedStation,
    required this.label,
    required this.onChanged,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final Station? effectiveValue = (selectedStation != null &&
            stations.any((s) => s.id == selectedStation!.id))
        ? stations.firstWhere((s) => s.id == selectedStation!.id)
        : null;

    return DropdownButtonFormField<Station>(
      key: ValueKey('${label}_${effectiveValue?.id}_${stations.length}'),
      initialValue: effectiveValue,
      icon: const Icon(Icons.unfold_more_rounded, color: AppTheme.textMuted, size: 20),
      dropdownColor: AppTheme.surfaceElevated,
      borderRadius: BorderRadius.circular(16),
      isExpanded: true,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon, color: AppTheme.blueLine, size: 20),
        filled: true,
        fillColor: AppTheme.surfaceDark,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      style: const TextStyle(
        color: AppTheme.textPrimary,
        fontWeight: FontWeight.w700,
        fontSize: 14,
      ),
      items: stations.map((station) {
        final isInterchange = station.name.contains('Old High Court');
        final isBlue = station.lineId == MetroLine.blue;
        final lineColor = isBlue ? AppTheme.blueLine : AppTheme.redLine;

        return DropdownMenuItem<Station>(
          value: station,
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: lineColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  station.id,
                  style: TextStyle(
                    color: lineColor,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  station.name,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 13, color: AppTheme.textPrimary),
                ),
              ),
              if (isInterchange) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppTheme.signalAmber.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text(
                    'TRANSFER',
                    style: TextStyle(
                      color: AppTheme.signalAmber,
                      fontSize: 8,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ],
            ],
          ),
        );
      }).toList(),
      onChanged: onChanged,
    );
  }
}
