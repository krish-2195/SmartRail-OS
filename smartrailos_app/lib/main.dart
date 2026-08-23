import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:device_preview/device_preview.dart';
import 'app.dart';
import 'core/constants/app_config.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await AppConfig.init();
  runApp(
    DevicePreview(
      // Disable in release builds; enable in debug/profile
      enabled: !kReleaseMode,
      builder: (context) => const ProviderScope(
        child: MetroApp(),
      ),
    ),
  );
}
