import 'package:go_router/go_router.dart';
import '../../features/trains/models/train_model.dart';
import '../../features/trains/screens/home_screen.dart';
import '../../features/trains/screens/lines_screen.dart';
import '../../features/trains/screens/live_radar_screen.dart';
import '../../features/trains/screens/train_results_screen.dart';
import '../../features/trains/screens/train_detail_screen.dart';
import '../../features/trains/screens/sensor_telemetry_screen.dart';
import '../../features/profile/screens/profile_screen.dart';
import '../../features/auth/screens/login_screen.dart';
import '../../features/auth/screens/register_screen.dart';

class AppRouter {
  static final router = GoRouter(
    initialLocation: '/home',
    routes: [
      GoRoute(
        path: '/',
        redirect: (_, __) => '/home',
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/register',
        builder: (context, state) => const RegisterScreen(),
      ),
      GoRoute(
        path: '/home',
        builder: (context, state) => const HomeScreen(),
      ),
      GoRoute(
        path: '/lines',
        builder: (context, state) {
          final line = state.uri.queryParameters['line'];
          return LinesScreen(initialLine: line);
        },
      ),
      GoRoute(
        path: '/live',
        builder: (context, state) => const LiveRadarScreen(),
      ),
      GoRoute(
        path: '/sensors',
        builder: (context, state) => const SensorTelemetryScreen(),
      ),
      GoRoute(
        path: '/sensor-telemetry',
        builder: (context, state) => const SensorTelemetryScreen(),
      ),
      GoRoute(
        path: '/results',
        builder: (context, state) {
          final lineId = state.uri.queryParameters['lineId'] ?? 'blue';
          final fromStationId = state.uri.queryParameters['fromStationId'] ?? '';
          final toStationId = state.uri.queryParameters['toStationId'] ?? '';
          return TrainResultsScreen(
            lineId: lineId,
            fromStationId: fromStationId,
            toStationId: toStationId,
          );
        },
      ),
      GoRoute(
        path: '/train/:trainId',
        builder: (context, state) {
          final trainId = state.pathParameters['trainId'] ?? '';
          final train = state.extra is TrainModel ? state.extra as TrainModel : null;
          return TrainDetailScreen(trainId: trainId, initialTrain: train);
        },
      ),
      GoRoute(
        path: '/profile',
        builder: (context, state) => const ProfileScreen(),
      ),
    ],
  );
}

