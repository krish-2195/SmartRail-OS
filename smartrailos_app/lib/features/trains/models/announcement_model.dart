enum AnnouncementSeverity { info, warning, emergency }

class AnnouncementModel {
  final String message;
  final AnnouncementSeverity severity;
  final String? trainId;

  AnnouncementModel({
    required this.message,
    required this.severity,
    this.trainId,
  });

  static AnnouncementSeverity inferSeverity(String? explicitSeverity, String? message, String? context) {
    if (explicitSeverity != null && explicitSeverity.isNotEmpty) {
      final normalized = explicitSeverity.toLowerCase().trim();
      for (final s in AnnouncementSeverity.values) {
        if (s.name.toLowerCase() == normalized) {
          return s;
        }
      }
      if (normalized.contains('emerg') || normalized.contains('crit') || normalized.contains('danger')) {
        return AnnouncementSeverity.emergency;
      }
      if (normalized.contains('warn') || normalized.contains('alert') || normalized.contains('delay')) {
        return AnnouncementSeverity.warning;
      }
    }

    final combined = '${context ?? ''} ${message ?? ''}'.toLowerCase();
    if (combined.contains('emergency') ||
        combined.contains('critical') ||
        combined.contains('danger') ||
        combined.contains('evacuat') ||
        combined.contains('suspended') ||
        combined.contains('derail') ||
        combined.contains('fire') ||
        combined.contains('collision') ||
        combined.contains('hazard') ||
        combined.contains('sos')) {
      return AnnouncementSeverity.emergency;
    }

    if (combined.contains('warning') ||
        combined.contains('delay') ||
        combined.contains('slow') ||
        combined.contains('alert') ||
        combined.contains('caution') ||
        combined.contains('maintenance') ||
        combined.contains('crowd') ||
        combined.contains('disrupt') ||
        combined.contains('breakdown') ||
        combined.contains('halted')) {
      return AnnouncementSeverity.warning;
    }

    return AnnouncementSeverity.info;
  }

  factory AnnouncementModel.fromJson(Map<String, dynamic> json) {
    final msg = (json['message'] ?? json['text'] ?? '').toString();
    final explicitSev = json['severity']?.toString() ?? json['type']?.toString();
    final ctx = json['context']?.toString() ?? json['context_info']?.toString();
    return AnnouncementModel(
      message: msg,
      severity: inferSeverity(explicitSev, msg, ctx),
      trainId: json['trainId'] ?? json['train_id'],
    );
  }
}
