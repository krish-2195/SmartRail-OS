import 'dart:async';
import 'package:flutter/foundation.dart';
import 'dart:io' show Platform;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;

class AppConfig {
  static const String _envBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: '');
  static String? _customUrl;
  static String? _workingUrl;

  static const String _prefKey = 'smartrail_custom_api_base_url';

  static Future<void> init() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getString(_prefKey);
      if (saved != null && saved.trim().isNotEmpty) {
        _customUrl = saved.trim();
        _workingUrl = _customUrl;
      }
    } catch (_) {}
  }

  static List<String> get candidateUrls {
    if (_customUrl != null && _customUrl!.isNotEmpty) {
      return [_customUrl!];
    }
    if (_envBaseUrl.isNotEmpty) return [_envBaseUrl];
    if (kIsWeb) {
      return const [
        'http://localhost:8000',
        'http://127.0.0.1:8000',
        'http://172.22.218.104:8000',
      ];
    }
    try {
      if (Platform.isAndroid) {
        return const [
          'http://127.0.0.1:8000',      // ADB reverse port-forwarded loopback (Fastest over USB)
          'http://localhost:8000',      // Localhost alias
          'http://172.22.218.104:8000', // Wi-Fi LAN host IP
          'http://10.0.2.2:8000',       // Android Emulator loopback
        ];
      }
    } catch (_) {}
    return const [
      'http://localhost:8000',
      'http://127.0.0.1:8000',
      'http://172.22.218.104:8000',
    ];
  }

  static String get baseUrl => _workingUrl ?? candidateUrls.first;

  static void setWorkingUrl(String url) {
    _workingUrl = url;
  }

  static Future<void> setCustomBaseUrl(String url) async {
    var clean = url.trim().replaceAll(RegExp(r'/+$'), '');
    if (clean.isNotEmpty && !clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'https://$clean';
    }
    _customUrl = clean.isNotEmpty ? clean : null;
    _workingUrl = _customUrl;
    try {
      final prefs = await SharedPreferences.getInstance();
      if (_customUrl != null) {
        await prefs.setString(_prefKey, _customUrl!);
      } else {
        await prefs.remove(_prefKey);
      }
    } catch (_) {}
  }

  /// Quickly probe candidate URLs in parallel to discover the active backend.
  static Future<String?> discoverWorkingUrl() async {
    if (_workingUrl != null) {
      if (await _pingUrl(_workingUrl!)) {
        return _workingUrl;
      }
    }

    final candidates = candidateUrls;
    final futures = candidates.map((url) async {
      final ok = await _pingUrl(url);
      return ok ? url : null;
    });

    final results = await Future.wait(futures);
    for (final res in results) {
      if (res != null) {
        _workingUrl = res;
        return res;
      }
    }
    return null;
  }

  static Map<String, String> get defaultHeaders => const {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    'bypass-tunnel-reminder': 'true',
  };

  static Future<bool> _pingUrl(String base) async {
    try {
      final uri = Uri.parse('$base/api/v1/esp32/live');
      final res = await http.get(uri, headers: defaultHeaders).timeout(const Duration(milliseconds: 3500));
      return res.statusCode < 500;
    } catch (_) {
      try {
        final uriHealth = Uri.parse('$base/health');
        final res = await http.get(uriHealth, headers: defaultHeaders).timeout(const Duration(milliseconds: 3500));
        return res.statusCode < 500;
      } catch (_) {
        return false;
      }
    }
  }

  static Map<String, String> authHeaders(String token) => {
    ...defaultHeaders,
    'Authorization': 'Bearer $token',
  };
}
