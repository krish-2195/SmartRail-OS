import 'package:shared_preferences/shared_preferences.dart';
import '../../features/auth/models/user_model.dart';

// DEPRECATED: This class is for prototyping only. 
// FOR BACKEND IMPLEMENTATION: Replace usages of this class in ApiService with real HTTP calls.
class MockAuthService {
  // BACKEND:
  // Method:  POST
  // URL:     /api/v1/auth/login
  // Payload: { "email": email, "password": password }
  // Returns: { "userId": string, "name": string, "email": string, "token": string }
  // Replace this mock with:
  //   final res = await http.post(Uri.parse(AppConfig.baseUrl + '/api/v1/auth/login'), ...);
  //   final data = jsonDecode(res.body);
  //   await prefs.setString('auth_token', data['token']);
  //   return UserModel.fromJson(data);
  Future<UserModel> login(String email, String password) async {
    await Future.delayed(const Duration(milliseconds: 500));
    final prefs = await SharedPreferences.getInstance();

    if (email == 'test@smartrail.os' && password == 'SmartRail@123') {
      await prefs.setString('auth_token', 'mock-token-test');
      await prefs.setString('user_name', 'Test User');
      await prefs.setString('user_email', 'test@smartrail.os');
      return UserModel(userId: 'test-uid', name: 'Test User', email: 'test@smartrail.os');
    }

    if (email.isNotEmpty && password.isNotEmpty) {
      await prefs.setString('auth_token', 'mock-token-${email.hashCode}');
      await prefs.setString('user_name', email.split('@')[0]);
      await prefs.setString('user_email', email);
      return UserModel(userId: 'uid-${email.hashCode}', name: email.split('@')[0], email: email);
    }

    throw Exception('Invalid credentials');
  }

  // BACKEND:
  // Method:  POST
  // URL:     /api/v1/auth/register
  // Payload: { "name": name, "email": email, "password": password }
  // Returns: { "userId": string, "name": string, "email": string, "token": string }
  // Replace this mock with the same pattern as login above.
  Future<UserModel> register(String name, String email, String password) async {
    await Future.delayed(const Duration(milliseconds: 500));
    final prefs = await SharedPreferences.getInstance();

    await prefs.setString('auth_token', 'mock-token-${email.hashCode}');
    await prefs.setString('user_name', name);
    await prefs.setString('user_email', email);
    
    return UserModel(userId: 'uid-${email.hashCode}', name: name, email: email);
  }

  // BACKEND:
  // Method:  POST
  // URL:     /api/v1/auth/logout
  // Payload: none (send Authorization header)
  // Returns: { "success": true }
  // Replace mock prefs.clear() with an HTTP call first, then clear prefs.
  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
  }

  // BACKEND:
  // Method:  GET
  // URL:     /api/v1/auth/me
  // Returns: { "userId": string, "name": string, "email": string }
  // Replace SharedPreferences read with:
  //   final token = prefs.getString('auth_token');
  //   if (token == null) return null;
  //   final res = await http.get(Uri.parse(AppConfig.baseUrl + '/api/v1/auth/me'),
  //       headers: AppConfig.authHeaders(token));
  //   return UserModel.fromJson(jsonDecode(res.body));
  Future<UserModel?> checkAuth() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('auth_token');
    if (token == null) return null;

    final name = prefs.getString('user_name') ?? 'User';
    final email = prefs.getString('user_email') ?? '';

    return UserModel(userId: 'mock-uid', name: name, email: email);
  }
}
