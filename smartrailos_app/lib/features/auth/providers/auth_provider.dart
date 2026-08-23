import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/services/api_service.dart';
import '../models/user_model.dart';

final apiServiceProvider = Provider((ref) => ApiService());

class AuthNotifier extends AsyncNotifier<UserModel?> {
  @override
  Future<UserModel?> build() async {
    return ref.read(apiServiceProvider).checkAuth();
  }

  Future<void> login(String identifier, String password) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => ref.read(apiServiceProvider).login(identifier, password));
    if (state is AsyncError) throw (state as AsyncError).error;
  }

  Future<void> register(String name, String email, String password, {String? userIdCode}) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => ref.read(apiServiceProvider).register(name, email, password, userIdCode: userIdCode));
    if (state is AsyncError) throw (state as AsyncError).error;
  }

  Future<void> logout() async {
    state = const AsyncLoading();
    await ref.read(apiServiceProvider).logout();
    state = const AsyncData(null);
  }
}

final authProvider = AsyncNotifierProvider<AuthNotifier, UserModel?>(() {
  return AuthNotifier();
});
