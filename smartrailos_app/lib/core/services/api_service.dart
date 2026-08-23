import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../constants/app_config.dart';
import '../constants/metro_data.dart';
import '../../features/trains/models/train_model.dart';
import '../../features/trains/models/coach_model.dart';
import '../../features/trains/models/announcement_model.dart';
import '../../features/trains/models/esp_sensor_model.dart';
import '../../features/auth/models/user_model.dart';

final apiServiceProvider = Provider((ref) => ApiService());

class ApiService {
  Future<Map<String, String>> _getHeaders() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('auth_token');
    final headers = Map<String, String>.from(AppConfig.defaultHeaders);
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  /// Sends a GET request, automatically trying candidate URLs and retrying handshake errors
  Future<http.Response> _httpGet(String path,
      {Map<String, String>? headers}) async {
    final candidates = [
      AppConfig.baseUrl,
      ...AppConfig.candidateUrls.where((u) => u != AppConfig.baseUrl),
    ];

    final reqHeaders = headers ?? await _getHeaders();

    Object? lastError;
    for (final base in candidates) {
      for (int attempt = 0; attempt < 2; attempt++) {
        try {
          final uri = Uri.parse('$base$path');
          final res = await http
              .get(uri, headers: reqHeaders)
              .timeout(const Duration(milliseconds: 5000));
          if (res.statusCode < 500) {
            AppConfig.setWorkingUrl(base);
            return res;
          }
        } catch (e) {
          lastError = e;
          if (attempt == 0) {
            await Future.delayed(const Duration(milliseconds: 300));
          }
        }
      }
    }
    throw Exception(
        'Unable to reach backend at any host (${AppConfig.candidateUrls.join(", ")}): $lastError');
  }

  /// Sends a POST request, automatically trying candidate URLs and retrying handshake errors
  Future<http.Response> _httpPost(String path,
      {Map<String, String>? headers, Object? body}) async {
    final candidates = [
      AppConfig.baseUrl,
      ...AppConfig.candidateUrls.where((u) => u != AppConfig.baseUrl),
    ];

    final reqHeaders = headers ?? await _getHeaders();

    Object? lastError;
    for (final base in candidates) {
      for (int attempt = 0; attempt < 2; attempt++) {
        try {
          final uri = Uri.parse('$base$path');
          final res = await http
              .post(
                uri,
                headers: reqHeaders,
                body: body is String
                    ? body
                    : (body != null ? jsonEncode(body) : null),
              )
              .timeout(const Duration(milliseconds: 5000));
          if (res.statusCode < 500) {
            AppConfig.setWorkingUrl(base);
            return res;
          }
        } catch (e) {
          lastError = e;
          if (attempt == 0) {
            await Future.delayed(const Duration(milliseconds: 300));
          }
        }
      }
    }
    throw Exception(
        'Unable to reach backend at any host (${AppConfig.candidateUrls.join(", ")}): $lastError');
  }

  // TRAINS
  Future<List<TrainModel>> getUpcomingTrains(
      MetroLine line, String fromStationId, String toStationId) async {
    final headers = await _getHeaders();

    final resSearch = await _httpGet(
      '/api/v1/trains/search?from_station=$fromStationId&to_station=$toStationId',
      headers: headers,
    );

    if (resSearch.statusCode == 200) {
      final list = jsonDecode(resSearch.body) as List;
      return list.map((item) {
        final coaches = (item['coaches'] as List? ?? []).map((c) {
          final coachIdStr = c['coach_number']?.toString() ?? '1';
          final cleanId = coachIdStr.replaceAll(RegExp(r'[^0-9]'), '');
          return CoachModel(
            coachNumber: int.tryParse(cleanId.isNotEmpty ? cleanId : '1') ?? 1,
            type: (c['coach_type'] ?? 'standard').toString().toLowerCase() ==
                    'ladies'
                ? 'Ladies'
                : 'General',
            capacity: c['capacity'] ?? 400,
            currentPassengers: c['current_passenger_count'] ?? 0,
          );
        }).toList();

        final isPlatform = item['is_at_platform'] == true;
        final totalPax = item['current_occupancy'] ?? 0;

        final trainLine =
            (item['line_code'] ?? '').toString().toUpperCase() == 'RL'
                ? MetroLine.red
                : MetroLine.blue;
        final currentStationId = (item['live_current_station_id'] ??
                item['current_station_id'] ??
                fromStationId)
            .toString();
        final currentStationName = (item['live_current_station_name'] ??
                item['current_station_name'] ??
                '')
            .toString();
        final explicitIdx = item['currentPositionIndex'] is int
            ? item['currentPositionIndex'] as int
            : (item['current_position_index'] is int
                ? item['current_position_index'] as int
                : null);
        final posIndex = _resolveStationIndex(
          trainLine,
          stationId: currentStationId,
          stationName: currentStationName,
          explicitIndex: explicitIdx,
        );

        return TrainModel(
          trainId: item['train_id'] ?? '',
          displayName: item['train_name'] ?? item['train_id'] ?? '',
          line: trainLine,
          direction: item['direction'] ?? 'UP',
          etaMinutes: item['eta_minutes'] ?? 0,
          departureMinutes: (item['eta_minutes'] ?? 0) + 1,
          coaches: coaches,
          status: totalPax >= 1020
              ? TrainStatus.full
              : totalPax >= 600
                  ? TrainStatus.moderate
                  : TrainStatus.normal,
          currentPositionIndex: posIndex,
          fromStationId: fromStationId,
          toStationId: toStationId,
          announcements: [],
          arrivalTime: item['arrival_time'], // Destination arrival time
          departureTime: item['departure_time'], // Origin departure time
          isAtPlatform: isPlatform,
          journeyDurationMinutes: item['journey_duration_minutes'],
          destinationName: item['to_station_name'],
          predictedStationCrowd: item['predicted_station_crowd'],
          liveCurrentStationId: item['live_current_station_id'],
          liveCurrentStationName: item['live_current_station_name'],
          liveNextStationId: item['live_next_station_id'],
          liveNextStationName: item['live_next_station_name'],
          liveStatus: item['live_status'] ?? 'SCHEDULED',
          journeyProgressPct:
              ((item['journey_progress_pct'] ?? 0.0) as num).toDouble(),
          stopsTimeline: (item['stops_timeline'] as List? ?? [])
              .map((e) => JourneyStopModel.fromJson(e))
              .toList(),
        );
      }).toList();
    } else {
      throw Exception(
          'Server error searching trains (${resSearch.statusCode}): ${resSearch.body}');
    }
  }

  int _resolveStationIndex(MetroLine line,
      {String? stationId, String? stationName, int? explicitIndex}) {
    if (explicitIndex != null && explicitIndex >= 0) return explicitIndex;
    final stations = getStationsForLine(line);
    final sid = (stationId ?? '').trim().toLowerCase();
    final sname = (stationName ?? '').trim().toLowerCase();
    if (sid.isEmpty && sname.isEmpty) return 0;
    final idx = stations.indexWhere(
      (s) =>
          (sid.isNotEmpty && s.id.toLowerCase() == sid) ||
          (sname.isNotEmpty && s.name.toLowerCase() == sname),
    );
    return idx != -1 ? idx : 0;
  }

  Future<TrainModel> getTrainDetail(String trainId) async {
    final headers = await _getHeaders();
    try {
      final res = await _httpGet(
        '/api/v1/trains/at-station',
        headers: headers,
      );
      if (res.statusCode == 200) {
        final list = jsonDecode(res.body) as List;
        final t = list.firstWhere((e) => e['train_id'] == trainId,
            orElse: () => null);
        if (t != null) {
          final coaches = (t['coaches'] as List? ?? []).map((c) {
            final coachIdStr = c['coach_number']?.toString() ?? '1';
            final cleanId = coachIdStr.replaceAll(RegExp(r'[^0-9]'), '');
            return CoachModel(
              coachNumber:
                  int.tryParse(cleanId.isNotEmpty ? cleanId : '1') ?? 1,
              type: (c['coach_type'] ?? 'standard').toString().toLowerCase() ==
                      'ladies'
                  ? 'Ladies'
                  : 'General',
              capacity: c['capacity'] ?? 400,
              currentPassengers: c['current_passenger_count'] ?? 0,
            );
          }).toList();

          final totalPax = coaches.fold(0, (s, c) => s + c.currentPassengers);
          final line = t['line_name'].toString().toLowerCase().contains('blue')
              ? MetroLine.blue
              : MetroLine.red;
          final isPlatform =
              (t['status'] ?? '').toString().toUpperCase() == 'AT_STATION';
          final currStationId =
              (t['current_station_id'] ?? t['live_current_station_id'] ?? '')
                  .toString();
          final currStationName =
              (t['current_station'] ?? t['live_current_station_name'] ?? '')
                  .toString();
          final explicitIdx = t['currentPositionIndex'] is int
              ? t['currentPositionIndex'] as int
              : (t['current_position_index'] is int
                  ? t['current_position_index'] as int
                  : null);
          final posIndex = _resolveStationIndex(
            line,
            stationId: currStationId,
            stationName: currStationName,
            explicitIndex: explicitIdx,
          );

          return TrainModel(
            trainId: t['train_id'] ?? trainId,
            displayName: t['train_name'] ?? trainId,
            line: line,
            direction: t['direction'] ?? 'UP',
            etaMinutes: ((t['eta_seconds'] ?? 0) / 60).round(),
            departureMinutes: 2,
            coaches: coaches,
            status: totalPax >= 1020
                ? TrainStatus.full
                : totalPax >= 600
                    ? TrainStatus.moderate
                    : TrainStatus.normal,
            currentPositionIndex: posIndex,
            fromStationId:
                t['current_station_id'] ?? t['current_station'] ?? '',
            toStationId: t['next_station_id'] ?? t['next_station'] ?? '',
            announcements: [],
            arrivalTime: t['arrival_time'],
            departureTime: t['departure_time'],
            isAtPlatform: isPlatform,
            liveCurrentStationId: t['current_station_id'],
            liveCurrentStationName: t['current_station'],
            liveNextStationId: t['next_station_id'],
            liveNextStationName: t['next_station'],
            liveStatus:
                t['status'] ?? (isPlatform ? 'AT_STATION' : 'IN_TRANSIT'),
            journeyProgressPct:
                ((t['journey_completed_pct'] ?? 0.0) as num).toDouble(),
            stopsTimeline: [],
          );
        }
      }
    } catch (_) {}

    // Fallback: check occupancy endpoint /api/v1/occupancy/trains/$trainId
    try {
      final resOcc = await _httpGet(
        '/api/v1/occupancy/trains/$trainId',
        headers: headers,
      );
      if (resOcc.statusCode == 200) {
        final data = jsonDecode(resOcc.body);
        final coaches = (data['coaches'] as List? ?? []).map((c) {
          final coachIdStr = c['coach_number']?.toString() ?? '1';
          final cleanId = coachIdStr.replaceAll(RegExp(r'[^0-9]'), '');
          return CoachModel(
            coachNumber: int.tryParse(cleanId.isNotEmpty ? cleanId : '1') ?? 1,
            type: (c['coach_type'] ?? 'standard').toString().toLowerCase() ==
                    'ladies'
                ? 'Ladies'
                : 'General',
            capacity: c['capacity'] ?? 400,
            currentPassengers: c['current_passenger_count'] ?? 0,
          );
        }).toList();
        final totalPax = data['total_occupancy'] ??
            coaches.fold(0, (s, c) => s + c.currentPassengers);
        final lineCode = (data['line_code'] ?? '').toString().toUpperCase();
        final line = lineCode == 'RL' ? MetroLine.red : MetroLine.blue;
        final currStationId = (data['current_station_id'] ??
                data['live_current_station_id'] ??
                '')
            .toString();
        final currStationName = (data['current_station_name'] ??
                data['current_station'] ??
                data['live_current_station_name'] ??
                '')
            .toString();
        final explicitIdx = data['currentPositionIndex'] is int
            ? data['currentPositionIndex'] as int
            : (data['current_position_index'] is int
                ? data['current_position_index'] as int
                : null);
        final posIndex = _resolveStationIndex(
          line,
          stationId: currStationId,
          stationName: currStationName,
          explicitIndex: explicitIdx,
        );

        return TrainModel(
          trainId: data['train_id'] ?? trainId,
          displayName: data['train_name'] ?? trainId,
          line: line,
          direction: data['direction'] ?? 'UP',
          etaMinutes: 0,
          departureMinutes: 2,
          coaches: coaches,
          status: totalPax >= 1020
              ? TrainStatus.full
              : totalPax >= 600
                  ? TrainStatus.moderate
                  : TrainStatus.normal,
          currentPositionIndex: posIndex,
          fromStationId: data['current_station_id'] ?? '',
          toStationId: data['next_station_id'] ?? '',
          announcements: [],
          liveCurrentStationId: data['current_station_id'],
          liveCurrentStationName: data['current_station_name'],
          liveNextStationId: data['next_station_id'],
          liveNextStationName: data['next_station_name'],
          liveStatus: data['status'] ?? 'IN_TRANSIT',
        );
      }
    } catch (_) {}

    throw Exception('Train $trainId not found');
  }

  Future<List<CoachModel>> getCoachOccupancy(String trainId) async {
    try {
      final train = await getTrainDetail(trainId);
      return train.coaches;
    } catch (e) {
      return [];
    }
  }

  Future<List<AnnouncementModel>> getActiveAnnouncements(
      String stationId) async {
    try {
      final headers = await _getHeaders();
      final res = await _httpGet(
        '/api/v1/announcements/active',
        headers: headers,
      );
      if (res.statusCode == 200) {
        final list = jsonDecode(res.body) as List;
        return list
            .map(
                (e) => AnnouncementModel.fromJson(Map<String, dynamic>.from(e)))
            .toList();
      }
    } catch (e) {
      debugPrint('Error fetching announcements: $e');
    }
    return [];
  }

  // SAVED ROUTES (COMMUTER PREFERENCES)
  Future<List<Map<String, String>>> getSavedRoutes() async {
    final prefs = await SharedPreferences.getInstance();
    final routesJson = prefs.getString('saved_commuter_routes');
    if (routesJson != null) {
      try {
        final list = jsonDecode(routesJson) as List;
        return list.map((e) => Map<String, String>.from(e)).toList();
      } catch (_) {}
    }
    return [
      {
        'lineId': 'blue',
        'fromStationId': 'BL08',
        'toStationId': 'BL18',
        'label': 'Old High Court → Thaltej',
      },
      {
        'lineId': 'red',
        'fromStationId': 'RL02',
        'toStationId': 'RL08',
        'label': 'Sabarmati → Old High Court',
      },
    ];
  }

  // ESP32 LIVE SENSOR TELEMETRY
  Future<EspSensorModel?> getEsp32Live() async {
    try {
      final headers = await _getHeaders();
      final res = await _httpGet('/api/v1/esp32/live', headers: headers);
      if (res.statusCode == 200) {
        return EspSensorModel.fromJson(jsonDecode(res.body));
      }
    } catch (e) {
      debugPrint('Error fetching ESP32 live telemetry: $e');
    }
    return null;
  }

  Future<List<Map<String, dynamic>>> getEsp32Events() async {
    try {
      final headers = await _getHeaders();
      final res = await _httpGet('/api/v1/esp32/events', headers: headers);
      if (res.statusCode == 200) {
        final list = jsonDecode(res.body) as List;
        return list.map((e) => Map<String, dynamic>.from(e)).toList();
      }
    } catch (e) {
      debugPrint('Error fetching ESP32 events: $e');
    }
    return [];
  }

  Future<EspSensorModel?> resetEsp32Counters() async {
    try {
      final headers = await _getHeaders();
      final res = await _httpPost('/api/v1/esp32/reset', headers: headers);
      if (res.statusCode == 200) {
        return EspSensorModel.fromJson(jsonDecode(res.body));
      }
    } catch (e) {
      debugPrint('Error resetting ESP32 counters: $e');
    }
    return null;
  }

  Future<EspSensorModel?> sendEsp32Telemetry({
    required String direction,
    int inDelta = 0,
    int outDelta = 0,
    int? occupancy,
    String? stationId,
    String coachId = 'C1',
    String? deviceId,
    double? distanceS1,
    double? distanceS2,
  }) async {
    try {
      final headers = await _getHeaders();
      final body = {
        'direction': direction,
        'in_delta': inDelta,
        'out_delta': outDelta,
        if (occupancy != null) 'occupancy': occupancy,
        if (stationId != null) 'station_id': stationId,
        'coach_id': coachId,
        if (deviceId != null) 'device_id': deviceId,
        if (distanceS1 != null) 'distance_s1': distanceS1,
        if (distanceS2 != null) 'distance_s2': distanceS2,
      };
      final res = await _httpPost('/api/v1/esp32/telemetry',
          headers: headers, body: body);
      if (res.statusCode == 200) {
        return EspSensorModel.fromJson(jsonDecode(res.body));
      }
    } catch (e) {
      debugPrint('Error sending ESP32 telemetry: $e');
    }
    return null;
  }

  // ── AUTHENTICATION METHODS ────────────────────────────────────────────────
  Future<UserModel?> checkAuth() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('auth_token');
    if (token == null || token.isEmpty) return null;

    try {
      final headers = await _getHeaders();
      final res = await _httpGet('/api/v1/auth/me', headers: headers);
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        return UserModel.fromJson(data);
      } else if (res.statusCode == 401 || res.statusCode == 403) {
        // Stale or expired token
        await prefs.remove('auth_token');
        return null;
      }
    } catch (_) {}

    // Fallback to local session details if network temporarily offline
    final name = prefs.getString('user_name') ?? 'Commuter';
    final email = prefs.getString('user_email') ?? 'passenger@smartrail.os';
    final uid = prefs.getString('user_id') ?? 'PASS101';
    final uidCode = prefs.getString('user_id_code') ?? 'PASS101';
    final role = prefs.getString('user_role') ?? 'passenger';
    return UserModel(
        userId: uid, userIdCode: uidCode, name: name, email: email, role: role);
  }

  Future<UserModel> login(String identifier, String password) async {
    try {
      final res = await _httpPost('/api/v1/auth/login', body: {
        'identifier': identifier.trim(),
        'password': password,
      });
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final prefs = await SharedPreferences.getInstance();

        final token = data['access_token'] ?? data['token'];
        if (token != null) {
          await prefs.setString('auth_token', token.toString());
        }

        final userData = data['user'] is Map<String, dynamic>
            ? data['user'] as Map<String, dynamic>
            : data;
        final userModel = UserModel.fromJson(userData);

        await prefs.setString('user_id', userModel.userId);
        if (userModel.userIdCode != null) {
          await prefs.setString('user_id_code', userModel.userIdCode!);
        }
        await prefs.setString('user_name', userModel.name);
        await prefs.setString('user_email', userModel.email);
        await prefs.setString('user_role', userModel.role);

        return userModel;
      } else {
        String errMsg = 'Login failed (${res.statusCode})';
        try {
          final errBody = jsonDecode(res.body);
          if (errBody['detail'] != null) errMsg = errBody['detail'].toString();
        } catch (_) {}
        throw Exception(errMsg);
      }
    } catch (e) {
      if (e is Exception && e.toString().contains('Unable to reach backend')) {
        // Offline demo fallback
        final prefs = await SharedPreferences.getInstance();
        final uid = identifier.toUpperCase();
        final name =
            identifier.contains('@') ? identifier.split('@')[0] : identifier;
        await prefs.setString('auth_token', 'offline-token-$uid');
        await prefs.setString('user_name', name);
        await prefs.setString('user_email', '$identifier@smartrail.os');
        await prefs.setString('user_id_code', uid);
        await prefs.setString('user_id', 'uid-${identifier.hashCode}');
        await prefs.setString('user_role', 'passenger');
        return UserModel(
          userId: 'uid-${identifier.hashCode}',
          userIdCode: uid,
          name: name,
          email: '$identifier@smartrail.os',
          role: 'passenger',
        );
      }
      rethrow;
    }
  }

  Future<UserModel> register(String name, String email, String password,
      {String? userIdCode}) async {
    try {
      final res = await _httpPost('/api/v1/auth/register', body: {
        'full_name': name.trim(),
        'email': email.trim(),
        'password': password,
        if (userIdCode != null && userIdCode.isNotEmpty)
          'user_id_code': userIdCode.trim(),
        'role': 'passenger',
      });
      if (res.statusCode == 201 || res.statusCode == 200) {
        // Automatically login
        return await login(userIdCode ?? email, password);
      } else {
        String errMsg = 'Registration failed (${res.statusCode})';
        try {
          final errBody = jsonDecode(res.body);
          if (errBody['detail'] != null) errMsg = errBody['detail'].toString();
        } catch (_) {}
        throw Exception(errMsg);
      }
    } catch (e) {
      if (e is Exception && e.toString().contains('Unable to reach backend')) {
        final prefs = await SharedPreferences.getInstance();
        final uid = userIdCode ?? 'PASS-${email.hashCode.abs() % 1000}';
        await prefs.setString('auth_token', 'offline-token-$uid');
        await prefs.setString('user_name', name);
        await prefs.setString('user_email', email);
        await prefs.setString('user_id_code', uid);
        await prefs.setString('user_id', 'uid-${email.hashCode}');
        await prefs.setString('user_role', 'passenger');
        return UserModel(
          userId: 'uid-${email.hashCode}',
          userIdCode: uid,
          name: name,
          email: email,
          role: 'passenger',
        );
      }
      rethrow;
    }
  }

  Future<void> logout() async {
    try {
      final headers = await _getHeaders();
      await _httpPost('/api/v1/auth/logout', headers: headers);
    } catch (_) {}
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
    await prefs.remove('user_name');
    await prefs.remove('user_email');
    await prefs.remove('user_id');
    await prefs.remove('user_id_code');
    await prefs.remove('user_role');
  }

  Future<void> saveRoute(Map<String, String> route) async {
    final prefs = await SharedPreferences.getInstance();
    final existing = await getSavedRoutes();
    existing.add(route);
    await prefs.setString('saved_commuter_routes', jsonEncode(existing));
  }
}
